import { useState, useEffect, useCallback } from 'react';
import { Plus, X, MessageCircle, Bell, Link2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import PetStatusTabs from './PetStatusTabs';
import LostPetCard from './LostPetCard';
import { useAuth } from '../hooks/useAuth';
import { lostFoundService } from '../services/lostFoundService';
import { adoptedPetsService } from '../services/adopterService';

const PET_TYPES = [
  { value: 'dog', label: 'Dog' },
  { value: 'cat', label: 'Cat' },
  { value: 'bird', label: 'Bird' },
  { value: 'rabbit', label: 'Rabbit' },
  { value: 'hamster', label: 'Hamster' },
  { value: 'other', label: 'Other' },
];

const SIZE_OPTIONS = [
  { value: '', label: 'Select size' },
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

function reportToCard(report, type) {
  const isLost = type === 'lost';
  const name = isLost
    ? (report.pet_info?.name || report.pet?.name || 'Lost pet')
    : 'Found pet';
  const breed = isLost
    ? (report.pet_info?.breed || report.pet?.breed || 'Unknown')
    : (report.breed || 'Unknown');
  const userId = isLost
    ? (report.owner_info?.id ?? report.owner)
    : (report.reporter_info?.id ?? report.reporter);
  const location = isLost ? report.last_seen_location : report.location_found;
  const dateReported = isLost ? report.last_seen_date : report.date_found;

  return {
    id: report.id,
    name,
    breed,
    reward: null,
    description: report.description || '',
    color: report.color || '',
    location,
    dateReported,
    image: report.primary_image || report.pet_info?.primary_image_url || null,
    status: report.status,
    userId,
  };
}

const LostAndFound = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('lost');
  const [lostReports, setLostReports] = useState([]);
  const [foundReports, setFoundReports] = useState([]);
  const [matchNotifications, setMatchNotifications] = useState([]);
  const [adoptedPets, setAdoptedPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [showLostForm, setShowLostForm] = useState(false);
  const [showFoundForm, setShowFoundForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [matchNotificationOpen, setMatchNotificationOpen] = useState(false);
  const [conflictingLostReportId, setConflictingLostReportId] = useState(null);

  const fetchLost = useCallback(async () => {
    if (!user) return;
    try {
      const data = await lostFoundService.getLostReports();
      setLostReports(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setLostReports([]);
    }
  }, [user]);

  const fetchFound = useCallback(async () => {
    try {
      const data = await lostFoundService.getFoundReports();
      setFoundReports(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setFoundReports([]);
    }
  }, []);

  const fetchMatchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const data = await lostFoundService.getMatchNotifications();
      setMatchNotifications(Array.isArray(data) ? data : []);
    } catch {
      setMatchNotifications([]);
    }
  }, [user]);

  const fetchAdoptedPets = useCallback(async () => {
    if (!user || user.role !== 'adopter') return;
    try {
      const data = await adoptedPetsService.getAll();
      const list = Array.isArray(data) ? data : (data?.results || []);
      setAdoptedPets(list);
    } catch {
      setAdoptedPets([]);
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      user ? fetchLost() : Promise.resolve(),
      fetchFound(),
      user ? fetchMatchNotifications() : Promise.resolve(),
    ]).finally(() => setLoading(false));
  }, [user, fetchLost, fetchFound, fetchMatchNotifications]);

  useEffect(() => {
    if (showLostForm && user?.role === 'adopter') {
      fetchAdoptedPets();
    }
  }, [showLostForm, user, fetchAdoptedPets]);

  const handleReportLost = async (e) => {
    e.preventDefault();
    const form = e.target;
    const petId = form.pet?.value;
    if (!petId) {
      setError('Please select a pet from your adopted pets.');
      return;
    }
    const formData = new FormData();
    formData.append('pet', petId);
    formData.append('last_seen_location', form.last_seen_location.value.trim());
    formData.append('last_seen_date', form.last_seen_date.value);
    formData.append('description', form.description.value.trim());
    if (form.color?.value) formData.append('color', form.color.value.trim());
    if (form.size?.value) formData.append('size', form.size.value);
    if (form.image?.files?.[0]) formData.append('image', form.image.files[0]);

    setSubmitting(true);
    setError(null);
    try {
      await lostFoundService.createLostReport(formData);
      setSuccessMsg('Lost pet report submitted.');
      setShowLostForm(false);
      fetchLost();
      fetchMatchNotifications();
    } catch (err) {
      const detail = err.response?.data;
      const msg =
        (typeof detail === 'object' && detail?.pet) ||
        err.response?.data?.detail ||
        err.message ||
        'Failed to submit report.';
      setError(typeof msg === 'object' ? JSON.stringify(msg) : msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReportFound = async (e) => {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData();
    formData.append('pet_type', form.pet_type.value);
    formData.append('breed', form.breed.value.trim() || '');
    formData.append('color', form.color.value.trim() || '');
    formData.append('description', form.description.value.trim());
    formData.append('location_found', form.location_found.value.trim());
    formData.append('date_found', form.date_found.value);
    formData.append('contact_phone', form.contact_phone.value.trim());
    formData.append('contact_email', form.contact_email.value.trim());
    if (form.size?.value) formData.append('size', form.size.value);
    if (form.image?.files?.[0]) formData.append('image', form.image.files[0]);

    setSubmitting(true);
    setError(null);
    setConflictingLostReportId(null);
    try {
      await lostFoundService.createFoundReport(formData);
      setSuccessMsg('Found pet report submitted.');
      setShowFoundForm(false);
      fetchFound();
      fetchMatchNotifications();
    } catch (err) {
      const errorData = err.response?.data;
      const errorDetail = errorData?.detail || err.message || 'Failed to submit report.';
      
      // Check if this is the "report your own lost pet" error
      if (errorDetail.includes('cannot report your own lost pet') || errorDetail.includes('mark your lost report as resolved')) {
        setError('You already reported this pet as lost. If you found it, please mark the report as resolved instead.');
        setConflictingLostReportId(errorData?.lost_report_id || null);
        // Switch to lost tab and close found form
        setActiveTab('lost');
        setShowFoundForm(false);
      } else {
        setError(errorDetail);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkResolved = async (type, id) => {
    try {
      if (type === 'lost') await lostFoundService.markLostResolved(id);
      else await lostFoundService.markFoundResolved(id);
      setSuccessMsg('Report marked as resolved.');
      fetchLost();
      fetchFound();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update.');
    }
  };

  const handleDelete = async (type, id) => {
    if (!window.confirm('Are you sure you want to delete this report? This cannot be undone.')) return;
    try {
      setError(null);
      if (type === 'lost') await lostFoundService.deleteLostReport(id);
      else await lostFoundService.deleteFoundReport(id);
      setSuccessMsg('Report deleted.');
      fetchLost();
      fetchFound();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete report.');
    }
  };

  const currentReports = activeTab === 'lost' ? lostReports : foundReports;
  const currentCards = currentReports.map((r) => reportToCard(r, activeTab));
  const canReportLost = user?.role === 'adopter';
  const canReportFound = user?.role === 'adopter' || user?.role === 'shelter';
  const hasActiveLostReports = user && lostReports.some(r => r.status === 'active' || r.status === 'matched');

  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(null), 5000);
    return () => clearTimeout(t);
  }, [successMsg]);

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-4">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight">
              Lost & Found Pets
            </h1>
            {user && (
              <div className="relative inline-flex items-center">
                <button
                  type="button"
                  onClick={() => setMatchNotificationOpen((o) => !o)}
                  className="relative inline-flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-primary transition-colors"
                  aria-label="Match notifications"
                >
                  <Bell className="h-5 w-5 sm:h-6 sm:w-6" />
                  {matchNotifications.filter((n) => !n.is_read).length > 0 && (
                    <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-xs font-medium flex items-center justify-center">
                      {matchNotifications.filter((n) => !n.is_read).length > 99 ? '99+' : matchNotifications.filter((n) => !n.is_read).length}
                    </span>
                  )}
                </button>
                {matchNotificationOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setMatchNotificationOpen(false)}
                      aria-hidden="true"
                    />
                    <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-20 w-80 max-h-80 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                      <div className="border-b border-gray-100 px-3 py-2">
                        <span className="text-sm font-semibold text-gray-700">Match notifications</span>
                      </div>
                      <ul className="max-h-64 overflow-y-auto">
                        {matchNotifications.length === 0 ? (
                          <li className="px-3 py-4 text-center text-sm text-gray-500">No notifications yet.</li>
                        ) : (
                          matchNotifications.slice(0, 10).map((n) => (
                            <li
                              key={n.id}
                              className="flex items-center justify-between gap-3 border-b border-gray-100 px-3 py-2.5 last:border-b-0 hover:bg-gray-50 cursor-pointer"
                              onClick={() => {
                                const targetMatchId = n.match_info?.id ?? n.match;
                                const navigateTo = targetMatchId
                                  ? `/lost-found/matches/${targetMatchId}`
                                  : '/lost-found/matches';
                                lostFoundService
                                  .markMatchNotificationRead(n.id)
                                  .then(fetchMatchNotifications)
                                  .finally(() => {
                                    setMatchNotificationOpen(false);
                                    navigate(navigateTo);
                                  });
                              }}
                            >
                              <span className={`min-w-0 flex-1 text-sm line-clamp-2 ${n.is_read ? 'text-gray-500' : 'font-medium text-gray-900'}`}>
                                {n.title}: {n.message}
                              </span>
                              {!n.is_read && (
                                <span className="flex-shrink-0 text-[11px] font-semibold text-primary">
                                  View
                                </span>
                              )}
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-6">
            Help reunite lost pets with their families or find the owner of a pet you've found
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {canReportLost && (
              <button
                type="button"
                onClick={() => { setShowLostForm(true); setShowFoundForm(false); setError(null); }}
                className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-emerald-600 transition-colors shadow-md"
              >
                <Plus className="h-5 w-5" />
                Report Lost Pet
              </button>
            )}
            {canReportFound && (
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => { setShowFoundForm(true); setShowLostForm(false); setError(null); setConflictingLostReportId(null); }}
                  className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-emerald-600 transition-colors shadow-md"
                >
                  <Plus className="h-5 w-5" />
                  Report Found Pet
                </button>
                {hasActiveLostReports && (
                  <p className="mt-1 text-xs text-gray-500 max-w-xs text-center">
                    If you found your own lost pet, mark it as resolved instead
                  </p>
                )}
              </div>
            )}
            {user && (
              <button
                type="button"
                onClick={() => navigate('/lost-found/matches')}
                className="inline-flex items-center gap-2 border-2 border-primary text-primary px-6 py-3 rounded-lg font-semibold hover:bg-emerald-50 transition-colors"
              >
                <Link2 className="h-5 w-5" />
                My Matches
              </button>
            )}
          </div>
        </div>

        {successMsg && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-center">
            {successMsg}
          </div>
        )}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            <div className="text-center mb-2">{error}</div>
            {conflictingLostReportId && (
              <div className="text-center mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setConflictingLostReportId(null);
                    setActiveTab('lost');
                    // Scroll to the lost report card if it exists
                    setTimeout(() => {
                      const reportCard = document.querySelector(`[data-report-id="${conflictingLostReportId}"]`);
                      if (reportCard) {
                        reportCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        reportCard.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
                        setTimeout(() => {
                          reportCard.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
                        }, 3000);
                      }
                    }, 100);
                  }}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  View your lost report →
                </button>
              </div>
            )}
          </div>
        )}

        <PetStatusTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          lostCount={lostReports.length}
          foundCount={foundReports.length}
        />

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {currentCards.map((pet) => (
                <LostPetCard
                  key={pet.id}
                  pet={pet}
                  status={activeTab}
                  reportStatus={pet.status}
                  onMarkResolved={user && (pet.userId === user.id || pet.userId === user.pk) ? () => handleMarkResolved(activeTab, pet.id) : undefined}
                  onDelete={user && (pet.userId === user.id || pet.userId === user.pk) ? () => handleDelete(activeTab, pet.id) : undefined}
                  onMessage={pet.userId && user && (user.id !== pet.userId && user.pk !== pet.userId) ? () => {
                    window.dispatchEvent(new CustomEvent('openChat', { detail: { userId: pet.userId } }));
                  } : undefined}
                />
              ))}
            </div>
            {currentCards.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">
                  No {activeTab === 'lost' ? 'lost' : 'found'} pets reported yet.
                </p>
              </div>
            )}
          </>
        )}
      </main>
      <Footer />

      {showLostForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-semibold">Report Lost Pet</h2>
              <button type="button" onClick={() => setShowLostForm(false)} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleReportLost} className="p-4 space-y-3">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Select your pet *</span>
                <select name="pet" className="mt-1 w-full border rounded-lg px-3 py-2" required>
                  <option value="">Choose an adopted pet</option>
                  {adoptedPets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.pet_type || p.breed || 'Pet'})
                    </option>
                  ))}
                </select>
                {adoptedPets.length === 0 && (
                  <p className="mt-1 text-sm text-amber-600">You have no adopted pets. Adopt a pet first to report it as lost.</p>
                )}
              </label>
              <input name="last_seen_location" placeholder="Last seen location *" className="w-full border rounded-lg px-3 py-2" required />
              <input name="last_seen_date" type="date" className="w-full border rounded-lg px-3 py-2" required />
              <input name="color" placeholder="Color (optional, improves matching)" className="w-full border rounded-lg px-3 py-2" />
              <select name="size" className="w-full border rounded-lg px-3 py-2">
                {SIZE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <textarea name="description" placeholder="Additional description (optional)" className="w-full border rounded-lg px-3 py-2" rows={3} />
              <label className="block">
                <span className="text-sm text-gray-600">Photo (optional)</span>
                <input name="image" type="file" accept="image/*" className="mt-1 block w-full text-sm" />
              </label>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={submitting || adoptedPets.length === 0} className="flex-1 bg-primary text-white py-2 rounded-lg font-medium disabled:opacity-50">
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>
                <button type="button" onClick={() => setShowLostForm(false)} className="px-4 py-2 border rounded-lg">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showFoundForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-semibold">Report Found Pet</h2>
              <button type="button" onClick={() => setShowFoundForm(false)} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleReportFound} className="p-4 space-y-3">
              <select name="pet_type" className="w-full border rounded-lg px-3 py-2" required>
                {PET_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <input name="breed" placeholder="Breed" className="w-full border rounded-lg px-3 py-2" />
              <input name="color" placeholder="Color (optional)" className="w-full border rounded-lg px-3 py-2" />
              <select name="size" className="w-full border rounded-lg px-3 py-2">
                {SIZE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <textarea name="description" placeholder="Description *" className="w-full border rounded-lg px-3 py-2" rows={3} required />
              <input name="location_found" placeholder="Location found *" className="w-full border rounded-lg px-3 py-2" required />
              <input name="date_found" type="date" className="w-full border rounded-lg px-3 py-2" required />
              <input name="contact_phone" placeholder="Contact phone *" className="w-full border rounded-lg px-3 py-2" required />
              <input name="contact_email" type="email" placeholder="Contact email *" className="w-full border rounded-lg px-3 py-2" required />
              <label className="block">
                <span className="text-sm text-gray-600">Photo (optional)</span>
                <input name="image" type="file" accept="image/*" className="mt-1 block w-full text-sm" />
              </label>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={submitting} className="flex-1 bg-primary text-white py-2 rounded-lg font-medium disabled:opacity-50">
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>
                <button type="button" onClick={() => setShowFoundForm(false)} className="px-4 py-2 border rounded-lg">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LostAndFound;
