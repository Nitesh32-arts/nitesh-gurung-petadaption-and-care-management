import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, FileText, MessageCircle, Star, Users, Edit, Trash2, AlertTriangle, CheckCircle, X, Download, FileCheck } from 'lucide-react';
import DashboardLayout from '../DashboardLayout';
import StatsCard from '../StatsCard';
import PetForm from '../PetForm';
import VerificationBanner from '../VerificationBanner';
import { useAuth } from '../../hooks/useAuth';
import { dashboardService, getPendingPrefetch } from '../../services/dashboardService';
import {
  petsService,
  adoptionRequestsService,
  lostFoundService,
  messagesService,
  dashboardStatsService,
} from '../../services/shelterService';

const CACHE_KEY_SHELTER = 'dashboard_shelter';

const ShelterDashboard = () => {
  const { user } = useAuth();
  const modalOpenRef = useRef(false);
  const [stats, setStats] = useState({
    totalPets: 0,
    availablePets: 0,
    pendingPets: 0,
    adoptedPets: 0,
    pendingAdoptionRequests: 0,
    messages: 0,
    lostFoundAlerts: 0,
  });
  const [pets, setPets] = useState([]);
  const [adoptionRequests, setAdoptionRequests] = useState([]);
  const [adoptionHistory, setAdoptionHistory] = useState([]);
  const [lostFoundReports, setLostFoundReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [showPetForm, setShowPetForm] = useState(false);
  const [editingPet, setEditingPet] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loadingCertificate, setLoadingCertificate] = useState(null);
  const [showMessages, setShowMessages] = useState(false);

  modalOpenRef.current = showPetForm || showMessages;

  const applyData = useCallback((data) => {
    setStats(data.stats || {});
    setPets(data.pets?.results || []);
    setAdoptionRequests(data.adoption_requests?.results || []);
    setAdoptionHistory(data.adoption_history || []);
    setLostFoundReports(data.lost_found_reports?.results || []);
  }, []);

  const fetchDashboardData = useCallback(async (showSpinner = true) => {
    const modalOpen = modalOpenRef.current;
    if (showSpinner && !modalOpen) {
      setLoading(true);
      setError(null);
    }
    try {
      const params = statusFilter !== 'all' ? { status: statusFilter } : {};
      const data = await dashboardService.getShelter(params);
      applyData(data);
      try {
        sessionStorage.setItem(
          `${CACHE_KEY_SHELTER}_${user?.id}_${statusFilter}`,
          JSON.stringify(data)
        );
      } catch (_) {}
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      if (!modalOpen) {
        if (err.response?.status === 403) {
          setError('Access denied. You must be a shelter user to view this dashboard.');
        } else if (err.response?.status === 401) {
          setError('Authentication required. Please log in again.');
        } else {
          setError('Failed to load dashboard data. Please refresh the page.');
        }
      }
    } finally {
      if (showSpinner && !modalOpen) setLoading(false);
    }
  }, [statusFilter, user?.id, applyData]);

  useEffect(() => {
    if (user && user.role !== 'shelter') {
      setError('Access denied. You must be a shelter user to view this dashboard.');
    }
  }, [user]);

  useEffect(() => {
    const key = `${CACHE_KEY_SHELTER}_${user?.id}_${statusFilter}`;
    const pending = statusFilter === 'all' ? getPendingPrefetch('shelter') : null;
    if (pending) {
      setLoading(true);
      pending.then((data) => {
        applyData(data);
        setLoading(false);
      }).catch(() => fetchDashboardData(true));
    } else {
      try {
        const cached = sessionStorage.getItem(key);
        if (cached) {
          const data = JSON.parse(cached);
          applyData(data);
          setLoading(false);
          fetchDashboardData(false);
        } else {
          fetchDashboardData(true);
        }
      } catch {
        fetchDashboardData(true);
      }
    }
    const interval = setInterval(() => fetchDashboardData(false), 30000);
    return () => clearInterval(interval);
  }, [statusFilter, fetchDashboardData, user?.id, applyData]);

  const handleAddPet = () => {
    setError(null);
    setEditingPet(null);
    setShowPetForm(true);
  };

  const handleEditPet = (pet) => {
    setError(null);
    setEditingPet(pet);
    setShowPetForm(true);
  };

  const handleDeletePet = async (petId) => {
    if (!window.confirm('Are you sure you want to delete this pet?')) return;

    try {
      await petsService.delete(petId);
      setSuccessMessage('Pet deleted successfully');
      await fetchDashboardData();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Failed to delete pet:', err);
      setError(err.response?.data?.detail || 'Failed to delete pet. Please try again.');
    }
  };

  const handleStatusChange = async (petId, newStatus) => {
    try {
      const pet = pets.find(p => p.id === petId);
      await petsService.update(petId, {
        ...pet,
        status: newStatus,
      });
      setSuccessMessage('Pet status updated successfully');
      await fetchDashboardData();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Failed to update status:', err);
      setError(err.response?.data?.detail || 'Failed to update pet status. Please try again.');
    }
  };

  const handleApproveRequest = async (requestId) => {
    try {
      await adoptionRequestsService.approve(requestId);
      setSuccessMessage('Adoption request accepted. Adopter has been notified. Complete adoption when the pet is handed over.');
      await fetchDashboardData();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Failed to approve request:', err);
      setError(err.response?.data?.detail || 'Failed to accept request. Please try again.');
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      await adoptionRequestsService.reject(requestId);
      setSuccessMessage('Adoption request rejected');
      await fetchDashboardData();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Failed to reject request:', err);
      setError(err.response?.data?.detail || 'Failed to reject request. Please try again.');
    }
  };

  const handleCompleteAdoption = async (requestId) => {
    try {
      await adoptionRequestsService.completeAdoption(requestId);
      setSuccessMessage('Adoption completed successfully');
      await fetchDashboardData();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Failed to complete adoption:', err);
      setError(err.response?.data?.detail || 'Failed to complete adoption. Please try again.');
    }
  };

  const handleDownloadCertificate = async (adoptionRequestId) => {
    setLoadingCertificate(adoptionRequestId);
    try {
      await adoptionRequestsService.downloadCertificate(adoptionRequestId);
      setSuccessMessage('Certificate downloaded successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to download certificate');
    } finally {
      setLoadingCertificate(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handlePetFormSuccess = () => {
    setShowPetForm(false);
    setEditingPet(null);
    fetchDashboardData();
  };

  const getStatusBadge = (status) => {
    const styles = {
      available: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      adopted: 'bg-gray-100 text-gray-800',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status?.charAt(0).toUpperCase() + status?.slice(1)}
      </span>
    );
  };

  if (loading && pets.length === 0 && adoptionRequests.length === 0) {
    return (
      <DashboardLayout
        title="Shelter Dashboard"
        subtitle="Manage your shelter operations and pet adoptions."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-20 bg-gray-100 animate-pulse rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-lg" />
            ))}
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-100 animate-pulse rounded-lg" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Shelter Dashboard"
      subtitle="Manage your shelter operations and pet adoptions."
    >
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-700 hover:text-red-900">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            {successMessage}
          </span>
          <button onClick={() => setSuccessMessage(null)} className="text-green-700 hover:text-green-900">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Stats Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard
          title="Total Pets"
          value={stats.totalPets}
          icon={Users}
        />
        <StatsCard
          title="Available Pets"
          value={stats.availablePets}
          icon={Users}
          iconBg="bg-green-100"
        />
        <StatsCard
          title="Pending Requests"
          value={stats.pendingAdoptionRequests}
          icon={FileText}
          iconBg="bg-yellow-100"
        />
        <StatsCard
          title="Adopted Pets"
          value={stats.adoptedPets}
          icon={CheckCircle}
          iconBg="bg-blue-100"
        />
        {stats.lostFoundAlerts > 0 && (
          <StatsCard
            title="Lost/Found Alerts"
            value={stats.lostFoundAlerts}
            icon={AlertTriangle}
            iconBg="bg-red-100"
          />
        )}
        <StatsCard
          title="Messages"
          value={stats.messages}
          icon={MessageCircle}
          iconBg="bg-purple-100"
          onClick={() => {
            setError(null);
            window.dispatchEvent(new CustomEvent('openChat'));
          }}
        />
      </section>

      <VerificationBanner user={user} />

      {/* Pet Management Section */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Pet Management</h2>
          <div className="flex items-center gap-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Status</option>
              <option value="available">Available</option>
              <option value="pending">Pending</option>
              <option value="adopted">Adopted</option>
            </select>
            <button
              onClick={handleAddPet}
              disabled={!user?.is_verified}
              title={!user?.is_verified ? 'Account pending verification approval.' : undefined}
              className="bg-primary text-white px-6 py-2 rounded-lg font-semibold hover:bg-emerald-600 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-5 h-5" />
              Add New Pet
            </button>
          </div>
        </div>

        {/* Pets Grid */}
        {loading ? (
          <p className="text-center py-8 text-gray-600">Loading pets...</p>
        ) : pets.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">No pets added yet.</p>
            <button
              onClick={handleAddPet}
              disabled={!user?.is_verified}
              title={!user?.is_verified ? 'Account pending verification approval.' : undefined}
              className="bg-primary text-white px-6 py-2 rounded-lg font-semibold hover:bg-emerald-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Your First Pet
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pets.map((pet) => (
              <div key={pet.id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition">
                <div className="relative">
                  {pet.primary_image ? (
                    <img
                      src={pet.primary_image}
                      alt={pet.name}
                      className="w-full h-48 object-cover"
                    />
                  ) : (
                    <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
                      <Users className="w-16 h-16 text-gray-400" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    {getStatusBadge(pet.status)}
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{pet.name}</h3>
                  <p className="text-sm text-gray-600 mb-2">{pet.breed} • {pet.age} months</p>
                  <p className="text-xs text-gray-500 mb-4 line-clamp-2">{pet.description}</p>
                  
                  <div className="flex items-center justify-between">
                    <select
                      value={pet.status}
                      onChange={(e) => handleStatusChange(pet.id, e.target.value)}
                      disabled={!user?.is_verified}
                      className="text-xs px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="available">Available</option>
                      <option value="pending">Pending</option>
                      <option value="adopted">Adopted</option>
                    </select>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditPet(pet)}
                        disabled={!user?.is_verified}
                        title={!user?.is_verified ? 'Account pending verification approval.' : 'Edit'}
                        className="p-2 text-primary hover:bg-primary/10 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeletePet(pet.id)}
                        disabled={!user?.is_verified}
                        title={!user?.is_verified ? 'Account pending verification approval.' : 'Delete'}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Adoption Requests */}
      <section className="mt-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Adoption Requests</h2>
        <div className="bg-white rounded-xl shadow-md p-6">
          {loading ? (
            <p className="text-sm text-gray-600">Loading...</p>
          ) : adoptionRequests.length === 0 ? (
            <p className="text-sm text-gray-600">No adoption requests.</p>
          ) : (
            <div className="space-y-3">
              {adoptionRequests.map((request) => {
                const adopterName = request.adopter?.name ?? request.adopter_info?.first_name ?? request.adopter_info?.username ?? 'Adopter';
                const adopterEmail = request.adopter?.email ?? request.adopter_info?.email ?? '';
                const requestDate = request.created_at ?? request.request_date;
                const statusLabel = request.status ? request.status.charAt(0).toUpperCase() + request.status.slice(1) : 'Pending';
                const statusStyles = {
                  pending: 'bg-yellow-100 text-yellow-800',
                  updated: 'bg-blue-100 text-blue-800',
                  approved: 'bg-green-100 text-green-800',
                  adopted: 'bg-green-100 text-green-800',
                  rejected: 'bg-red-100 text-red-800',
                };
                return (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      {request.pet?.primary_image && (
                        <img
                          src={request.pet.primary_image}
                          alt={request.pet.name}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      )}
                      <div>
                        <p className="font-medium text-gray-900">
                          {request.pet?.name || 'Pet'}
                        </p>
                        <p className="text-sm text-gray-700 mt-0.5">
                          Adopter: <span className="font-medium">{adopterName}</span>
                        </p>
                        <p className="text-sm text-gray-600">
                          Requested by: <a href={`mailto:${adopterEmail}`} className="text-primary hover:underline">{adopterEmail || '—'}</a>
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {requestDate ? new Date(requestDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                        </p>
                        {request.notes && (
                          <p className="text-xs text-gray-400 mt-1">{request.notes}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusStyles[request.status] ?? statusStyles.pending}`}>
                        {statusLabel}
                      </span>
                      {(request.adopter?.id ?? request.adopter_info?.id) && (
                        <button
                          type="button"
                          onClick={() => window.dispatchEvent(new CustomEvent('openChat', { detail: { userId: request.adopter?.id ?? request.adopter_info.id, petId: request.pet?.id, name: adopterName } }))}
                          className="flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20"
                        >
                          <MessageCircle className="w-4 h-4" />
                          Message
                        </button>
                      )}
                      {request.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApproveRequest(request.id)}
                            disabled={!user?.is_verified}
                            title={!user?.is_verified ? 'Account pending verification approval.' : undefined}
                            className="px-4 py-1 bg-green-100 text-green-800 rounded-lg text-sm font-medium hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleRejectRequest(request.id)}
                            disabled={!user?.is_verified}
                            title={!user?.is_verified ? 'Account pending verification approval.' : undefined}
                            className="px-4 py-1 bg-red-100 text-red-800 rounded-lg text-sm font-medium hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {request.status === 'updated' && (
                        <button
                          onClick={() => handleCompleteAdoption(request.id)}
                          disabled={!user?.is_verified}
                          title={!user?.is_verified ? 'Account pending verification approval.' : undefined}
                          className="px-4 py-1 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Complete adoption
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Adoption Statistics */}
      {adoptionHistory.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Adoption Statistics</h2>
          <div className="bg-white rounded-xl shadow-md p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-3xl font-bold text-blue-600">{adoptionHistory.length}</p>
                <p className="text-sm text-gray-600 mt-1">Total Adoptions</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-3xl font-bold text-green-600">
                  {adoptionHistory.filter(a => {
                    const date = new Date(a.reviewed_date || a.request_date);
                    const monthAgo = new Date();
                    monthAgo.setMonth(monthAgo.getMonth() - 1);
                    return date > monthAgo;
                  }).length}
                </p>
                <p className="text-sm text-gray-600 mt-1">This Month</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-3xl font-bold text-purple-600">
                  {adoptionHistory.filter(a => {
                    const date = new Date(a.reviewed_date || a.request_date);
                    const weekAgo = new Date();
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    return date > weekAgo;
                  }).length}
                </p>
                <p className="text-sm text-gray-600 mt-1">This Week</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Adoption Records */}
      <section className="mt-6">
        <div className="flex items-center gap-2 mb-4">
          <FileCheck className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">Adoption Records</h2>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl shadow-md p-6">
          {loading ? (
            <p className="text-sm text-gray-600">Loading...</p>
          ) : adoptionHistory.length === 0 ? (
            <p className="text-sm text-gray-600">No completed adoptions yet.</p>
          ) : (
            <div className="space-y-3">
              {adoptionHistory.map((adoption) => (
                <div
                  key={adoption.id}
                  className="flex items-center justify-between p-4 bg-white border border-blue-100 rounded-lg hover:bg-blue-50 transition"
                >
                  <div className="flex items-center gap-3 flex-1">
                    {adoption.pet?.primary_image && (
                      <img
                        src={adoption.pet.primary_image}
                        alt={adoption.pet.name}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                    )}
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">
                        {adoption.pet?.name || 'Pet'}
                      </p>
                      <p className="text-xs text-gray-700 font-medium">
                        Adopter: {adoption.adopter?.name ?? adoption.adopter_info?.first_name ?? adoption.adopter_info?.username ?? 'N/A'}
                      </p>
                      {(adoption.adopter?.email ?? adoption.adopter_info?.email) && (
                        <p className="text-xs text-gray-600">
                          Email: {adoption.adopter?.email ?? adoption.adopter_info?.email}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        Requested: {formatDate(adoption.request_date)} • Adopted: {formatDate(adoption.adopted_date || adoption.reviewed_date || adoption.request_date)}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {adoption.pet?.breed} • {adoption.pet?.age} months
                      </p>
                      {adoption.notes && (
                        <p className="text-xs text-gray-500 mt-1 italic border-l-2 border-blue-200 pl-2">
                          Notes: {adoption.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(adoption.adopter?.id ?? adoption.adopter_info?.id) && (
                      <button
                        type="button"
                        onClick={() => window.dispatchEvent(new CustomEvent('openChat', { detail: { userId: adoption.adopter?.id ?? adoption.adopter_info.id, petId: adoption.pet?.id, name: adoption.adopter?.name ?? adoption.adopter_info?.first_name ?? adoption.adopter_info?.username } }))}
                        className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20"
                      >
                        <MessageCircle className="w-4 h-4" />
                        Message Adopter
                      </button>
                    )}
                    <button
                      onClick={() => handleDownloadCertificate(adoption.id)}
                      disabled={loadingCertificate === adoption.id}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loadingCertificate === adoption.id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Downloading...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          <span>Download Record</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Lost & Found Section (if applicable) */}
      {lostFoundReports.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Active Lost Pet Reports</h2>
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="space-y-3">
              {lostFoundReports.slice(0, 5).map((report) => (
                <div
                  key={report.id}
                  className="p-3 border border-gray-100 rounded-lg hover:bg-gray-50"
                >
                  <p className="font-medium text-gray-900">{report.pet_info?.name ?? report.pet?.name ?? 'Lost pet'}</p>
                  <p className="text-xs text-gray-500">
                    {report.pet_info?.pet_type ?? report.pet?.pet_type ?? '—'} • Last seen: {report.last_seen_date ? new Date(report.last_seen_date).toLocaleDateString() : '—'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{report.last_seen_location}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Pet Form Modal */}
      {showPetForm && (
        <PetForm
          pet={editingPet}
          onClose={() => {
            setError(null);
            setShowPetForm(false);
            setEditingPet(null);
          }}
          onSuccess={handlePetFormSuccess}
        />
      )}

      {/* Chat: global popup via bottom-right icon (openChat) */}
    </DashboardLayout>
  );
};

export default ShelterDashboard;

