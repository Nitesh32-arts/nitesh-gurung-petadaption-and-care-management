const CategoryTabs = ({ activeCategory, onCategoryChange }) => {
  const categories = [
    { id: 'all', name: 'All Products' },
    { id: 'Food', name: 'Food' },
    { id: 'Toys', name: 'Toys' },
    { id: 'Accessories', name: 'Accessories' },
    { id: 'HealthCare', name: 'Health & Care' },
    { id: 'Grooming', name: 'Grooming' },
  ];

  return (
    <div className="flex justify-center mb-8 overflow-x-auto">
      <div className="inline-flex bg-gray-100 rounded-full p-1 gap-1">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => onCategoryChange(category.id)}
            className={`px-6 py-2 rounded-full font-medium transition-all duration-200 whitespace-nowrap ${
              activeCategory === category.id
                ? 'bg-primary text-white shadow-md'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
            }`}
          >
            {category.name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default CategoryTabs;
