import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import FilterBar from './FilterBar';
import PetGrid from './PetGrid';
import { petsService } from '../services/petsService';

// Map age range to backend min_age/max_age (months)
const AGE_RANGE_MAP = {
  puppy: { min_age: 0, max_age: 6 },
  young: { min_age: 7, max_age: 24 },
  adult: { min_age: 25, max_age: 84 },
  senior: { min_age: 85, max_age: 300 },
};

const BrowsePets = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState('grid');
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const [filters, setFilters] = useState(() => ({
    search: searchParams.get('search') ?? '',
    pet_type: searchParams.get('pet_type') ?? '',
    ageRange: searchParams.get('age') ?? '',
    location: searchParams.get('location') ?? '',
  }));

  const apiParams = useMemo(() => {
    const params = { status: 'available' };
    if (filters.search?.trim()) params.search = filters.search.trim();
    if (filters.pet_type) params.pet_type = filters.pet_type;
    if (filters.ageRange && AGE_RANGE_MAP[filters.ageRange]) {
      params.min_age = AGE_RANGE_MAP[filters.ageRange].min_age;
      params.max_age = AGE_RANGE_MAP[filters.ageRange].max_age;
    }
    if (filters.location?.trim()) params.location = filters.location.trim();
    return params;
  }, [filters.search, filters.pet_type, filters.ageRange, filters.location]);

  useEffect(() => {
    const next = {};
    if (filters.search) next.search = filters.search;
    if (filters.pet_type) next.pet_type = filters.pet_type;
    if (filters.ageRange) next.age = filters.ageRange;
    if (filters.location) next.location = filters.location;
    setSearchParams(next, { replace: true });
  }, [filters.search, filters.pet_type, filters.ageRange, filters.location]);

  useEffect(() => {
    fetchPets();
  }, [apiParams]);

  const fetchPets = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await petsService.getAll(apiParams);
      setPets(data.results || []);
    } catch (err) {
      console.error('Failed to fetch pets:', err);
      setError('Failed to load pets. Please try again later.');
      setPets([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFiltersChange = (next) => {
    setFilters({
      search: next.search ?? '',
      pet_type: next.pet_type ?? '',
      ageRange: next.ageRange ?? '',
      location: next.location ?? '',
    });
  };

  // Transform backend data to match frontend component expectations
  const transformedPets = useMemo(() => pets.map((pet) => ({
    id: pet.id,
    name: pet.name,
    breed: pet.breed,
    age: pet.age ? `${pet.age} ${pet.age === 1 ? 'month' : 'months'}` : 'Unknown',
    gender: pet.gender ? pet.gender.charAt(0).toUpperCase() + pet.gender.slice(1) : 'Unknown',
    location: pet.location || 'Location not specified',
    description: pet.description || '',
    image: pet.primary_image || (pet.images && pet.images.length > 0 ? pet.images[0].image_url : null),
    status: pet.status || 'available',
  })), [pets]);

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Find Your Perfect Pet
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Browse through our collection of adorable pets waiting for their forever homes
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-center">
            {error}
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-center">
            {successMessage}
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-gray-600">Loading pets...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Filter Bar */}
            <FilterBar
              onViewChange={setViewMode}
              petCount={transformedPets.length}
              filters={filters}
              onFiltersChange={handleFiltersChange}
            />

            {/* Pets Grid */}
            {transformedPets.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600 text-lg">No pets match your filters.</p>
                <p className="text-gray-500 text-sm mt-2">Try adjusting your search or filters.</p>
              </div>
            ) : (
              <PetGrid
                pets={transformedPets}
                viewMode={viewMode}
                onAdoptionRequestSuccess={() => {
                  setSuccessMessage('Adoption request sent successfully!');
                  setTimeout(() => setSuccessMessage(null), 5000);
                }}
              />
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default BrowsePets;
