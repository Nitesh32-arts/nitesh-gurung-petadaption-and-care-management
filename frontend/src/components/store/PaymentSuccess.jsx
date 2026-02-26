import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Navbar from '../Navbar';
import Footer from '../Footer';
import { storeService } from '../../services/storeService';

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('verifying'); // verifying | success | error
  const [message, setMessage] = useState('');
  const [orderId, setOrderId] = useState(null);
  const verifiedRef = useRef(false);

  useEffect(() => {
    const oid = searchParams.get('oid');
    const amt = searchParams.get('amt');
    const refId = searchParams.get('refId');

    if (!oid || !amt || !refId) {
      setStatus('error');
      setMessage('Missing payment details. Please contact support if you were charged.');
      return;
    }

    if (verifiedRef.current) return;
    verifiedRef.current = true;

    setStatus('verifying');
    storeService
      .verifyEsewaPayment({ oid, amt, refId })
      .then((res) => {
        setStatus('success');
        setOrderId(res.order_id);
        setMessage(res.detail || res.message || 'Payment verified successfully.');
        window.dispatchEvent(new CustomEvent('cartUpdated'));
      })
      .catch((err) => {
        setStatus('error');
        const detail = err.response?.data?.detail;
        setMessage(typeof detail === 'string' ? detail : 'Verification failed. Please contact support if you were charged.');
        setOrderId(oid);
      });
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="max-w-lg mx-auto px-4 sm:px-6 py-12 text-center">
        {status === 'verifying' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-gray-700 font-medium">Verifying your payment...</p>
            <p className="text-sm text-gray-500 mt-2">Please wait.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment successful</h1>
            <p className="text-gray-600 mb-6">{message}</p>
            {orderId && (
              <Link
                to={`/store/orders/${orderId}`}
                className="inline-block bg-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-emerald-600"
              >
                View order
              </Link>
            )}
            <Link to="/store" className="block mt-4 text-primary font-medium hover:underline">Back to store</Link>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment verification failed</h1>
            <p className="text-gray-600 mb-6">{message}</p>
            <Link to="/store/checkout" className="inline-block bg-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-emerald-600">
              Try again
            </Link>
            <Link to="/store" className="block mt-4 text-primary font-medium hover:underline">Back to store</Link>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default PaymentSuccess;
