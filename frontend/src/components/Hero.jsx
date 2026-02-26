import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';

const Hero = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [petType, setPetType] = useState('');

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (searchQuery?.trim()) params.set('search', searchQuery.trim());
    if (petType) params.set('pet_type', petType);
    navigate(`/browse${params.toString() ? `?${params.toString()}` : ''}`);
  };

  return (
    <section 
      className="relative w-full h-[600px] flex items-center justify-center bg-cover bg-center"
      style={{
        backgroundImage: 'url(https://images.unsplash.com/photo-1551717743-49959800b1f6?w=1920&q=80)',
      }}
    >
      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-black bg-opacity-50"></div>

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
          Find Your Perfect Companion Today
        </h1>
        <p className="text-lg md:text-xl text-gray-200 mb-8 max-w-2xl mx-auto">
          Connect with verified shelters, track your pet's health, and ensure lifelong care for your furry friends.
        </p>

        {/* Search Bar */}
        <div className="bg-white rounded-xl shadow-lg p-2 flex flex-col sm:flex-row gap-2 max-w-3xl mx-auto">
          <div className="flex-1 flex items-center border border-gray-300 rounded-lg px-4 py-3">
            <Search className="h-5 w-5 text-gray-400 mr-3 flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search by breed, type, or location..."
              className="flex-1 outline-none text-gray-700 min-w-0"
            />
          </div>
          <select
            value={petType}
            onChange={(e) => setPetType(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-3 text-gray-700 bg-white outline-none"
          >
            <option value="">All Pets</option>
            <option value="dog">Dogs</option>
            <option value="cat">Cats</option>
            <option value="other">Other</option>
          </select>
          <button
            type="button"
            onClick={handleSearch}
            className="bg-primary text-white px-8 py-3 rounded-lg font-semibold hover:bg-emerald-600 transition-colors shadow-md"
          >
            Search Pets
          </button>
        </div>

        {/* Stats */}
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-bold text-white mb-2">5,000+</div>
            <div className="text-gray-300">Pets Adopted</div>
          </div>
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-bold text-white mb-2">200+</div>
            <div className="text-gray-300">Verified Shelters</div>
          </div>
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-bold text-white mb-2">150+</div>
            <div className="text-gray-300">Partner Vets</div>
          </div>
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-bold text-white mb-2">98%</div>
            <div className="text-gray-300">Success Rate</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;

