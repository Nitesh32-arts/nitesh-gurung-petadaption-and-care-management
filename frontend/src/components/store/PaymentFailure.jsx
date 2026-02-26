import { Link } from 'react-router-dom';
import Navbar from '../Navbar';
import Footer from '../Footer';

const PaymentFailure = () => {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="max-w-lg mx-auto px-4 sm:px-6 py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment failed</h1>
        <p className="text-gray-600 mb-6">
          Your payment could not be completed. Your order has not been charged. You can try again or choose another payment method.
        </p>
        <Link
          to="/store/checkout"
          className="inline-block bg-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-emerald-600"
        >
          Try again
        </Link>
        <Link to="/store" className="block mt-4 text-primary font-medium hover:underline">Back to store</Link>
      </main>
      <Footer />
    </div>
  );
};

export default PaymentFailure;
