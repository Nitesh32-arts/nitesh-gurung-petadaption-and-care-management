const PetStatusTabs = ({ activeTab, onTabChange, lostCount, foundCount }) => {
  return (
    <div className="flex justify-center mb-8">
      <div className="inline-flex bg-gray-100 rounded-full p-1">
        <button
          onClick={() => onTabChange('lost')}
          className={`px-6 py-2 rounded-full font-medium transition-all duration-200 ${
            activeTab === 'lost'
              ? 'bg-primary text-white shadow-md'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Lost Pets ({lostCount})
        </button>
        <button
          onClick={() => onTabChange('found')}
          className={`px-6 py-2 rounded-full font-medium transition-all duration-200 ${
            activeTab === 'found'
              ? 'bg-primary text-white shadow-md'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Found Pets ({foundCount})
        </button>
      </div>
    </div>
  );
};

export default PetStatusTabs;

