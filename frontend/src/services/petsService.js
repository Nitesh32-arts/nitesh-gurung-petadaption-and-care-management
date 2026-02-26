import apiClient from '../apiClient';

/**
 * Helper to unwrap paginated responses
 */
const unwrapPaginated = (data) => {
  if (Array.isArray(data)) return { results: data, count: data.length };
  return {
    results: data?.results || [],
    count: typeof data?.count === 'number' ? data.count : (data?.results?.length || 0),
  };
};

/**
 * Shared Pets API Service
 * Used by Browse Pets, Adopters, and other public-facing components
 */
export const petsService = {
  // Get all available pets (for public browsing)
  // Backend automatically filters by status='available' for unauthenticated users
  getAll: async (params = {}) => {
    // Ensure we only get available pets for public browsing
    const queryParams = {
      status: 'available',
      ...params,
    };
    
    const response = await apiClient.get('/pets/', { params: queryParams });
    return unwrapPaginated(response.data);
  },

  // Get single pet by ID
  getById: async (id) => {
    const response = await apiClient.get(`/pets/${id}/`);
    return response.data;
  },

  // Search pets with filters
  search: async (filters = {}) => {
    const response = await apiClient.get('/pets/', { params: filters });
    return unwrapPaginated(response.data);
  },
};

