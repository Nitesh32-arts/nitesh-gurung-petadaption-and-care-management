import apiClient from '../apiClient';

/**
 * Adoption Requests API
 */
export const adoptionRequestsService = {
  // Fetch all adoption requests for current adopter
  getAll: async () => {
    const response = await apiClient.get('/adoption-requests/');
    return response.data?.results || response.data || [];
  },

  // Get single adoption request
  getById: async (id) => {
    const response = await apiClient.get(`/adoption-requests/${id}/`);
    return response.data;
  },

  // Submit new adoption request
  create: async (petId, notes = '') => {
    // Ensure petId is a number
    const petIdNum = typeof petId === 'string' ? parseInt(petId, 10) : petId;
    
    if (!petIdNum || isNaN(petIdNum)) {
      throw new Error('Invalid pet ID');
    }
    
    try {
      // Ensure we send exactly { pet: petId } - pet must be a number
      const payload = {
        pet: petIdNum,
      };
      
      // Only include notes if provided
      if (notes) {
        payload.notes = notes;
      }

      const response = await apiClient.post('/adoption-requests/', payload);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Check if user already has a pending request for this pet (single lightweight request)
  checkPending: async (petId) => {
    const response = await apiClient.get('/adoption-requests/check/', {
      params: { pet_id: petId },
    });
    return response.data?.has_pending ?? false;
  },

  // Check if user already has a request for this pet (legacy: fetches all)
  checkExisting: async (petId) => {
    const requests = await adoptionRequestsService.getAll();
    return requests.some(req => req.pet?.id === petId && req.status === 'pending');
  },

  // Get adoption history (approved only)
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
 * Adopted Pets API
 */
export const adoptedPetsService = {
  // Fetch all adopted pets for current adopter
  getAll: async () => {
    const response = await apiClient.get('/adopted-pets/');
    return response.data?.results || response.data || [];
  },
};

/**
 * Saved Pets API
 */
export const savedPetsService = {
  // Fetch all saved pets
  getAll: async () => {
    const response = await apiClient.get('/saved-pets/');
    return response.data?.results || response.data || [];
  },

  // Save a pet
  save: async (petId) => {
    const response = await apiClient.post('/saved-pets/', {
      pet_id: petId,
    });
    return response.data;
  },

  // Unsave a pet
  unsave: async (savedPetId) => {
    await apiClient.delete(`/saved-pets/${savedPetId}/`);
  },

  // Check if pet is saved
  isSaved: async (petId) => {
    const saved = await savedPetsService.getAll();
    return saved.some(sp => sp.pet?.id === petId);
  },
};

/**
 * Rewards & Badges API
 */
export const rewardsService = {
  // Get total reward points
  getTotal: async () => {
    try {
    const response = await apiClient.get('/rewards/total/');
      // Ensure we return a number, defaulting to 0 if not available
      return parseInt(response.data?.points || 0, 10);
    } catch (error) {
      console.error('Failed to fetch reward points:', error);
      return 0;
    }
  },

  // Get all reward point history
  getHistory: async () => {
    try {
    const response = await apiClient.get('/rewards/');
    return response.data?.results || response.data || [];
    } catch (error) {
      console.error('Failed to fetch reward history:', error);
      return [];
    }
  },
};

/**
 * Messages API - uses shared messagesService (backend role-based chat).
 */
export { messagesService } from './messagesService';

/**
 * Lost Pet Reports API (uses lostFoundService for consistency)
 */
import { lostFoundService } from './lostFoundService';

export const lostPetService = {
  getAll: async () => lostFoundService.getLostReports(),
  getById: async (id) => lostFoundService.getLostReportById(id),
  create: async (reportData) => {
    const formData = new FormData();
    formData.append('pet', reportData.pet);
    formData.append('last_seen_location', reportData.lastSeenLocation);
    formData.append('last_seen_date', reportData.lastSeenDate);
    formData.append('description', reportData.description || '');
    if (reportData.color) formData.append('color', reportData.color);
    if (reportData.size) formData.append('size', reportData.size);
    if (reportData.image) formData.append('image', reportData.image);
    return lostFoundService.createLostReport(formData);
  },
  update: async (id, reportData) => lostFoundService.updateLostReport(id, reportData),
  markResolved: async (id) => lostFoundService.markLostResolved(id),
};

/**
 * Health Records API
 */
export const healthRecordsService = {
  // Get health records for adopted pets
  getForPets: async (petIds) => {
    if (!petIds || petIds.length === 0) return [];
    
    const response = await apiClient.get('/veterinary/medical-records/', {
      params: {
        pet__in: petIds.join(','),
      },
    });
    return response.data?.results || response.data || [];
  },

  // Get vaccinations for a pet
  getVaccinations: async (petId) => {
    try {
      const response = await apiClient.get('/veterinary/medical-records/vaccinations_by_pet/', {
        params: { pet_id: petId }
      });
      return response.data || [];
    } catch (error) {
      console.error('Failed to fetch vaccinations:', error);
      return [];
    }
  },

  // Get single record
  getById: async (id) => {
    const response = await apiClient.get(`/veterinary/medical-records/${id}/`);
    return response.data;
  },

  // Get upcoming reminders
  getUpcomingReminders: async () => {
    try {
      const response = await apiClient.get('/veterinary/reminders/upcoming/');
      return response.data || [];
    } catch (error) {
      console.error('Failed to fetch upcoming reminders:', error);
      return [];
    }
  },

  // Get overdue reminders
  getOverdueReminders: async () => {
    try {
      const response = await apiClient.get('/veterinary/reminders/overdue/');
      return response.data || [];
    } catch (error) {
      console.error('Failed to fetch overdue reminders:', error);
      return [];
    }
  },
};

/**
 * Store Orders API (if exists)
 * Note: This assumes a store API exists. If not, you'll need to create it.
 */
export const storeOrdersService = {
  // Get all orders for current user
  getAll: async () => {
    try {
      const response = await apiClient.get('/store/orders/');
      return response.data?.results || response.data || [];
    } catch (error) {
      // If store API doesn't exist, return empty array silently
      if (error.response?.status === 404) {
        // Suppress console error for 404 - this is expected if store API doesn't exist
        return [];
      }
      // Only log non-404 errors
      console.error('Failed to fetch store orders:', error);
      throw error;
    }
  },

  // Get single order
  getById: async (id) => {
    const response = await apiClient.get(`/store/orders/${id}/`);
    return response.data;
  },
};

/**
 * Notifications API
 */
export const notificationsService = {
  // Get all notifications
  getAll: async () => {
    try {
      const response = await apiClient.get('/veterinary/notifications/');
      return response.data?.results || response.data || [];
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      return [];
    }
  },

  // Get unread count
  getUnreadCount: async () => {
    try {
      const response = await apiClient.get('/veterinary/notifications/unread_count/');
      return response.data?.unread_count || 0;
    } catch (error) {
      console.error('Failed to fetch unread notifications count:', error);
      return 0;
    }
  },

  // Mark notification as read
  markAsRead: async (notificationId) => {
    try {
      await apiClient.post(`/veterinary/notifications/${notificationId}/mark_read/`);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      throw error;
    }
  },

  // Mark all notifications as read
  markAllAsRead: async () => {
    try {
      await apiClient.post('/veterinary/notifications/mark_all_read/');
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      throw error;
    }
  },
};

