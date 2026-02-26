/**
 * E-Commerce Store API: products, cart, checkout, orders.
 */
import apiClient from '../apiClient';

const BASE = 'store/';

export const storeService = {
  // Products
  getProducts: (params = {}) =>
    apiClient.get(`${BASE}products/`, { params }).then((r) => {
      const d = r.data;
      return Array.isArray(d) ? d : (d.results || d);
    }),

  getProduct: (id) =>
    apiClient.get(`${BASE}products/${id}/`).then((r) => r.data),

  // Cart (requires auth)
  getCart: () =>
    apiClient.get(`${BASE}cart/`).then((r) => r.data),

  addToCart: (productId, quantity = 1) =>
    apiClient.post(`${BASE}cart/`, { product_id: productId, quantity }).then((r) => r.data),

  updateCartItem: (productId, quantity) =>
    apiClient.patch(`${BASE}cart/`, { product_id: productId, quantity }).then((r) => r.data),

  removeFromCart: (productId) =>
    apiClient.delete(`${BASE}cart/`, { data: { product_id: productId } }).then((r) => r.data),

  // Checkout
  checkout: (payload) =>
    apiClient.post(`${BASE}checkout/`, payload).then((r) => r.data),

  // eSewa initiate (signed payload with HMAC) – returns payment_data + gateway_url
  initiateEsewa: (orderId, successUrl, failureUrl) =>
    apiClient
      .post('payments/esewa/initiate/', {
        order_id: orderId,
        success_url: successUrl,
        failure_url: failureUrl,
      })
      .then((r) => r.data),

  // eSewa payment verification (after redirect from gateway)
  verifyEsewaPayment: (data) =>
    apiClient.post('payments/esewa/verify/', data).then((r) => r.data),

  // Orders
  getOrders: () =>
    apiClient.get(`${BASE}orders/`).then((r) => {
      const d = r.data;
      return Array.isArray(d) ? d : (d.results || d);
    }),

  getOrder: (id) =>
    apiClient.get(`${BASE}orders/${id}/`).then((r) => r.data),

  // Recommendations (adoption upsell)
  getRecommendations: (categories = []) => {
    const params = categories.length ? { category: categories } : {};
    return apiClient.get(`${BASE}recommendations/`, { params }).then((r) => r.data);
  },

  // Admin analytics
  getAnalyticsOverview: () =>
    apiClient.get(`${BASE}analytics/overview/`).then((r) => r.data),
  getAnalyticsTopProducts: () =>
    apiClient.get(`${BASE}analytics/top-products/`).then((r) => r.data),
  getAnalyticsLowStock: (threshold = 5) =>
    apiClient.get(`${BASE}analytics/low-stock/`, { params: { threshold } }).then((r) => r.data),
  getAnalyticsOrderStatus: () =>
    apiClient.get(`${BASE}analytics/order-status/`).then((r) => r.data),
};

export default storeService;
