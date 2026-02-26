from decimal import Decimal
from rest_framework import serializers
from .models import Product, Cart, CartItem, Order, OrderItem, Coupon


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = [
            'id', 'name', 'description', 'price', 'stock', 'category',
            'image', 'is_active', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class CartItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)

    class Meta:
        model = CartItem
        fields = ['id', 'product', 'quantity']


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    item_count = serializers.SerializerMethodField()
    total = serializers.SerializerMethodField()

    class Meta:
        model = Cart
        fields = ['id', 'items', 'item_count', 'total', 'created_at']

    def get_item_count(self, obj):
        return sum(i.quantity for i in obj.items.all())

    def get_total(self, obj):
        total = Decimal('0')
        for item in obj.items.select_related('product').all():
            total += item.product.price * item.quantity
        return total


class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = ['id', 'product', 'product_name', 'quantity', 'price']

    def get_product_name(self, obj):
        return obj.product.name if obj.product else 'Deleted product'


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = [
            'id', 'user', 'total_price', 'status', 'payment_method', 'payment_status',
            'transaction_reference', 'transaction_uuid', 'paid_at', 'address', 'phone', 'created_at', 'items',
        ]
        read_only_fields = ['id', 'user', 'created_at']


class CheckoutSerializer(serializers.Serializer):
    address = serializers.CharField()
    phone = serializers.CharField()
    payment_method = serializers.ChoiceField(
        choices=['COD', 'Khalti', 'eSewa'],
        default='COD',
    )
    coupon_code = serializers.CharField(required=False, allow_blank=True)
