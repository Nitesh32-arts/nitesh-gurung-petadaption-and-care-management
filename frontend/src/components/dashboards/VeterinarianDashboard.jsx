import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  Stethoscope, Calendar, FileText, MessageCircle, Plus,
  Edit, Trash2, Shield, AlertCircle, CheckCircle, X
} from 'lucide-react';
import DashboardLayout from '../DashboardLayout';
import StatsCard from '../StatsCard';
import VerificationBanner from '../VerificationBanner';
import MedicalRecordModal from '../veterinarian/MedicalRecordModal';
import HealthReminderModal from '../veterinarian/HealthReminderModal';
import { dashboardService, getPendingPrefetch } from '../../services/dashboardService';
import {
  medicalRecordsService,
  healthRemindersService,
  assignedPetsService,
  messagesService,
  petsService,
} from '../../services/veterinarianService';

const CACHE_KEY_VET = 'dashboard_vet';

const VeterinarianDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState({
    assignedPets: 0,
    upcomingReminders: 0,
    healthRecords: 0,
    messages: 0,
  });
  const [assignedPets, setAssignedPets] = useState([]);
  const [allPets, setAllPets] = useState([]);
  const [healthRecords, setHealthRecords] = useState([]);
  const [upcomingReminders, setUpcomingReminders] = useState([]);
  const [overdueReminders, setOverdueReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [selectedPet, setSelectedPet] = useState(null);

  const applyData = useCallback((data) => {
    const assigned = data.assigned_pets?.results || [];
    const records = data.health_records?.results || [];
    const upcoming = data.upcoming_reminders || [];
    const overdue = data.overdue_reminders || [];
    setAssignedPets(assigned);
    setAllPets(prev => (prev.length === 0 ? assigned : prev));
    setHealthRecords(records);
    setUpcomingReminders(upcoming);
    setOverdueReminders(overdue);
    setStats(prev => ({
      ...prev,
      assignedPets: data.assigned_pets?.count ?? assigned.length,
      healthRecords: data.health_records?.count ?? records.length,
      upcomingReminders: upcoming.length,
      messages: data.messages_unread_count ?? 0,
    }));
  }, []);

  const fetchData = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const data = await dashboardService.getVeterinarian();
      applyData(data);
      try {
        sessionStorage.setItem(`${CACHE_KEY_VET}_${user?.id}`, JSON.stringify(data));
      } catch (_) {}
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      if (err.response?.status === 403) {
        setError('Access denied. You must be a veterinarian to view this dashboard.');
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
    const key = `${CACHE_KEY_VET}_${user?.id}`;
    const pending = getPendingPrefetch('veterinarian');
    if (pending) {
      setLoading(true);
      pending.then((data) => {
        applyData(data);
        setLoading(false);
      }).catch(() => fetchData(true));
    } else {
      try {
        const cached = sessionStorage.getItem(key);
        if (cached) {
          const data = JSON.parse(cached);
          applyData(data);
          setLoading(false);
          fetchData(false);
        } else {
          fetchData(true);
        }
      } catch {
        fetchData(true);
      }
    }
    const interval = setInterval(() => fetchData(false), 30000);
    return () => clearInterval(interval);
  }, [fetchData, user?.id, applyData]);

  // Lazy-load full pet list when "Create record" modal opens (faster initial dashboard)
  useEffect(() => {
    if (!showRecordForm) return;
    let cancelled = false;
    petsService.getAll()
      .then((res) => {
        if (!cancelled) {
          setAllPets(res.results || []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAllPets([]);
        }
      });
    return () => { cancelled = true; };
  }, [showRecordForm]);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleDeleteRecord = async (recordId) => {
    if (!window.confirm('Are you sure you want to delete this medical record?')) {
      return;
    }
    const prevRecords = healthRecords;
    setHealthRecords((r) => r.filter((rec) => rec.id !== recordId));
    setStats((s) => ({ ...s, healthRecords: Math.max(0, s.healthRecords - 1) }));
    try {
      await medicalRecordsService.delete(recordId);
      setSuccessMessage('Medical record deleted successfully');
      fetchData(false);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setHealthRecords(prevRecords);
      setStats((s) => ({ ...s, healthRecords: prevRecords.length }));
      setError(err.response?.data?.detail || 'Failed to delete medical record');
    }
  };

  const handleMarkReminderCompleted = async (reminderId) => {
    setUpcomingReminders((r) => r.filter((x) => x.id !== reminderId));
    setOverdueReminders((r) => r.filter((x) => x.id !== reminderId));
    setStats((s) => ({ ...s, upcomingReminders: Math.max(0, s.upcomingReminders - 1) }));
    try {
      await healthRemindersService.markCompleted(reminderId);
      setSuccessMessage('Reminder marked as completed');
      fetchData(false);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      fetchData(false);
      setError(err.response?.data?.detail || 'Failed to update reminder');
    }
  };

  const SkeletonCard = () => (
    <div className="h-24 bg-gray-100 animate-pulse rounded-xl" />
  );
  const SkeletonRow = () => (
    <div className="h-12 bg-gray-100 animate-pulse rounded-lg" />
  );

  if (loading && assignedPets.length === 0 && healthRecords.length === 0) {
    return (
      <DashboardLayout
        title="Veterinarian Dashboard"
        subtitle="Manage pet health records and veterinary care."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow />
          </div>
          <div className="space-y-4">
            <SkeletonRow /><SkeletonRow /><SkeletonRow />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Veterinarian Dashboard"
      subtitle="Manage pet health records and veterinary care."
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

      <VerificationBanner user={user} />

      {/* Stats Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard
          title="Assigned Pets"
          value={stats.assignedPets}
          icon={Stethoscope}
        />
        <StatsCard
          title="Upcoming Reminders"
          value={stats.upcomingReminders}
          icon={Calendar}
          iconBg="bg-blue-100"
        />
        <StatsCard
          title="Health Records"
          value={stats.healthRecords}
          icon={FileText}
          iconBg="bg-green-100"
        />
        <StatsCard
          title="Unread Messages"
          value={stats.messages}
          icon={MessageCircle}
          iconBg="bg-purple-100"
        />
      </section>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Assigned Pets */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Assigned Pets
              </h2>
              <button
                onClick={() => navigate('/browse')}
                disabled={!user?.is_verified}
                title={!user?.is_verified ? 'Account pending verification approval.' : undefined}
                className="text-sm text-primary hover:underline flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                Add New Pet Record
              </button>
            </div>
            {loading ? (
              <p className="text-sm text-gray-600">Loading...</p>
            ) : assignedPets.length === 0 ? (
              <div className="text-center py-8">
                <Stethoscope className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-600">No assigned pets yet.</p>
                <p className="text-xs text-gray-500 mt-2">
                  Create a medical record for a pet to assign it to your care.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {assignedPets.slice(0, 5).map((pet) => (
                  <div
                    key={pet.id}
                    className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      setSelectedPet(pet);
                      navigate(`/pets/${pet.id}/health`);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      {pet.primary_image && (
                        <img
                          src={pet.primary_image}
                          alt={pet.name}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{pet.name}</p>
                        <p className="text-xs text-gray-500">
                          {pet.pet_type} • {pet.breed}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {pet.adopter_id && (
                        <button
                          type="button"
                          onClick={() => window.dispatchEvent(new CustomEvent('openChat', { detail: { userId: pet.adopter_id, petId: pet.id, name: pet.adopter_name } }))}
                          className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded text-sm font-medium hover:bg-primary/20"
                        >
                          <MessageCircle className="w-4 h-4" />
                          Message Adopter
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPet(pet);
                          setShowRecordForm(true);
                        }}
                        disabled={!user?.is_verified}
                        title={!user?.is_verified ? 'Account pending verification approval.' : undefined}
                        className="text-primary hover:text-primary-dark text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Add Record
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Health Records */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Recent Health Records
              </h2>
              <button
                onClick={() => setShowRecordForm(true)}
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                New Record
              </button>
            </div>
            {loading ? (
              <p className="text-sm text-gray-600">Loading...</p>
            ) : healthRecords.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-600">No health records yet.</p>
                <button
                  onClick={() => setShowRecordForm(true)}
                  className="mt-4 text-primary hover:underline text-sm font-medium"
                >
                  Create your first health record
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {healthRecords.slice(0, 5).map((record) => (
                  <div
                    key={record.id}
                    className="p-4 border border-gray-100 rounded-lg hover:shadow-md transition"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{record.title}</h3>
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                            {record.record_type}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{record.description}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>Pet: {record.pet_info?.name || record.pet}</span>
                          <span>Date: {formatDate(record.date)}</span>
                          {record.next_due_date && (
                            <span>Next Due: {formatDate(record.next_due_date)}</span>
                          )}
                        </div>
                        {record.vaccination && (
                          <div className="mt-2 p-2 bg-green-50 rounded text-xs">
                            <strong>Vaccination:</strong> {record.vaccination.vaccine_name} 
                            {' '}(Next: {formatDate(record.vaccination.next_due_date)})
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/medical-records/${record.id}/edit`)}
                          className="p-2 text-gray-600 hover:text-primary hover:bg-gray-100 rounded"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteRecord(record.id)}
                          className="p-2 text-gray-600 hover:text-red-600 hover:bg-gray-100 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* Overdue Reminders */}
          {overdueReminders.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl shadow-md p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <h2 className="text-lg font-semibold text-gray-900">
                  Overdue Reminders
                </h2>
              </div>
              <div className="space-y-3">
                {overdueReminders.slice(0, 3).map((reminder) => (
                  <div
                    key={reminder.id}
                    className="p-3 bg-white rounded-lg border border-red-200"
                  >
                    <p className="text-sm font-medium text-gray-900">{reminder.title}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {reminder.pet_info?.name} • Due: {formatDate(reminder.due_date)}
                    </p>
                    <button
                      onClick={() => handleMarkReminderCompleted(reminder.id)}
                      className="mt-2 text-xs text-primary hover:underline"
                    >
                      Mark Completed
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Reminders */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-gray-900">
                Upcoming Reminders
              </h2>
            </div>
            {upcomingReminders.length === 0 ? (
              <p className="text-sm text-gray-600">No upcoming reminders.</p>
            ) : (
              <div className="space-y-3">
                {upcomingReminders.slice(0, 5).map((reminder) => (
                  <div
                    key={reminder.id}
                    className="p-3 bg-blue-50 rounded-lg border border-blue-100"
                  >
                    <p className="text-sm font-medium text-gray-900">{reminder.title}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {reminder.pet_info?.name} • Due: {formatDate(reminder.due_date)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{reminder.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => handleMarkReminderCompleted(reminder.id)}
                        className="text-xs text-primary hover:underline"
                      >
                        Mark Completed
                      </button>
                      <button
                        onClick={() => navigate(`/reminders/${reminder.id}/edit`)}
                        className="text-xs text-gray-600 hover:underline"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Quick Actions
            </h2>
            <div className="space-y-2">
              <button
                onClick={() => setShowRecordForm(true)}
                disabled={!user?.is_verified}
                title={!user?.is_verified ? 'Account pending verification approval.' : undefined}
                className="w-full text-left p-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4 inline mr-2" />
                Create Medical Record
              </button>
              <button
                onClick={() => setShowReminderForm(true)}
                disabled={!user?.is_verified}
                title={!user?.is_verified ? 'Account pending verification approval.' : undefined}
                className="w-full text-left p-3 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Calendar className="w-4 h-4 inline mr-2" />
                Schedule Reminder
              </button>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('openChat'))}
                className="w-full text-left p-3 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 transition"
              >
                <MessageCircle className="w-4 h-4 inline mr-2" />
                View Messages
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <MedicalRecordModal
        open={showRecordForm}
        onClose={() => {
          setShowRecordForm(false);
          setSelectedPet(null);
        }}
        allPets={allPets}
        defaultPetId={selectedPet?.id}
        onSubmit={async (payload) => {
          try {
            await medicalRecordsService.create(payload);
            setShowRecordForm(false);
            setSelectedPet(null);
            setSuccessMessage('Medical record created successfully');
            await fetchData();
            setTimeout(() => setSuccessMessage(null), 3000);
          } catch (err) {
            const data = err.response?.data;
            let msg = null;
            if (data) {
              if (typeof data === 'string') {
                msg = data;
              } else if (typeof data === 'object' && data !== null) {
                msg = Array.isArray(data.detail) ? data.detail.join(', ') : data.detail;
                if (!msg) {
                  const parts = Object.entries(data).map(([k, v]) =>
                    `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`
                  );
                  msg = parts.length ? parts.join('; ') : null;
                }
              }
            }
            if (!msg) {
              msg = err.response?.status === 403
                ? 'You must be a veterinarian to create medical records.'
                : err.response?.status === 401
                  ? 'Please log in again.'
                  : err.message || 'Failed to create medical record';
            }
            setError(msg);
          }
        }}
      />

      <HealthReminderModal
        open={showReminderForm}
        onClose={() => setShowReminderForm(false)}
        medicalRecords={healthRecords}
        onSubmit={async (payload) => {
          try {
            await healthRemindersService.create(payload);
            setShowReminderForm(false);
            setSuccessMessage('Reminder scheduled successfully');
            setTimeout(() => setSuccessMessage(null), 3000);
          } catch (err) {
            // Handle different error formats from Django REST Framework
            let errorMessage = 'Failed to schedule reminder';
            
            if (err.response?.data) {
              const data = err.response.data;
              
              // Check for detail field (most common)
              if (data.detail) {
                errorMessage = data.detail;
              }
              // Check for non_field_errors
              else if (data.non_field_errors && Array.isArray(data.non_field_errors)) {
                errorMessage = data.non_field_errors[0];
              }
              // Check for field-specific errors
              else {
                const fieldErrors = Object.entries(data)
                  .map(([field, errors]) => {
                    const errorList = Array.isArray(errors) ? errors : [errors];
                    return `${field}: ${errorList.join(', ')}`;
                  })
                  .join('; ');
                if (fieldErrors) {
                  errorMessage = fieldErrors;
                }
              }
            } else if (err.message) {
              errorMessage = err.message;
            }
            
            setError(errorMessage);
            setTimeout(() => setError(null), 8000);
          }
        }}
      />

      {/* Chat: global popup via bottom-right icon (openChat) */}
    </DashboardLayout>
  );
};

export default VeterinarianDashboard;

