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
 * Medical Records API
 */
export const medicalRecordsService = {
  // Get all medical records (for veterinarian, shows all; for adopter, shows their pets')
  getAll: async (params = {}) => {
    const response = await apiClient.get('/veterinary/medical-records/', { params });
    return unwrapPaginated(response.data);
  },

  // Get single medical record
  getById: async (id) => {
    const response = await apiClient.get(`/veterinary/medical-records/${id}/`);
    return response.data;
  },

  // Create new medical record
  create: async (recordData) => {
    if (!recordData.petId) {
      throw new Error('Please select a pet.');
    }
    // Build request body
    const body = {
      pet: recordData.petId,
      record_type: recordData.recordType,
      title: recordData.title,
      description: recordData.description,
      date: recordData.date,
    };
    
    if (recordData.nextDueDate) {
      body.next_due_date = recordData.nextDueDate;
    }
    if (recordData.cost) {
      body.cost = recordData.cost;
    }
    
    // Add vaccination data if provided
    if (recordData.vaccinationData) {
      body.vaccination_data = recordData.vaccinationData;
    }
    
    // Add treatments data if provided
    if (recordData.treatmentsData && recordData.treatmentsData.length > 0) {
      body.treatments_data = recordData.treatmentsData;
    }
    
    // If documents are provided, use FormData with JSON stringified nested data
    if (recordData.documents) {
      const formData = new FormData();
      
      // Append simple fields
      formData.append('pet', body.pet);
      formData.append('record_type', body.record_type);
      formData.append('title', body.title);
      formData.append('description', body.description);
      formData.append('date', body.date);
      
      if (body.next_due_date) {
        formData.append('next_due_date', body.next_due_date);
      }
      if (body.cost) {
        formData.append('cost', body.cost);
      }
      
      // For nested data in FormData, send as JSON strings
      // Backend serializer will parse these
      if (body.vaccination_data) {
        formData.append('vaccination_data', JSON.stringify(body.vaccination_data));
      }
      if (body.treatments_data) {
        formData.append('treatments_data', JSON.stringify(body.treatments_data));
      }
      
      formData.append('documents', recordData.documents);
      
      // Do NOT set Content-Type - browser must add boundary for multipart/form-data
      const response = await apiClient.post('/veterinary/medical-records/', formData);
      return response.data;
    }
    
    // Otherwise use JSON (preferred for nested data like vaccination_data)
    const response = await apiClient.post('/veterinary/medical-records/', body);
    return response.data;
  },

  // Update medical record
  update: async (id, recordData) => {
    const formData = new FormData();
    
    Object.keys(recordData).forEach(key => {
      if (recordData[key] !== undefined && recordData[key] !== null) {
        if (key === 'vaccinationData' || key === 'treatmentsData') {
          formData.append(key, JSON.stringify(recordData[key]));
        } else {
          formData.append(key, recordData[key]);
        }
      }
    });
    
    // Do NOT set Content-Type - browser must add boundary for multipart/form-data
    const response = await apiClient.patch(`/veterinary/medical-records/${id}/`, formData);
    return response.data;
  },

  // Delete medical record
  delete: async (id) => {
    await apiClient.delete(`/veterinary/medical-records/${id}/`);
  },

  // Add vaccination to medical record
  addVaccination: async (recordId, vaccinationData) => {
    const response = await apiClient.post(
      `/veterinary/medical-records/${recordId}/add_vaccination/`,
      vaccinationData
    );
    return response.data;
  },

  // Add treatment to medical record
  addTreatment: async (recordId, treatmentData) => {
    const response = await apiClient.post(
      `/veterinary/medical-records/${recordId}/add_treatment/`,
      treatmentData
    );
    return response.data;
  },

  // Get records for a specific pet
  getByPetId: async (petId) => {
    const response = await apiClient.get('/veterinary/medical-records/', {
      params: { pet: petId },
    });
    return unwrapPaginated(response.data);
  },
};

/**
 * Health Reminders API
 */
export const healthRemindersService = {
  // Get all health reminders
  getAll: async (params = {}) => {
    const response = await apiClient.get('/veterinary/reminders/', { params });
    return unwrapPaginated(response.data);
  },

  // Get single reminder
  getById: async (id) => {
    const response = await apiClient.get(`/veterinary/reminders/${id}/`);
    return response.data;
  },

  // Create health reminder
  create: async (reminderData) => {
    const response = await apiClient.post('/veterinary/reminders/', reminderData);
    return response.data;
  },

  // Update health reminder
  update: async (id, reminderData) => {
    const response = await apiClient.patch(`/veterinary/reminders/${id}/`, reminderData);
    return response.data;
  },

  // Delete health reminder
  delete: async (id) => {
    await apiClient.delete(`/veterinary/reminders/${id}/`);
  },

  // Get upcoming reminders (due within next 30 days)
  getUpcoming: async () => {
    const response = await apiClient.get('/veterinary/reminders/upcoming/');
    return Array.isArray(response.data) ? response.data : (response.data?.results || []);
  },

  // Get overdue reminders
  getOverdue: async () => {
    const response = await apiClient.get('/veterinary/reminders/overdue/');
    return Array.isArray(response.data) ? response.data : (response.data?.results || []);
  },

  // Mark reminder as completed
  markCompleted: async (id) => {
    const response = await apiClient.post(`/veterinary/reminders/${id}/mark_completed/`);
    return response.data;
  },

  // Mark reminder as sent
  markSent: async (id) => {
    const response = await apiClient.post(`/veterinary/reminders/${id}/mark_sent/`);
    return response.data;
  },
};

/**
 * Assigned Pets API
 * Note: Assigned pets are pets that have medical records created by this veterinarian
 */
export const assignedPetsService = {
  // Get all pets assigned to this veterinarian (pets with medical records)
  getAll: async () => {
    try {
      const response = await apiClient.get('/veterinary/medical-records/assigned_pets/');
      return unwrapPaginated(response.data);
    } catch (error) {
      console.error('Failed to fetch assigned pets:', error);
      return { results: [], count: 0 };
    }
  },

  // Get pet health history
  getPetHealthHistory: async (petId) => {
    return await medicalRecordsService.getByPetId(petId);
  },
};

/**
 * Messages API - shared chat service (backend role-based).
 */
export { messagesService } from './messagesService';

/**
 * Pets API (for browsing and selecting pets)
 */
export const petsService = {
  // Get all pets (for veterinarian to browse and select)
  getAll: async (params = {}) => {
    const maxRetries = 3;
    let attempt = 0;
    let lastError;
    
    while (attempt < maxRetries) {
      try {
        const response = await apiClient.get('/pets/', { params });
        // Success - return data immediately
        return unwrapPaginated(response.data);
      } catch (error) {
        lastError = error;
        attempt++;
        
        // Log detailed error info for debugging
        console.error(`Pets API Error (attempt ${attempt}/${maxRetries}):`, {
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url,
          baseURL: error.config?.baseURL,
          fullURL: `${error.config?.baseURL || ''}${error.config?.url || ''}`,
          message: error.message,
        });
        
        if (error.response?.status === 404 && attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 500;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // For other errors (not 404) or final attempt, throw immediately
        throw error;
      }
    }
    
    throw lastError;
  },

  // Get single pet
  getById: async (id) => {
    const response = await apiClient.get(`/pets/${id}/`);
    return response.data;
  },

  // Health check to verify endpoint is accessible
  healthCheck: async () => {
    try {
      const response = await apiClient.get('/pets/', { params: { page_size: 1 } });
      return { accessible: true, status: response.status };
    } catch (error) {
      return { 
        accessible: false, 
        status: error.response?.status,
        message: error.message 
      };
    }
  },
};

