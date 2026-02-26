import { Search, Grid3x3, List } from 'lucide-react';
import { useState, useEffect } from 'react';

const PET_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'dog', label: 'Dogs' },
  { value: 'cat', label: 'Cats' },
  { value: 'other', label: 'Other' },
];

const AGE_OPTIONS = [
  { value: '', label: 'All Ages' },
  { value: 'puppy', label: 'Puppy/Kitten' },
  { value: 'young', label: 'Young' },
  { value: 'adult', label: 'Adult' },
  { value: 'senior', label: 'Senior' },
];

const LOCATION_OPTIONS = [
  { value: '', label: 'All Locations' },
  { value: 'San Francisco, CA', label: 'San Francisco, CA' },
  { value: 'Los Angeles, CA', label: 'Los Angeles, CA' },
  { value: 'New York, NY', label: 'New York, NY' },
  { value: 'Boston, MA', label: 'Boston, MA' },
  { value: 'Miami, FL', label: 'Miami, FL' },
  { value: 'Denver, CO', label: 'Denver, CO' },
];

const FilterBar = ({ onViewChange, petCount, filters = {}, onFiltersChange }) => {
  const [viewMode, setViewMode] = useState('grid');
  const [searchQuery, setSearchQuery] = useState(filters.search ?? '');
  const [petType, setPetType] = useState(filters.pet_type ?? '');
  const [ageRange, setAgeRange] = useState(filters.ageRange ?? '');
  const [location, setLocation] = useState(filters.location ?? '');

  useEffect(() => {
    setSearchQuery(filters.search ?? '');
    setPetType(filters.pet_type ?? '');
    setAgeRange(filters.ageRange ?? '');
    setLocation(filters.location ?? '');
  }, [filters.search, filters.pet_type, filters.ageRange, filters.location]);

  const notifyFilters = (next) => {
    onFiltersChange?.(next);
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (value.trim() === '') {
      notifyFilters({ search: '', pet_type: petType || undefined, ageRange: ageRange || undefined, location: location || undefined });
    }
  };

  const handleApplySearch = () => {
    notifyFilters({ search: searchQuery, pet_type: petType || undefined, ageRange: ageRange || undefined, location: location || undefined });
  };

  const handlePetTypeChange = (e) => {
    const value = e.target.value;
    setPetType(value);
    notifyFilters({ search: searchQuery, pet_type: value || undefined, ageRange: ageRange || undefined, location: location || undefined });
  };

  const handleAgeChange = (e) => {
    const value = e.target.value;
    setAgeRange(value);
    notifyFilters({ search: searchQuery, pet_type: petType || undefined, ageRange: value || undefined, location: location || undefined });
  };

  const handleLocationChange = (e) => {
    const value = e.target.value;
    setLocation(value);
    notifyFilters({ search: searchQuery, pet_type: petType || undefined, ageRange: ageRange || undefined, location: value || undefined });
  };

  const handleViewChange = (mode) => {
    setViewMode(mode);
    onViewChange(mode);
  };

  return (
    <div className="bg-emerald-50 rounded-xl p-6 mb-8">
      <div className="flex flex-col lg:flex-row gap-4 items-center">
        {/* Search Input + Button */}
        <div className="flex-1 w-full lg:w-auto flex gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={(e) => e.key === 'Enter' && handleApplySearch()}
              placeholder="Search by name or breed..."
              className="w-full pl-12 pr-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <button
            type="button"
            onClick={handleApplySearch}
            className="px-5 py-3 rounded-lg bg-primary text-white font-medium hover:bg-emerald-600 transition-colors whitespace-nowrap"
          >
            Search
          </button>
        </div>

        {/* Dropdown Filters */}
        <div className="flex gap-3 w-full lg:w-auto">
          <select
            value={petType}
            onChange={handlePetTypeChange}
            className="flex-1 lg:flex-none px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            {PET_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select
            value={ageRange}
            onChange={handleAgeChange}
            className="flex-1 lg:flex-none px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            {AGE_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select
            value={location}
            onChange={handleLocationChange}
            className="flex-1 lg:flex-none px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            {LOCATION_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* View Toggle Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => handleViewChange('grid')}
            className={`p-3 rounded-lg transition-colors ${
              viewMode === 'grid'
                ? 'bg-primary text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
            aria-label="Grid view"
          >
            <Grid3x3 className="h-5 w-5" />
          </button>
          <button
            onClick={() => handleViewChange('list')}
            className={`p-3 rounded-lg transition-colors ${
              viewMode === 'list'
                ? 'bg-primary text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
            aria-label="List view"
          >
            <List className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Results Count */}
      <p className="text-sm text-gray-600 mt-4">
        Found {petCount} pets
      </p>
    </div>
  );
};

export default FilterBar;
