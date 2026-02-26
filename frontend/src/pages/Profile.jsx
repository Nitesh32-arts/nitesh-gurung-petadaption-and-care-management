import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../hooks/useAuth';
import { getProfile, updateProfile } from '../authService';

const Profile = () => {
  const { user: authUser, updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({});
  const [photoFile, setPhotoFile] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getProfile();
        if (cancelled) return;
        setProfile(data);
        setForm({
          first_name: data.first_name ?? '',
          last_name: data.last_name ?? '',
          email: data.email ?? '',
          phone_number: data.phone_number ?? '',
          address: data.address ?? '',
          shelter_name: data.shelter_name ?? '',
          registration_number: data.registration_number ?? '',
          shelter_description: data.shelter_description ?? '',
          clinic_name: data.clinic_name ?? '',
          license_number: data.license_number ?? '',
          specialization: data.specialization ?? '',
        });
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.detail || 'Failed to load profile.');
          setProfile(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!profile || profile.role === 'admin') return;
    setSaving(true);
    setSuccess(null);
    setError(null);
    try {
      let updated;
      if (photoFile) {
        const fd = new FormData();
        Object.entries(form).forEach(([k, v]) => { if (v != null && v !== '') fd.append(k, v); });
        fd.append('profile_picture', photoFile);
        updated = await updateProfile(fd);
        setPhotoFile(null);
      } else {
        updated = await updateProfile(form);
      }
      setProfile(updated);
      updateUser(updated);
      setSuccess('Profile updated successfully.');
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      const msg = err.response?.data;
      if (typeof msg === 'object' && msg !== null) {
        const first = Object.entries(msg).map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`)[0];
        setError(first || 'Update failed.');
      } else {
        setError(err.response?.data?.detail || 'Failed to update profile.');
      }
    } finally {
      setSaving(false);
    }
  };

  const role = profile?.role || authUser?.role;
  const isAdmin = role === 'admin';
  const isShelter = role === 'shelter';
  const isVet = role === 'veterinarian';
  const isAdopter = role === 'adopter';

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 py-12 flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
        <Footer />
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 py-12">
          <p className="text-red-600">{error}</p>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Profile</h1>
        {success && <p className="mb-4 p-3 bg-green-50 text-green-800 rounded-lg text-sm">{success}</p>}
        {error && <p className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Profile photo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Profile photo</label>
            <div className="flex items-center gap-4">
              {(profile?.profile_picture_url || profile?.profile_picture) && (
                <img
                  src={profile.profile_picture_url || profile.profile_picture}
                  alt="Profile"
                  className="w-20 h-20 rounded-full object-cover border border-gray-200"
                />
              )}
              {!isAdmin && (
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                  className="text-sm text-gray-600"
                />
              )}
            </div>
          </div>

          {/* Full name (all roles except admin might have it) */}
          {(isAdopter || isVet || isShelter) && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
                <input
                  type="text"
                  name="first_name"
                  value={form.first_name ?? ''}
                  onChange={handleChange}
                  disabled={isAdmin}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
                <input
                  type="text"
                  name="last_name"
                  value={form.last_name ?? ''}
                  onChange={handleChange}
                  disabled={isAdmin}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                />
              </div>
            </div>
          )}

          {/* Email (read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={form.email ?? profile?.email ?? ''}
              readOnly
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600"
            />
          </div>

          {/* Phone & Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone number</label>
            <input
              type="text"
              name="phone_number"
              value={form.phone_number ?? ''}
              onChange={handleChange}
              disabled={isAdmin}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <textarea
              name="address"
              value={form.address ?? ''}
              onChange={handleChange}
              disabled={isAdmin}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
            />
          </div>

          {/* Shelter-specific */}
          {isShelter && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Shelter name</label>
                <input
                  type="text"
                  name="shelter_name"
                  value={form.shelter_name ?? ''}
                  onChange={handleChange}
                  disabled={isAdmin}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Registration number</label>
                <input
                  type="text"
                  name="registration_number"
                  value={form.registration_number ?? ''}
                  onChange={handleChange}
                  disabled={isAdmin}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Shelter description</label>
                <textarea
                  name="shelter_description"
                  value={form.shelter_description ?? ''}
                  onChange={handleChange}
                  disabled={isAdmin}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              {profile?.managed_pets_count != null && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-700">Managed pets (read-only)</p>
                  <p className="text-gray-600">{profile.managed_pets_count}</p>
                </div>
              )}
            </>
          )}

          {/* Veterinarian-specific */}
          {isVet && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Clinic name</label>
                <input
                  type="text"
                  name="clinic_name"
                  value={form.clinic_name ?? ''}
                  onChange={handleChange}
                  disabled={isAdmin}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">License number</label>
                <input
                  type="text"
                  name="license_number"
                  value={form.license_number ?? ''}
                  onChange={handleChange}
                  disabled={isAdmin}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Specialization</label>
                <input
                  type="text"
                  name="specialization"
                  value={form.specialization ?? ''}
                  onChange={handleChange}
                  disabled={isAdmin}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              {profile?.assigned_pets_count != null && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-700">Assigned pets (read-only)</p>
                  <p className="text-gray-600">{profile.assigned_pets_count}</p>
                </div>
              )}
            </>
          )}

          {/* Adopter read-only */}
          {isAdopter && (
            <>
              {profile?.reward_points != null && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-700">Reward points (read-only)</p>
                  <p className="text-gray-600">{profile.reward_points}</p>
                </div>
              )}
              {profile?.adoption_history?.length > 0 && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 mb-2">Adoption history (read-only)</p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {profile.adoption_history.slice(0, 10).map((a) => (
                      <li key={a.id}>{a.pet_name} {a.reviewed_date ? `• ${new Date(a.reviewed_date).toLocaleDateString()}` : ''}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {/* Admin: basic info only */}
          {isAdmin && (
            <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
              Admin profile is read-only. Basic account info is shown above.
            </div>
          )}

          {!isAdmin && (
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          )}
        </form>
      </main>
      <Footer />
    </div>
  );
};

export default Profile;
