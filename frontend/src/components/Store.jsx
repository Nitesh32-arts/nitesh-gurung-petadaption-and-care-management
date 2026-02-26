import { useState, useEffect, useCallback } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import CategoryTabs from './CategoryTabs';
import ProductGrid from './ProductGrid';
import { storeService } from '../services/storeService';
import { useToast } from '../context/ToastContext';

const Store = () => {
  const toast = useToast();
  const [activeCategory, setActiveCategory] = useState('all');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = activeCategory !== 'all' ? { category: activeCategory } : {};
      const data = await storeService.getProducts(params);
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load products.');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [activeCategory]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleAddToCart = async (productId, quantity = 1) => {
    try {
      await storeService.addToCart(productId, quantity);
      window.dispatchEvent(new CustomEvent('cartUpdated'));
      toast.success('Added to cart', {
        actionLink: { text: 'View Cart', to: '/store/cart' },
      });
    } catch (err) {
      const msg = err.response?.data?.detail || 'Could not add to cart.';
      toast.error(msg);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">Pet Store</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Everything your pet needs for a happy and healthy life
          </p>
        </div>

        <CategoryTabs
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
        />

        {error && (
          <p className="text-center text-red-600 py-4">{error}</p>
        )}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
          </div>
        ) : (
          <ProductGrid
            products={products}
            onAddToCart={handleAddToCart}
          />
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Store;
