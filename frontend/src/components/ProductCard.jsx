import { useState } from 'react';
import { ShoppingCart } from 'lucide-react';

const ProductCard = ({ product, onAddToCart }) => {
  const [adding, setAdding] = useState(false);
  const imageUrl = product.image
    ? (product.image.startsWith('http') ? product.image : `/media/${product.image}`)
    : 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=400&q=80';

  const outOfStock = !product.stock || product.stock < 1;

  const handleAdd = async () => {
    if (outOfStock || !onAddToCart) return;
    setAdding(true);
    try {
      await onAddToCart(product.id, 1);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1 overflow-hidden">
      <div className="relative">
        <img
          src={imageUrl}
          alt={product.name}
          className="w-full h-64 object-cover"
        />
        {outOfStock && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white font-semibold text-lg">Out of Stock</span>
          </div>
        )}
      </div>
      <div className="p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-2">{product.name}</h3>
        <p className="text-sm text-gray-500 mb-3 line-clamp-2">{product.description}</p>
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold text-primary">
            ${typeof product.price === 'number' ? product.price.toFixed(2) : product.price}
          </span>
          <button
            type="button"
            onClick={handleAdd}
            disabled={outOfStock || adding}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ShoppingCart className="h-4 w-4" />
            {adding ? 'Adding…' : 'Add to Cart'}
          </button>
        </div>
        {!outOfStock && product.stock < 1e2 && (
          <p className="text-xs text-gray-500 mt-2">Only {product.stock} left</p>
        )}
      </div>
    </div>
  );
};

export default ProductCard;
