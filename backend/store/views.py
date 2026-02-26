"""
E-Commerce Store API: products, cart, checkout, orders, analytics.
"""
import logging
import os
import urllib.parse
import urllib.request
import uuid as uuid_module
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView

from accounts.permissions import IsAdminUser
from .models import Product, Cart, CartItem, Order, OrderItem, Coupon
from .esewa_utils import generate_esewa_signature
from .serializers import (
    ProductSerializer,
    CartSerializer,
    OrderSerializer,
    CheckoutSerializer,
)

logger = logging.getLogger(__name__)


class ProductViewSet(viewsets.ModelViewSet):
    """
    Products: list/retrieve for all; create/update/delete for admin only.
    """
    serializer_class = ProductSerializer
    filterset_fields = ['category', 'is_active']
    search_fields = ['name', 'description']
    ordering_fields = ['price', 'created_at', 'name']
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]

    def get_queryset(self):
        qs = Product.objects.all()
        if not (self.request.user and self.request.user.is_authenticated and (getattr(self.request.user, 'role', None) == 'admin' or getattr(self.request.user, 'is_superuser', False))):
            qs = qs.filter(is_active=True)
        return qs

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsAdminUser()]
        return [AllowAny()]

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        serializer.save()

    def perform_destroy(self, instance):
        instance.delete()


class CartView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cart, _ = Cart.objects.get_or_create(user=request.user)
        serializer = CartSerializer(cart)
        return Response(serializer.data)

    def post(self, request):
        """Add to cart: { "product_id": int, "quantity": int }"""
        product_id = request.data.get('product_id')
        quantity = request.data.get('quantity', 1)
        if not product_id:
            return Response({'detail': 'product_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            product = Product.objects.get(pk=product_id)
        except Product.DoesNotExist:
            return Response({'detail': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not product.is_active:
            return Response({'detail': 'Product is not available.'}, status=status.HTTP_400_BAD_REQUEST)
        if product.stock < 1:
            return Response({'detail': 'Item out of stock.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            quantity = max(1, int(quantity))
        except (TypeError, ValueError):
            return Response({'detail': 'Invalid quantity.'}, status=status.HTTP_400_BAD_REQUEST)
        if quantity > product.stock:
            return Response({'detail': f'Only {product.stock} available.'}, status=status.HTTP_400_BAD_REQUEST)

        cart, _ = Cart.objects.get_or_create(user=request.user)
        item, created = CartItem.objects.get_or_create(cart=cart, product=product, defaults={'quantity': quantity})
        if not created:
            new_qty = item.quantity + quantity
            if new_qty > product.stock:
                return Response({'detail': f'Only {product.stock} available.'}, status=status.HTTP_400_BAD_REQUEST)
            item.quantity = new_qty
            item.save()
        serializer = CartSerializer(cart)
        return Response(serializer.data)

    def patch(self, request):
        """Update quantity: { "product_id": int, "quantity": int }. 0 = remove."""
        product_id = request.data.get('product_id')
        quantity = request.data.get('quantity')
        if product_id is None:
            return Response({'detail': 'product_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            cart = Cart.objects.get(user=request.user)
        except Cart.DoesNotExist:
            return Response({'detail': 'Cart is empty.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            item = CartItem.objects.get(cart=cart, product_id=product_id)
        except CartItem.DoesNotExist:
            return Response({'detail': 'Item not in cart.'}, status=status.HTTP_404_NOT_FOUND)
        if quantity is not None:
            try:
                quantity = int(quantity)
            except (TypeError, ValueError):
                return Response({'detail': 'Invalid quantity.'}, status=status.HTTP_400_BAD_REQUEST)
            if quantity <= 0:
                item.delete()
            else:
                if quantity > item.product.stock:
                    return Response({'detail': f'Only {item.product.stock} available.'}, status=status.HTTP_400_BAD_REQUEST)
                item.quantity = quantity
                item.save()
        serializer = CartSerializer(cart)
        return Response(serializer.data)

    def delete(self, request):
        """Remove item: ?product_id= or body { "product_id": int }"""
        product_id = request.query_params.get('product_id') or request.data.get('product_id')
        if not product_id:
            return Response({'detail': 'product_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            cart = Cart.objects.get(user=request.user)
        except Cart.DoesNotExist:
            return Response({'detail': 'Cart is empty.'}, status=status.HTTP_400_BAD_REQUEST)
        deleted, _ = CartItem.objects.filter(cart=cart, product_id=product_id).delete()
        if not deleted:
            return Response({'detail': 'Item not in cart.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = CartSerializer(cart)
        return Response(serializer.data)


class CheckoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ser = CheckoutSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        address = ser.validated_data['address']
        phone = ser.validated_data['phone']
        payment_method = ser.validated_data.get('payment_method', 'COD')
        coupon_code = (ser.validated_data.get('coupon_code') or '').strip()

        try:
            cart = Cart.objects.get(user=request.user)
        except Cart.DoesNotExist:
            return Response({'detail': 'Cart is empty.'}, status=status.HTTP_400_BAD_REQUEST)

        items = list(cart.items.select_related('product').all())
        if not items:
            return Response({'detail': 'Cart is empty.'}, status=status.HTTP_400_BAD_REQUEST)

        coupon = None
        if coupon_code:
            try:
                coupon = Coupon.objects.get(code__iexact=coupon_code, active=True)
                now = timezone.now()
                if coupon.valid_from and now < coupon.valid_from:
                    coupon = None
                if coupon and coupon.valid_until and now > coupon.valid_until:
                    coupon = None
            except Coupon.DoesNotExist:
                pass

        is_esewa = payment_method == 'eSewa'

        try:
            with transaction.atomic():
                total = Decimal('0')
                order_items_data = []
                for cart_item in items:
                    product = Product.objects.select_for_update().get(pk=cart_item.product_id)
                    if not product.is_active:
                        raise ValueError(f'Product "{product.name}" is no longer available.')
                    if product.stock < cart_item.quantity:
                        raise ValueError(f'Product "{product.name}" has only {product.stock} in stock.')
                    line_total = product.price * cart_item.quantity
                    total += line_total
                    order_items_data.append({
                        'product': product,
                        'quantity': cart_item.quantity,
                        'price': product.price,
                        'line_total': line_total,
                    })

                if coupon:
                    discount = total * (coupon.discount_percent / Decimal('100'))
                    total = total - discount

                payment_status = 'Pending'
                if payment_method == 'COD':
                    payment_status = 'Pending'
                elif payment_method in ('Khalti', 'eSewa'):
                    payment_status = 'Pending'

                order = Order.objects.create(
                    user=request.user,
                    total_price=total,
                    status='Pending',
                    payment_method=payment_method,
                    payment_status=payment_status,
                    address=address,
                    phone=phone,
                    coupon=coupon,
                )
                for data in order_items_data:
                    OrderItem.objects.create(
                        order=order,
                        product=data['product'],
                        quantity=data['quantity'],
                        price=data['price'],
                    )
                if not is_esewa:
                    # For COD/Khalti: deduct stock and clear cart immediately
                    for data in order_items_data:
                        data['product'].stock -= data['quantity']
                        data['product'].save(update_fields=['stock'])
                    cart.items.all().delete()
                # For eSewa: stock and cart are updated only after payment verification

            logger.info('Store checkout order_id=%s user_id=%s total=%s payment=%s', order.id, request.user.id, order.total_price, payment_method)
            serializer = OrderSerializer(order)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Product.DoesNotExist:
            return Response({'detail': 'Product not found.'}, status=status.HTTP_400_BAD_REQUEST)


# eSewa: UAT URLs. If uat.esewa.com.np doesn't resolve (DNS_PROBE_FINISHED_NXDOMAIN), try another network/VPN or use production.
ESEWA_VERIFY_URL = os.environ.get('ESEWA_VERIFY_URL', 'https://uat.esewa.com.np/epay/transrec')
ESEWA_GATEWAY_URL = os.environ.get('ESEWA_GATEWAY_URL', 'https://uat.esewa.com.np/epay/main')
ESEWA_SCD = os.environ.get('ESEWA_SCD', 'EPAYTEST')
ESEWA_SECRET_KEY = os.environ.get('ESEWA_SECRET_KEY', '')


class EsewaInitiateView(APIView):
    """
    POST /api/payments/esewa/initiate/
    Body: { "order_id": int, "success_url": str, "failure_url": str }
    Generates transaction_uuid, builds signed payment fields (HMAC SHA256), returns payload for frontend.
    Frontend must POST these fields to eSewa gateway. Never expose secret key.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        order_id = request.data.get('order_id')
        success_url = (request.data.get('success_url') or '').strip()
        failure_url = (request.data.get('failure_url') or '').strip()
        if not order_id:
            return Response({'detail': 'order_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not success_url or not failure_url:
            return Response({'detail': 'success_url and failure_url are required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not ESEWA_SECRET_KEY:
            return Response(
                {'detail': 'eSewa signed payment is not configured (ESEWA_SECRET_KEY missing).'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        try:
            order_id = int(order_id)
        except (TypeError, ValueError):
            return Response({'detail': 'Invalid order_id.'}, status=status.HTTP_400_BAD_REQUEST)

        order = Order.objects.filter(id=order_id, user=request.user).first()
        if not order:
            return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)
        if order.payment_method != 'eSewa':
            return Response({'detail': 'Order is not an eSewa order.'}, status=status.HTTP_400_BAD_REQUEST)
        if order.payment_status == 'Paid':
            return Response({'detail': 'Order is already paid.'}, status=status.HTTP_400_BAD_REQUEST)

        total = order.total_price
        total_amount = str(total)
        tax_amount = '0'
        transaction_uuid = str(uuid_module.uuid4())
        order.transaction_uuid = transaction_uuid
        order.save(update_fields=['transaction_uuid'])
        product_code = ESEWA_SCD

        signed_field_names = 'total_amount,tax_amount,transaction_uuid,product_code,success_url,failure_url'
        field_values = {
            'total_amount': total_amount,
            'tax_amount': tax_amount,
            'transaction_uuid': transaction_uuid,
            'product_code': product_code,
            'success_url': success_url,
            'failure_url': failure_url,
        }
        try:
            signature = generate_esewa_signature(signed_field_names, field_values, ESEWA_SECRET_KEY)
        except Exception as e:
            logger.exception('eSewa signature generation failed: %s', e)
            return Response({'detail': 'Payment initiation failed.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        payload = {
            **field_values,
            'signed_field_names': signed_field_names,
            'signature': signature,
        }
        return Response({
            'payment_data': payload,
            'gateway_url': ESEWA_GATEWAY_URL,
        }, status=status.HTTP_200_OK)


class EsewaVerifyView(APIView):
    """
    POST /api/payments/esewa/verify/
    Body: { "oid": order_id, "amt": amount, "refId": transaction_reference }
    Verifies payment with eSewa server; updates order only on success. Never trust frontend alone.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        oid = request.data.get('oid')
        amt = request.data.get('amt')
        ref_id = request.data.get('refId') or request.data.get('ref_id')

        if not all([oid, amt, ref_id]):
            return Response(
                {'detail': 'oid, amt and refId are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            order_id = int(oid)
        except (TypeError, ValueError):
            return Response({'detail': 'Invalid order id.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            amount = Decimal(str(amt))
        except (TypeError, ValueError):
            return Response({'detail': 'Invalid amount.'}, status=status.HTTP_400_BAD_REQUEST)

        order = Order.objects.filter(id=order_id, user=request.user).prefetch_related('items', 'items__product').first()
        if not order:
            return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)
        if order.payment_method != 'eSewa':
            return Response({'detail': 'Order is not an eSewa order.'}, status=status.HTTP_400_BAD_REQUEST)
        if order.payment_status == 'Paid':
            return Response(
                {'detail': 'Payment already verified.', 'order_id': order.id},
                status=status.HTTP_200_OK
            )
        if Order.objects.filter(transaction_reference=ref_id).exclude(id=order_id).exists():
            return Response({'detail': 'Transaction reference already used.'}, status=status.HTTP_400_BAD_REQUEST)

        if amount != order.total_price:
            order.payment_status = 'Failed'
            order.save(update_fields=['payment_status'])
            return Response(
                {'detail': 'Amount does not match order total.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        data = urllib.parse.urlencode({
            'amt': str(order.total_price),
            'rid': ref_id,
            'pid': str(order.id),
            'scd': ESEWA_SCD,
        }).encode('utf-8')
        req = urllib.request.Request(ESEWA_VERIFY_URL, data=data, method='POST')
        req.add_header('Content-Type', 'application/x-www-form-urlencoded')
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                body = resp.read().decode('utf-8', errors='ignore')
        except Exception as e:
            logger.warning('eSewa verify request failed: %s', e)
            return Response(
                {'detail': 'Payment verification failed. Please try again or contact support.'},
                status=status.HTTP_502_BAD_GATEWAY
            )

        if 'Success' not in body and 'success' not in body:
            order.payment_status = 'Failed'
            order.save(update_fields=['payment_status'])
            return Response(
                {'detail': 'Payment verification failed.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        now = timezone.now()
        with transaction.atomic():
            order.transaction_reference = ref_id
            order.payment_status = 'Paid'
            order.status = 'Processing'
            order.paid_at = now
            order.save(update_fields=['transaction_reference', 'payment_status', 'status', 'paid_at'])
            for item in order.items.select_related('product').all():
                if item.product_id and item.product:
                    item.product.stock -= item.quantity
                    item.product.save(update_fields=['stock'])
            try:
                cart = Cart.objects.get(user=request.user)
                cart.items.all().delete()
            except Cart.DoesNotExist:
                pass

        logger.info('eSewa verified order_id=%s refId=%s', order.id, ref_id)
        return Response({
            'success': True,
            'order_id': order.id,
            'message': 'Payment verified successfully.',
        }, status=status.HTTP_200_OK)


class OrderViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = OrderSerializer

    def get_queryset(self):
        return Order.objects.filter(user=self.request.user).prefetch_related('items', 'items__product')


class AnalyticsOverviewView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        from django.db.models import Sum
        from django.db.models.functions import TruncMonth

        orders = Order.objects.exclude(status='Cancelled')
        total_orders = orders.count()
        total_revenue = orders.aggregate(s=Sum('total_price'))['s'] or Decimal('0')
        today = timezone.now().date()
        orders_today = Order.objects.filter(created_at__date=today).exclude(status='Cancelled').count()
        monthly = Order.objects.exclude(status='Cancelled').annotate(
            month=TruncMonth('created_at')
        ).values('month').annotate(revenue=Sum('total_price')).order_by('-month')[:12]
        return Response({
            'total_orders': total_orders,
            'total_revenue': str(total_revenue),
            'orders_today': orders_today,
            'monthly_revenue': [{'month': str(m['month']), 'revenue': str(m['revenue'])} for m in monthly],
        })


class AnalyticsTopProductsView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        from django.db.models import Sum
        top = OrderItem.objects.values('product__id', 'product__name').annotate(
            total_quantity=Sum('quantity')
        ).order_by('-total_quantity')[:20]
        return Response([{'product_id': t['product__id'], 'product_name': t['product__name'], 'total_quantity': t['total_quantity']} for t in top])


class AnalyticsLowStockView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        threshold = int(request.query_params.get('threshold', 5))
        low = Product.objects.filter(stock__lt=threshold, is_active=True).values('id', 'name', 'stock', 'category')
        return Response(list(low))


class AnalyticsOrderStatusView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        from django.db.models import Count
        counts = Order.objects.values('status').annotate(count=Count('id'))
        return Response({c['status']: c['count'] for c in counts})


class RecommendationsView(APIView):
    """Recommend products for adoption upsell: starter food, grooming, bedding/accessories."""
    permission_classes = [AllowAny]

    def get(self, request):
        categories = request.query_params.getlist('category') or ['Food', 'Grooming', 'Accessories']
        qs = Product.objects.filter(is_active=True, stock__gt=0, category__in=categories).order_by('category', '-created_at')[:12]
        # Dedupe by category for variety
        seen = set()
        out = []
        for p in qs:
            if p.category not in seen:
                seen.add(p.category)
                out.append(p)
            elif len(out) < 9:
                out.append(p)
        serializer = ProductSerializer(out, many=True)
        return Response(serializer.data)
