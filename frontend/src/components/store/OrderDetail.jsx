import { useState, useEffect } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import Navbar from '../Navbar';
import Footer from '../Footer';
import { storeService } from '../../services/storeService';

const OrderDetail = () => {
  const { id } = useParams();
  const location = useLocation();
  const [order, setOrder] = useState(location.state?.order || null);
  const [loading, setLoading] = useState(!order);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (order && String(order.id) === String(id)) return;
    if (!id) return;
    storeService.getOrder(id).then(setOrder).catch(() => setError('Order not found.')).finally(() => setLoading(false));
  }, [id, order]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 py-12 flex justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 py-12 text-center">
          <p className="text-red-600">{error || 'Order not found.'}</p>
          <Link to="/store/orders" className="text-primary font-medium mt-4 inline-block">Back to orders</Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link to="/store/orders" className="text-primary font-medium mb-4 inline-block">← Back to orders</Link>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Order #{order.id}</h1>
        <p className="text-gray-500 mb-6">
          Placed on {order.created_at ? new Date(order.created_at).toLocaleString() : ''}
        </p>
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <p><span className="font-medium">Status:</span> {order.status}</p>
          <p><span className="font-medium">Payment:</span> {order.payment_method} – {order.payment_status}</p>
          <p><span className="font-medium">Total:</span> ${order.total_price}</p>
          <p><span className="font-medium">Address:</span> {order.address}</p>
          <p><span className="font-medium">Phone:</span> {order.phone}</p>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">Items</h2>
        <ul className="space-y-2 mb-8">
          {order.items?.map((item) => (
            <li key={item.id} className="flex justify-between border-b pb-2">
              <span>{item.product_name || `Product #${item.product}`} × {item.quantity}</span>
              <span>${(item.price * item.quantity).toFixed(2)}</span>
            </li>
          ))}
        </ul>
        <Link to="/store" className="text-primary font-medium hover:underline">Continue shopping</Link>
      </main>
      <Footer />
    </div>
  );
};

export default OrderDetail;
