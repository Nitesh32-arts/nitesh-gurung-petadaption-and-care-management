import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../Navbar';
import Footer from '../Footer';
import { storeService } from '../../services/storeService';

const OrdersList = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    storeService.getOrders().then((data) => {
      setOrders(Array.isArray(data) ? data : []);
    }).catch(() => {
      setError('Failed to load orders.');
      setOrders([]);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">My Orders</h1>
        {error && <p className="text-red-600 py-2">{error}</p>}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl">
            <p className="text-gray-600 text-lg mb-4">You have no orders yet.</p>
            <Link to="/store" className="text-primary font-medium hover:underline">Browse store</Link>
          </div>
        ) : (
          <ul className="space-y-4">
            {orders.map((o) => (
              <li key={o.id}>
                <Link
                  to={`/store/orders/${o.id}`}
                  className="block p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-semibold text-gray-900">Order #{o.id}</span>
                      <span className="ml-2 text-gray-500 text-sm">{o.status}</span>
                    </div>
                    <span className="text-primary font-medium">${o.total_price}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {o.created_at ? new Date(o.created_at).toLocaleString() : ''}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default OrdersList;
