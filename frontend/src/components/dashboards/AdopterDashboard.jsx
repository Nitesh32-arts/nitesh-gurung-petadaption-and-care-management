import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  FileText, Heart, MessageCircle, Trophy, ShoppingBag,
  AlertTriangle, Search, Shield, X, CheckCircle, Download, Stethoscope
} from 'lucide-react';
import DashboardLayout from '../DashboardLayout';
import StatsCard from '../StatsCard';
import { dashboardService, getPendingPrefetch } from '../../services/dashboardService';
import {
  adoptionRequestsService,
  adoptedPetsService,
  savedPetsService,
  rewardsService,
  messagesService,
  lostPetService,
  healthRecordsService,
  storeOrdersService,
} from '../../services/adopterService';
import { storeService } from '../../services/storeService';

const CACHE_KEY_ADOPTER = 'dashboard_adopter';

const AdopterDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState({
    adoptionRequests: { total: 0, pending: 0, approved: 0, rejected: 0 },
    savedPets: 0,
    messages: 0,
    rewardsPoints: 0,
    adoptedPets: 0,
  });
  const [adoptionRequests, setAdoptionRequests] = useState([]);
  const [adoptedPets, setAdoptedPets] = useState([]);
  const [adoptionHistory, setAdoptionHistory] = useState([]);
  const [savedPets, setSavedPets] = useState([]);
  const [healthReminders, setHealthReminders] = useState([]);
  const [petHealthRecords, setPetHealthRecords] = useState({}); // {petId: [records]}
  const [lostPetReports, setLostPetReports] = useState([]);
  const [storeOrders, setStoreOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [loadingCertificate, setLoadingCertificate] = useState(null);
  const [showMessages, setShowMessages] = useState(false);
  const [storeRecommendations, setStoreRecommendations] = useState([]);

  const applyData = useCallback((data) => {
    const requests = data.adoption_requests || [];
    setAdoptionRequests(requests);
    setStats(prev => ({
      ...prev,
      adoptionRequests: {
        total: requests.length,
        pending: requests.filter(r => r.status === 'pending').length,
        approved: requests.filter(r => r.status === 'approved' || r.status === 'adopted').length,
        rejected: requests.filter(r => r.status === 'rejected').length,
      },
      messages: data.messages_unread_count ?? 0,
      rewardsPoints: data.rewards_points ?? 0,
      adoptedPets: (data.adopted_pets || []).length,
      savedPets: (data.saved_pets || []).length,
    }));
    setAdoptedPets(data.adopted_pets || []);
    setSavedPets(data.saved_pets || []);
    setLostPetReports(data.lost_reports || []);
    setStoreOrders(data.store_orders || []);
    setAdoptionHistory(data.adoption_history || []);
    setHealthReminders([
      ...(data.upcoming_reminders || []),
      ...(data.overdue_reminders || []),
    ]);
    const healthRecords = data.health_records || [];
    const recordsByPet = {};
    healthRecords.forEach(record => {
      const petId = record.pet || record.pet_info?.id;
      if (petId) {
        if (!recordsByPet[petId]) recordsByPet[petId] = [];
        recordsByPet[petId].push(record);
      }
    });
    setPetHealthRecords(recordsByPet);
  }, []);

  const fetchDashboardData = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const data = await dashboardService.getAdopter();
      applyData(data);
      try {
        sessionStorage.setItem(`${CACHE_KEY_ADOPTER}_${user?.id}`, JSON.stringify(data));
      } catch (_) {}
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      if (err.response?.status === 403) {
        setError('Access denied. You must be an adopter to view this dashboard.');
      } else if (err.response?.status === 401) {
        setError('Authentication required. Please log in again.');
        setTimeout(() => navigate('/login'), 2000);
      } else {
        setError('Failed to load dashboard data. Please refresh the page.');
      }
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [navigate, user?.id, applyData]);

  useEffect(() => {
    const key = `${CACHE_KEY_ADOPTER}_${user?.id}`;
    const pending = getPendingPrefetch('adopter');
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
  }, [fetchDashboardData, user?.id, applyData]);

  useEffect(() => {
    if (adoptedPets.length === 0) return;
    storeService.getRecommendations(['Food', 'Grooming', 'Accessories']).then(setStoreRecommendations).catch(() => setStoreRecommendations([]));
  }, [adoptedPets.length]);

  const handleSavePet = async (petId) => {
    try {
      const isAlreadySaved = await savedPetsService.isSaved(petId);
      if (isAlreadySaved) {
        const savedPet = savedPets.find(sp => sp.pet?.id === petId);
        if (savedPet) {
          await savedPetsService.unsave(savedPet.id);
          setSuccessMessage('Pet removed from saved list');
        }
      } else {
        await savedPetsService.save(petId);
        setSuccessMessage('Pet saved successfully');
      }
      await fetchDashboardData();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save/unsave pet');
    }
  };

  const handleSubmitAdoptionRequest = async (petId) => {
    try {
      // Check for existing request
      const hasExisting = await adoptionRequestsService.checkExisting(petId);
      if (hasExisting) {
        setError('You already have a pending adoption request for this pet');
        return;
      }

      await adoptionRequestsService.create(petId);
      setSuccessMessage('Adoption request submitted successfully!');
      await fetchDashboardData();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit adoption request');
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

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status?.charAt(0).toUpperCase() + status?.slice(1)}
      </span>
    );
  };

  if (loading && adoptionRequests.length === 0 && adoptedPets.length === 0) {
    return (
      <DashboardLayout
        title="Adopter Dashboard"
        subtitle="Welcome back! Manage your pet adoptions and activities."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-lg" />
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
      title="Adopter Dashboard"
      subtitle="Welcome back! Manage your pet adoptions and activities."
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
          title="Adoption Requests"
          value={stats.adoptionRequests.total}
          icon={FileText}
        />
        <StatsCard
          title="Saved Pets"
          value={stats.savedPets}
          icon={Heart}
        />
        <StatsCard
          title="Unread Messages"
          value={stats.messages}
          icon={MessageCircle}
          onClick={() => window.dispatchEvent(new CustomEvent('openChat'))}
          iconBg="bg-blue-100"
        />
        <StatsCard
          title="Rewards Points"
          value={stats.rewardsPoints}
          icon={Trophy}
          iconBg="bg-yellow-100"
        />
      </section>

      {/* Quick Actions */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <button
          onClick={() => navigate('/browse')}
          className="bg-white rounded-xl shadow-md p-4 hover:shadow-lg transition text-left"
        >
          <Search className="w-8 h-8 text-primary mb-2" />
          <h3 className="font-semibold text-gray-900">Browse Pets</h3>
          <p className="text-sm text-gray-600">Find your perfect companion</p>
        </button>
        <button
          onClick={() => navigate('/store')}
          className="bg-white rounded-xl shadow-md p-4 hover:shadow-lg transition text-left"
        >
          <ShoppingBag className="w-8 h-8 text-primary mb-2" />
          <h3 className="font-semibold text-gray-900">Pet Store</h3>
          <p className="text-sm text-gray-600">Shop for pet supplies</p>
        </button>
        <button
          onClick={() => navigate('/lost-found')}
          className="bg-white rounded-xl shadow-md p-4 hover:shadow-lg transition text-left"
        >
          <AlertTriangle className="w-8 h-8 text-primary mb-2" />
          <h3 className="font-semibold text-gray-900">Report Lost Pet</h3>
          <p className="text-sm text-gray-600">Help find missing pets</p>
        </button>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('openChat'))}
          className="bg-white rounded-xl shadow-md p-4 hover:shadow-lg transition text-left"
        >
          <MessageCircle className="w-8 h-8 text-primary mb-2" />
          <h3 className="font-semibold text-gray-900">Messages</h3>
          <p className="text-sm text-gray-600">Chat with shelters</p>
        </button>
      </section>

      {/* Adoption upsell: recommended products when user has adopted pets */}
      {adoptedPets.length > 0 && (
        <section className="mb-6 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl shadow-md p-6 border border-emerald-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Recommended for your new pet</h2>
          <p className="text-sm text-gray-600 mb-4">Starter food, grooming supplies, and bedding for your adopted companion.</p>
          {storeRecommendations.length === 0 ? (
            <Link to="/store" className="text-primary font-medium hover:underline">Browse pet supplies →</Link>
          ) : (
            <div className="flex flex-wrap gap-4">
              {storeRecommendations.slice(0, 4).map((p) => (
                <Link key={p.id} to="/store" className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-100 hover:shadow-md min-w-[180px]">
                  {p.image ? <img src={p.image.startsWith('http') ? p.image : `/media/${p.image}`} alt={p.name} className="w-12 h-12 object-cover rounded" /> : null}
                  <div>
                    <p className="font-medium text-gray-900 truncate max-w-[140px]">{p.name}</p>
                    <p className="text-primary font-semibold">${p.price}</p>
                  </div>
                </Link>
              ))}
              <Link to="/store" className="flex items-center justify-center p-3 bg-white rounded-lg border border-primary text-primary font-medium hover:bg-emerald-50 min-w-[120px]">
                View all →
              </Link>
            </div>
          )}
        </section>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Adoption Requests List */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                My Adoption Requests
              </h2>
              <button
                onClick={() => navigate('/browse')}
                className="text-sm text-primary hover:underline"
              >
                Browse More
              </button>
            </div>
            {loading ? (
              <p className="text-sm text-gray-600">Loading...</p>
            ) : adoptionRequests.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-600">No adoption requests yet.</p>
                <button
                  onClick={() => navigate('/browse')}
                  className="mt-4 text-primary hover:underline text-sm font-medium"
                >
                  Start browsing pets
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {adoptionRequests.slice(0, 5).map((request) => (
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
                        <p className="text-xs text-gray-500">
                          {request.shelter_info?.username || request.shelter?.username || 'Shelter'} • {formatDate(request.request_date || request.created_at)}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(request.status)}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Adoption History */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Adoption History
            </h2>
            {loading ? (
              <p className="text-sm text-gray-600">Loading...</p>
            ) : adoptionHistory.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-600">No completed adoptions yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {adoptionHistory.map((adoption) => (
                  <div
                    key={adoption.id}
                    className="flex items-center justify-between p-4 border border-gray-100 rounded-lg hover:bg-gray-50"
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
                        <p className="text-xs text-gray-500">
                          {adoption.shelter_info?.username || 'Shelter'} • Adopted: {formatDate(adoption.adopted_date || adoption.reviewed_date || adoption.request_date)}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {adoption.pet?.breed} • {adoption.pet?.age} months
                        </p>
                        {(adoption.status === 'approved' || adoption.status === 'adopted') && (
                          <span className="inline-block mt-1 text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">Adoption confirmed</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDownloadCertificate(adoption.id)}
                      disabled={loadingCertificate === adoption.id}
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loadingCertificate === adoption.id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Downloading...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          <span>Certificate</span>
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Adopted Pets */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              My Adopted Pets
            </h2>
            {loading ? (
              <p className="text-sm text-gray-600">Loading...</p>
            ) : adoptedPets.length === 0 ? (
              <div className="text-center py-8">
                <Heart className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-600">No adopted pets yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {adoptedPets.map((pet) => (
                  <div
                    key={pet.id}
                    className="border border-gray-100 rounded-lg p-4 hover:shadow-md transition"
                  >
                    <img
                      src={pet.primary_image || (pet.images?.[0]?.image_url) || 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&q=80'}
                      alt={pet.name}
                      className="w-full h-32 object-cover rounded-lg mb-2"
                    />
                    <h3 className="font-semibold text-gray-900">{pet.name}</h3>
                    <p className="text-xs text-gray-500">{pet.breed || '—'}</p>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => navigate(`/pets/${pet.id}`)}
                        className="text-xs text-primary hover:underline"
                      >
                        View Health Records
                      </button>
                      {(petHealthRecords[pet.id] || []).some((r) => r.veterinarian_info?.id) && (
                        <button
                          type="button"
                          onClick={() => {
                            const firstVet = (petHealthRecords[pet.id] || []).find((r) => r.veterinarian_info?.id);
                            if (firstVet?.veterinarian_info?.id) {
                              window.dispatchEvent(new CustomEvent('openChat', {
                                detail: {
                                  userId: firstVet.veterinarian_info.id,
                                  petId: pet.id,
                                  name: firstVet.veterinarian_info.username,
                                },
                              }));
                            }
                          }}
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          Message Vet
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pet Health History */}
          {adoptedPets.length > 0 && Object.keys(petHealthRecords).length > 0 && (
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-primary" />
                Pet Health History
              </h2>
              <div className="space-y-4">
                {adoptedPets.map(pet => {
                  const records = petHealthRecords[pet.id] || [];
                  if (records.length === 0) return null;
                  
                  return (
                    <div key={pet.id} className="border border-gray-100 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-2">{pet.name}</h3>
                      <div className="space-y-2">
                        {records.map(record => (
                          <div key={record.id} className="text-sm border-l-2 border-primary pl-3">
                            <p className="font-medium text-gray-900">{record.title}</p>
                            <p className="text-xs text-gray-500">
                              {record.record_type} • {formatDate(record.date)}
                            </p>
                            {record.veterinarian_info && (
                              <p className="text-xs text-gray-400 flex items-center gap-2 flex-wrap">
                                <span>Vet: {record.veterinarian_info.username}</span>
                                {record.veterinarian_info.id && (
                                  <button
                                    type="button"
                                    onClick={() => window.dispatchEvent(new CustomEvent('openChat', {
                                      detail: {
                                        userId: record.veterinarian_info.id,
                                        petId: pet.id,
                                        name: record.veterinarian_info.username,
                                      },
                                    }))}
                                    className="flex items-center gap-1 text-primary hover:underline"
                                  >
                                    <MessageCircle className="w-3.5 h-3.5" />
                                    Message Vet
                                  </button>
                                )}
                              </p>
                            )}
                            {record.vaccination && (
                              <p className="text-xs text-blue-600 mt-1">
                                Vaccination: {record.vaccination.vaccine_name}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Saved Pets */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Saved Pets
              </h2>
              <button
                onClick={() => navigate('/browse')}
                className="text-sm text-primary hover:underline"
              >
                Browse More
              </button>
            </div>
            {loading ? (
              <p className="text-sm text-gray-600">Loading...</p>
            ) : savedPets.length === 0 ? (
              <div className="text-center py-8">
                <Heart className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-600">No saved pets yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {savedPets.slice(0, 6).map((savedPet) => (
                  <div
                    key={savedPet.id}
                    className="relative border border-gray-100 rounded-lg p-3 hover:shadow-md transition"
                  >
                    {savedPet.pet?.primary_image && (
                      <img
                        src={savedPet.pet.primary_image}
                        alt={savedPet.pet.name}
                        className="w-full h-24 object-cover rounded-lg mb-2"
                      />
                    )}
                    <h3 className="font-semibold text-sm text-gray-900">{savedPet.pet?.name}</h3>
                    <button
                      onClick={() => handleSavePet(savedPet.pet.id)}
                      className="mt-2 text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lost Pet Reports */}
          {lostPetReports.length > 0 && (
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                My Lost Pet Reports
              </h2>
              <div className="space-y-3">
                {lostPetReports.slice(0, 3).map((report) => (
                  <div
                    key={report.id}
                    className="flex items-center justify-between p-3 border border-gray-100 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{report.pet_info?.name ?? report.pet?.name ?? 'Lost pet'}</p>
                      <p className="text-xs text-gray-500">
                        {formatDate(report.last_seen_date)} • {report.status}
                      </p>
                    </div>
                    {getStatusBadge(report.status)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Store Orders */}
          {storeOrders.length > 0 && (
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Recent Orders
              </h2>
              <div className="space-y-3">
                {storeOrders.slice(0, 3).map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-3 border border-gray-100 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">Order #{order.id}</p>
                      <p className="text-xs text-gray-500">
                        {formatDate(order.created_at)} • ${order.total_price || '0.00'}
                      </p>
                    </div>
                    {getStatusBadge(order.status)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Rewards & Badges */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Rewards & Badges
            </h2>
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-6 h-6 text-yellow-500" />
              <span className="text-2xl font-bold text-gray-900">
                {stats.rewardsPoints}
              </span>
              <span className="text-sm text-gray-600">points</span>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Earn points by adopting pets and engaging with the community!
            </p>
            <button
              onClick={() => navigate('/rewards')}
              className="text-sm text-primary hover:underline"
            >
              View Rewards History
            </button>
          </div>

          {/* Health Reminders */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Health Reminders
            </h2>
            {healthReminders.length === 0 ? (
              <p className="text-sm text-gray-600">No upcoming reminders.</p>
            ) : (
              <div className="space-y-3">
                {healthReminders.slice(0, 5).map((reminder) => (
                  <div
                    key={reminder.id}
                    className={`p-3 rounded-lg border ${
                      reminder.is_overdue 
                        ? 'bg-red-50 border-red-200' 
                        : reminder.is_due_soon 
                        ? 'bg-yellow-50 border-yellow-200' 
                        : 'bg-blue-50 border-blue-100'
                    }`}
                  >
                    <p className="text-sm font-medium text-gray-900">{reminder.title}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      Due: {formatDate(reminder.due_date)}
                      {reminder.is_overdue && (
                        <span className="ml-2 text-red-600 font-semibold">OVERDUE</span>
                      )}
                    </p>
                    {reminder.pet && (
                      <p className="text-xs text-gray-500 mt-1">
                        Pet: {reminder.pet.name || reminder.pet_info?.name}
                      </p>
                    )}
                    {reminder.description && (
                      <p className="text-xs text-gray-400 mt-1">{reminder.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chat: global popup via bottom-right icon (openChat) */}
    </DashboardLayout>
  );
};

export default AdopterDashboard;

