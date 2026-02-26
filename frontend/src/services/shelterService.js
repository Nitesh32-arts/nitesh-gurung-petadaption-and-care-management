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
 * Pets API for Shelter
 */
export const petsService = {
  // Get all pets owned by the logged-in shelter
  getMyPets: async (params = {}) => {
    const response = await apiClient.get('/pets/my_pets/', { params });
    return unwrapPaginated(response.data);
  },

  // Get single pet (with ownership check)
  getById: async (id) => {
    const response = await apiClient.get(`/pets/${id}/`);
    return response.data;
  },

  // Create new pet (automatically assigns to logged-in shelter)
  create: async (petData) => {
    const response = await apiClient.post('/pets/', petData);
    return response.data;
  },

  // Update pet (only if owned by shelter)
  update: async (id, petData) => {
    const response = await apiClient.put(`/pets/${id}/`, petData);
    return response.data;
  },

  // Delete pet (only if owned by shelter)
  delete: async (id) => {
    await apiClient.delete(`/pets/${id}/`);
  },

  // Upload image for pet
  uploadImage: async (petId, imageFile, isPrimary = false) => {
    const formData = new FormData();
    formData.append('image', imageFile);
    formData.append('is_primary', isPrimary);
    
    const response = await apiClient.post(`/pets/${petId}/upload_image/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

/**
 * Adoption Requests API for Shelter
 */
export const adoptionRequestsService = {
  // Get all adoption requests for shelter's pets
  getAll: async (params = {}) => {
    const response = await apiClient.get('/adoption-requests/', { params });
    return unwrapPaginated(response.data);
  },

  // Get single adoption request
  getById: async (id) => {
    const response = await apiClient.get(`/adoption-requests/${id}/`);
    return response.data;
  },

  // Approve adoption request
  approve: async (id) => {
    const response = await apiClient.post(`/adoption-requests/${id}/approve/`);
    return response.data;
  },

  // Reject adoption request
  reject: async (id) => {
    const response = await apiClient.post(`/adoption-requests/${id}/reject/`);
    return response.data;
  },

  // Complete adoption (for requests with status 'updated' only)
  completeAdoption: async (id) => {
    const response = await apiClient.post(`/adoption-requests/${id}/complete-adoption/`);
    return response.data;
  },

  // Get adoption history (approved/adopted only)
  getHistory: async () => {
    const response = await apiClient.get('/adoption-requests/history/');
    return response.data?.results || response.data || [];
  },

  // Download certificate
  downloadCertificate: async (adoptionRequestId) => {
    try {
      const response = await apiClient.get(`/adoption-requests/${adoptionRequestId}/certificate/`, {
        responseType: 'blob', // Important for binary data
      });
      
      // Check if response is actually a PDF blob
      if (response.data instanceof Blob) {
        // If it's already a blob, use it directly
        const blob = response.data;
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        // Extract filename from Content-Disposition header or use default
        const contentDisposition = response.headers['content-disposition'] || response.headers['Content-Disposition'];
        let filename = `adoption_certificate_${adoptionRequestId}.pdf`;
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
          if (filenameMatch && filenameMatch[1]) {
            filename = filenameMatch[1].replace(/['"]/g, '');
          }
        }
        
        link.setAttribute('download', filename);
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        // Fallback: create blob from response data
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `adoption_certificate_${adoptionRequestId}.pdf`);
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to download certificate:', error);
      // Check if error response contains JSON error message
      if (error.response && error.response.data instanceof Blob) {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const errorData = JSON.parse(reader.result);
            throw new Error(errorData.detail || 'Failed to download certificate');
          } catch (e) {
            throw new Error('Failed to download certificate');
          }
        };
        reader.readAsText(error.response.data);
      } else {
        throw error;
      }
    }
  },
};

/**
 * Lost & Found API for Shelter
 */
export const lostFoundService = {
  // Get lost pet reports (related to shelter pets if applicable)
  getLostReports: async (params = {}) => {
    const response = await apiClient.get('/lost-found/lost/', { params });
    return unwrapPaginated(response.data);
  },

  // Get found pet reports
  getFoundReports: async (params = {}) => {
    const response = await apiClient.get('/lost-found/found/', { params });
    return unwrapPaginated(response.data);
  },

  // Get match notifications
  getMatchNotifications: async () => {
    const response = await apiClient.get('/lost-found/notifications/');
    return unwrapPaginated(response.data);
  },

  // Get unread match notification count
  getUnreadMatchCount: async () => {
    const response = await apiClient.get('/lost-found/notifications/unread_count/');
    return response.data?.unread_count || 0;
  },
};

/**
 * Messages API - shared chat service (backend role-based).
 */
export { messagesService } from './messagesService';

/**
 * Dashboard Stats API
 */
export const dashboardStatsService = {
  // Get comprehensive dashboard stats
  getStats: async () => {
    const [petsRes, requestsRes, messagesRes, lostFoundRes] = await Promise.allSettled([
      petsService.getMyPets(),
      adoptionRequestsService.getAll(),
      messagesService.getUnreadCount(),
      lostFoundService.getUnreadMatchCount(),
    ]);

    const stats = {
      totalPets: 0,
      availablePets: 0,
      pendingPets: 0,
      adoptedPets: 0,
      pendingAdoptionRequests: 0,
      messages: 0,
      lostFoundAlerts: 0,
    };

    if (petsRes.status === 'fulfilled') {
      const pets = petsRes.value.results || [];
      stats.totalPets = pets.length;
      stats.availablePets = pets.filter(p => p.status === 'available').length;
      stats.pendingPets = pets.filter(p => p.status === 'pending').length;
      stats.adoptedPets = pets.filter(p => p.status === 'adopted').length;
    }

    if (requestsRes.status === 'fulfilled') {
      const requests = requestsRes.value.results || [];
      stats.pendingAdoptionRequests = requests.filter(r => r.status === 'pending').length;
    }

    if (messagesRes.status === 'fulfilled') {
      stats.messages = messagesRes.value;
    }

    if (lostFoundRes.status === 'fulfilled') {
      stats.lostFoundAlerts = lostFoundRes.value;
    }

    return stats;
  },
};

