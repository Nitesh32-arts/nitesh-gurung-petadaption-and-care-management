from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ProductViewSet,
    CartView,
    CheckoutView,
    OrderViewSet,
    AnalyticsOverviewView,
    AnalyticsTopProductsView,
    AnalyticsLowStockView,
    AnalyticsOrderStatusView,
    RecommendationsView,
)

router = DefaultRouter()
router.register(r'products', ProductViewSet, basename='store-product')
router.register(r'orders', OrderViewSet, basename='store-order')

urlpatterns = [
    path('', include(router.urls)),
    path('cart/', CartView.as_view(), name='store-cart'),
    path('checkout/', CheckoutView.as_view(), name='store-checkout'),
    path('analytics/overview/', AnalyticsOverviewView.as_view(), name='store-analytics-overview'),
    path('analytics/top-products/', AnalyticsTopProductsView.as_view(), name='store-analytics-top-products'),
    path('analytics/low-stock/', AnalyticsLowStockView.as_view(), name='store-analytics-low-stock'),
    path('analytics/order-status/', AnalyticsOrderStatusView.as_view(), name='store-analytics-order-status'),
    path('recommendations/', RecommendationsView.as_view(), name='store-recommendations'),
]
