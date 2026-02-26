import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Minus, Plus, Trash2 } from 'lucide-react';
import Navbar from '../Navbar';
import Footer from '../Footer';
import { storeService } from '../../services/storeService';

const Cart = () => {
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(null);
  const navigate = useNavigate();

  const loadCart = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await storeService.getCart();
      setCart(data);
    } catch (err) {
      if (err.response?.status === 401) {
        navigate('/login', { state: { from: '/store/cart' } });
        return;
      }
      setError('Failed to load cart.');
      setCart(null);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  const updateQty = async (productId, quantity) => {
    if (quantity < 1) return;
    setUpdating(productId);
    try {
      const updated = await storeService.updateCartItem(productId, quantity);
      setCart(updated);
      window.dispatchEvent(new CustomEvent('cartUpdated'));
    } catch (err) {
      alert(err.response?.data?.detail || 'Invalid quantity.');
    } finally {
      setUpdating(null);
    }
  };

  const removeItem = async (productId) => {
    setUpdating(productId);
    try {
      const updated = await storeService.removeFromCart(productId);
      setCart(updated);
      window.dispatchEvent(new CustomEvent('cartUpdated'));
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not remove item.');
    } finally {
      setUpdating(null);
    }
  };

  const itemCount = cart?.item_count ?? 0;
  const total = cart?.total ?? 0;

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <ShoppingCart className="w-8 h-8 text-primary" />
          Your Cart
        </h1>
        {error && <p className="text-red-600 py-4">{error}</p>}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
          </div>
        ) : !cart || itemCount === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl">
            <p className="text-gray-600 text-lg mb-4">Your cart is empty.</p>
            <Link to="/store" className="text-primary font-medium hover:underline">
              Continue shopping
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-4 mb-8">
              {cart.items?.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 p-4 border rounded-lg bg-white shadow-sm"
                >
                  <img
                    src={item.product?.image ? (item.product.image.startsWith('http') ? item.product.image : `/media/${item.product.image}`) : 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=100&q=80'}
                    alt={item.product?.name}
                    className="w-20 h-20 object-cover rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{item.product?.name}</h3>
                    <p className="text-primary font-medium">${(item.product?.price * item.quantity)?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateQty(item.product?.id, item.quantity - 1)}
                      disabled={updating === item.product?.id || item.quantity <= 1}
                      className="p-1 rounded border hover:bg-gray-100 disabled:opacity-50"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center font-medium">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQty(item.product?.id, item.quantity + 1)}
                      disabled={updating === item.product?.id || item.quantity >= (item.product?.stock ?? 0)}
                      className="p-1 rounded border hover:bg-gray-100 disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.product?.id)}
                    disabled={updating === item.product?.id}
                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                    aria-label="Remove"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="border-t pt-6 flex justify-between items-center flex-wrap gap-4">
              <p className="text-xl font-bold text-gray-900">Total: ${typeof total === 'number' ? total.toFixed(2) : (total != null ? String(total) : '0.00')}</p>
              <div className="flex gap-4">
                <Link to="/store" className="text-gray-600 hover:text-gray-900 font-medium">
                  Continue shopping
                </Link>
                <Link
                  to="/store/checkout"
                  className="bg-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-emerald-600"
                >
                  Proceed to checkout
                </Link>
              </div>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Cart;
