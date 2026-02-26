import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../Navbar';
import Footer from '../Footer';
import { storeService } from '../../services/storeService';
import { useAuth } from '../../hooks/useAuth';

// eSewa gateway (UAT). If you get DNS_PROBE_FINISHED_NXDOMAIN, your network may not resolve uat.esewa.com.np.
// Override with VITE_ESEWA_GATEWAY_URL in .env (e.g. production or alternate test URL).
const ESEWA_GATEWAY_URL = import.meta.env.VITE_ESEWA_GATEWAY_URL || 'https://uat.esewa.com.np/epay/main';
const ESEWA_SCD = import.meta.env.VITE_ESEWA_SCD || 'EPAYTEST';

const Checkout = () => {
  const { user } = useAuth();
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [esewaRedirect, setEsewaRedirect] = useState(null);
  const formRef = useRef(null);
  const [form, setForm] = useState({
    address: user?.address || '',
    phone: user?.phone_number || '',
    payment_method: 'COD',
    coupon_code: '',
  });
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login', { state: { from: '/store/checkout' } });
      return;
    }
    storeService.getCart().then((data) => {
      setCart(data);
      setForm((f) => ({ ...f, address: f.address || user?.address || '', phone: f.phone || user?.phone_number || '' }));
    }).catch((err) => {
      if (err.response?.status === 401) navigate('/login', { state: { from: '/store/checkout' } });
      else setError('Failed to load cart.');
    }).finally(() => setLoading(false));
  }, [user, navigate]);

  useEffect(() => {
    if (esewaRedirect && formRef.current) {
      formRef.current.submit();
    }
  }, [esewaRedirect]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!cart?.items?.length) {
      setError('Cart is empty.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const order = await storeService.checkout({
        address: form.address,
        phone: form.phone,
        payment_method: form.payment_method,
        coupon_code: form.coupon_code || undefined,
      });

      if (form.payment_method === 'eSewa') {
        const baseUrl = window.location.origin;
        const successUrl = `${baseUrl}/payment-success`;
        const failureUrl = `${baseUrl}/payment-failure`;
        try {
          const init = await storeService.initiateEsewa(order.id, successUrl, failureUrl);
          if (init.payment_data && init.gateway_url) {
            setEsewaRedirect({ gateway_url: init.gateway_url, payment_data: init.payment_data });
            return;
          }
        } catch (initErr) {
          if (initErr.response?.status !== 503) {
            setError(initErr.response?.data?.detail || 'Failed to initiate eSewa payment.');
            setSubmitting(false);
            return;
          }
        }
        // Fallback: unsigned payload (when ESEWA_SECRET_KEY not set or initiate returns 503)
        const total = Number(order.total_price);
        setEsewaRedirect({
          amt: total,
          pid: String(order.id),
          tAmt: total,
          su: successUrl,
          fu: failureUrl,
        });
        return;
      }

      window.dispatchEvent(new CustomEvent('cartUpdated'));
      navigate(`/store/orders/${order.id}`, { state: { order } });
    } catch (err) {
      setError(err.response?.data?.detail || 'Checkout failed. Please try again.');
      setSubmitting(false);
    } finally {
      if (form.payment_method !== 'eSewa') setSubmitting(false);
    }
  };

  const itemCount = cart?.item_count ?? 0;
  const total = cart?.total ?? 0;

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Checkout</h1>
        {error && <p className="text-red-600 py-2 mb-4">{error}</p>}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
          </div>
        ) : esewaRedirect ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl">
            <p className="text-gray-700 font-medium mb-2">Redirecting to eSewa...</p>
            <p className="text-sm text-gray-500 mb-4">Please wait. Do not close this page.</p>
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto" />
            <form
              ref={formRef}
              method="post"
              action={esewaRedirect.gateway_url || ESEWA_GATEWAY_URL}
              className="hidden"
            >
              {esewaRedirect.payment_data ? (
                Object.entries(esewaRedirect.payment_data).map(([name, value]) => (
                  <input key={name} type="hidden" name={name} value={value ?? ''} />
                ))
              ) : (
                <>
                  <input type="hidden" name="amt" value={esewaRedirect.amt} />
                  <input type="hidden" name="psc" value="0" />
                  <input type="hidden" name="pdc" value="0" />
                  <input type="hidden" name="txAmt" value="0" />
                  <input type="hidden" name="tAmt" value={esewaRedirect.tAmt} />
                  <input type="hidden" name="pid" value={esewaRedirect.pid} />
                  <input type="hidden" name="scd" value={ESEWA_SCD} />
                  <input type="hidden" name="su" value={esewaRedirect.su} />
                  <input type="hidden" name="fu" value={esewaRedirect.fu} />
                </>
              )}
            </form>
          </div>
        ) : !cart || itemCount === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl">
            <p className="text-gray-600 text-lg mb-4">Cart is empty.</p>
            <Link to="/store" className="text-primary font-medium hover:underline">Go to store</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
              <textarea
                required
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
              <input
                type="text"
                required
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment method</label>
              <select
                value={form.payment_method}
                onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
              >
                <option value="COD">Cash on Delivery</option>
                <option value="Khalti">Khalti</option>
                <option value="eSewa">eSewa</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Coupon code (optional)</label>
              <input
                type="text"
                value={form.coupon_code}
                onChange={(e) => setForm((f) => ({ ...f, coupon_code: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                placeholder="Enter code"
              />
            </div>
            <p className="text-lg font-semibold text-gray-900">Total: ${typeof total === 'number' ? total.toFixed(2) : total}</p>
            <div className="flex gap-4">
              <Link to="/store/cart" className="text-gray-600 hover:text-gray-900 font-medium">Back to cart</Link>
              <button
                type="submit"
                disabled={submitting}
                className="bg-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-emerald-600 disabled:opacity-50"
              >
                {submitting
                  ? (form.payment_method === 'eSewa' ? 'Redirecting to eSewa…' : 'Placing order…')
                  : 'Place order'}
              </button>
            </div>
          </form>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Checkout;
