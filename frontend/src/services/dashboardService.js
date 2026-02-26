/**
 * Single-request dashboard API. One GET per role returns all dashboard data.
 */
import apiClient from '../apiClient';

/** Pending prefetch promises so dashboards can await in-flight prefetch instead of starting a new request. */
const pendingPrefetch = { vet: null, adopter: null, shelter: null, admin: null };

const CACHE_KEYS = { veterinarian: 'dashboard_vet', adopter: 'dashboard_adopter', shelter: 'dashboard_shelter', admin: 'dashboard_admin' };

/** Start prefetch after login/register. Fire-and-forget; writes to sessionStorage on success. */
export function prefetchDashboard(user) {
  if (!user?.id || !user?.role) return;
  const role = user.role;
  const key = role === 'veterinarian' ? 'vet' : role === 'adopter' ? 'adopter' : role === 'shelter' ? 'shelter' : 'admin';
  if (pendingPrefetch[key]) return;
  const base = CACHE_KEYS[role] || CACHE_KEYS.adopter;
  const cacheKey = role === 'shelter' ? `${base}_${user.id}_all` : `${base}_${user.id}`;
  const p = (role === 'veterinarian' ? dashboardService.getVeterinarian() :
    role === 'adopter' ? dashboardService.getAdopter() :
    role === 'shelter' ? dashboardService.getShelter() :
    dashboardService.getAdmin())
    .then((data) => {
      try { sessionStorage.setItem(cacheKey, JSON.stringify(data)); } catch (_) {}
      pendingPrefetch[key] = null;
      return data;
    })
    .catch(() => { pendingPrefetch[key] = null; });
  pendingPrefetch[key] = p;
}

/** Get pending prefetch promise for a role so dashboards can await it. */
export function getPendingPrefetch(role) {
  const key = role === 'veterinarian' ? 'vet' : role === 'adopter' ? 'adopter' : role === 'shelter' ? 'shelter' : 'admin';
  return pendingPrefetch[key] || null;
}

export const dashboardService = {
  getAdopter: async () => {
    const response = await apiClient.get('/dashboard/adopter/');
    return response.data;
  },

  getVeterinarian: async () => {
    const response = await apiClient.get('/dashboard/veterinarian/');
    return response.data;
  },

  getShelter: async (params = {}) => {
    const response = await apiClient.get('/dashboard/shelter/', { params });
    return response.data;
  },

  getAdmin: async () => {
    const response = await apiClient.get('/dashboard/admin/');
    return response.data;
  },
};
