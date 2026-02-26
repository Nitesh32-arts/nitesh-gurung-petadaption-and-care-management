import apiClient from '../apiClient';

const BASE = '/lost-found';

/**
 * Lost & Found API service.
 * Lost reports: adopters only, user sees own. Found reports: adopters/shelters create; list shows active.
 */
export const lostFoundService = {
  // --- Lost reports (adopter: create + own list) ---
  getLostReports: async (params = {}) => {
    const response = await apiClient.get(`${BASE}/lost/`, { params });
    return response.data?.results ?? response.data ?? [];
  },
  getLostReportById: async (id) => {
    const response = await apiClient.get(`${BASE}/lost/${id}/`);
    return response.data;
  },
  /** Public shareable lost report (no auth required, for social sharing) */
  getLostReportShare: async (id) => {
    const response = await apiClient.get(`${BASE}/lost/${id}/share/`);
    return response.data;
  },
  createLostReport: async (formData) => {
    const response = await apiClient.post(`${BASE}/lost/`, formData, {
      headers: formData instanceof FormData ? {} : { 'Content-Type': 'application/json' },
    });
    return response.data;
  },
  updateLostReport: async (id, data) => {
    const response = await apiClient.patch(`${BASE}/lost/${id}/`, data);
    return response.data;
  },
  markLostResolved: async (id) => {
    const response = await apiClient.post(`${BASE}/lost/${id}/mark_resolved/`);
    return response.data;
  },
  deleteLostReport: async (id) => {
    await apiClient.delete(`${BASE}/lost/${id}/`);
  },
  uploadLostImage: async (reportId, file) => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await apiClient.post(`${BASE}/lost/${reportId}/upload_image/`, formData);
    return response.data;
  },

  // --- Found reports (adopter/shelter: create; list = active) ---
  getFoundReports: async (params = {}) => {
    const response = await apiClient.get(`${BASE}/found/`, { params: { status: 'active', ...params } });
    return response.data?.results ?? response.data ?? [];
  },
  getFoundReportById: async (id) => {
    const response = await apiClient.get(`${BASE}/found/${id}/`);
    return response.data;
  },
  /** Public shareable found report (no auth required, for social sharing) */
  getFoundReportShare: async (id) => {
    const response = await apiClient.get(`${BASE}/found/${id}/share/`);
    return response.data;
  },
  createFoundReport: async (formData) => {
    const response = await apiClient.post(`${BASE}/found/`, formData, {
      headers: formData instanceof FormData ? {} : { 'Content-Type': 'application/json' },
    });
    return response.data;
  },
  updateFoundReport: async (id, data) => {
    const response = await apiClient.patch(`${BASE}/found/${id}/`, data);
    return response.data;
  },
  markFoundResolved: async (id) => {
    const response = await apiClient.post(`${BASE}/found/${id}/mark_resolved/`);
    return response.data;
  },
  deleteFoundReport: async (id) => {
    await apiClient.delete(`${BASE}/found/${id}/`);
  },
  uploadFoundImage: async (reportId, file) => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await apiClient.post(`${BASE}/found/${reportId}/upload_image/`, formData);
    return response.data;
  },

  // --- Matches ---
  getMatches: async () => {
    const response = await apiClient.get(`${BASE}/matches/`);
    return response.data?.results ?? response.data ?? [];
  },
  getMatchById: async (id) => {
    const response = await apiClient.get(`${BASE}/matches/${id}/`);
    return response.data;
  },
  confirmMatch: async (matchId) => {
    const response = await apiClient.post(`${BASE}/matches/${matchId}/confirm/`);
    return response.data;
  },
  rejectMatch: async (matchId) => {
    const response = await apiClient.post(`${BASE}/matches/${matchId}/reject/`);
    return response.data;
  },
  resolveMatch: async (matchId) => {
    const response = await apiClient.post(`${BASE}/matches/${matchId}/resolve/`);
    return response.data;
  },

  // --- Match notifications ---
  getMatchNotifications: async () => {
    const response = await apiClient.get(`${BASE}/notifications/`);
    return response.data?.results ?? response.data ?? [];
  },
  markMatchNotificationRead: async (id) => {
    const response = await apiClient.post(`${BASE}/notifications/${id}/mark_read/`);
    return response.data;
  },
  getMatchUnreadCount: async () => {
    const response = await apiClient.get(`${BASE}/notifications/unread_count/`);
    return response.data?.unread_count ?? 0;
  },
};
