import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Users, Home, Shield, BarChart3, AlertCircle, FileCheck, CheckCircle, XCircle, Package } from 'lucide-react';
import DashboardLayout from '../DashboardLayout';
import StatsCard from '../StatsCard';
import { dashboardService, getPendingPrefetch } from '../../services/dashboardService';
import {
  approveVerification,
  rejectVerification,
  getVerificationDocumentUrl,
} from '../../authService';
import { storeService } from '../../services/storeService';

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    pendingShelters: 0,
    totalReports: 0,
    platformStats: {},
    pendingVerifications: [],
    pendingVerificationsCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [rejectModal, setRejectModal] = useState({ open: false, user: null });
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [storeOverview, setStoreOverview] = useState(null);
  const [storeLowStock, setStoreLowStock] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      const pending = getPendingPrefetch('admin');
      const data = pending ? await pending : await dashboardService.getAdmin();
      setStats({
        totalUsers: data.totalUsers ?? 0,
        pendingShelters: data.pendingShelters ?? 0,
        totalReports: data.totalReports ?? 0,
        platformStats: data.platformStats ?? {},
        pendingVerifications: data.pendingVerifications ?? [],
        pendingVerificationsCount: data.pendingVerificationsCount ?? 0,
      });
    } catch (err) {
      console.error('Failed to fetch admin stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    storeService.getAnalyticsOverview().then(setStoreOverview).catch(() => setStoreOverview(null));
    storeService.getAnalyticsLowStock(5).then((list) => setStoreLowStock(Array.isArray(list) ? list : [])).catch(() => setStoreLowStock([]));
  }, []);

  const openDocument = (userId, fieldName) => {
    const path = getVerificationDocumentUrl(userId, fieldName);
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    fetch(path, {
      headers: { Authorization: `Bearer ${token.trim().replace(/^["']|["']$/g, '')}` },
    })
      .then((r) => r.blob())
      .then((blob) => {
        const u = URL.createObjectURL(blob);
        window.open(u, '_blank');
      })
      .catch(() => {});
  };

  const handleApprove = async (user) => {
    setActionLoading(user.id);
    try {
      await approveVerification(user.id);
      await fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectModal.user) return;
    setActionLoading(rejectModal.user.id);
    try {
      await rejectVerification(rejectModal.user.id, rejectReason || 'No reason provided.');
      setRejectModal({ open: false, user: null });
      setRejectReason('');
      await fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const pendingVerifications = stats.pendingVerifications || [];

  return (
    <DashboardLayout
      title="Admin Dashboard"
      subtitle="Manage platform users, shelters, and system operations."
    >
      {/* Stats Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard
          title="Total Users"
          value={stats.totalUsers}
          icon={Users}
        />
        <StatsCard
          title="Pending Verifications"
          value={stats.pendingVerificationsCount}
          icon={FileCheck}
          iconBg="bg-amber-100"
        />
        <StatsCard
          title="Reports"
          value={stats.totalReports}
          icon={AlertCircle}
          iconBg="bg-red-100"
        />
        <StatsCard
          title="Platform Stats"
          value="View"
          icon={BarChart3}
          iconBg="bg-blue-100"
        />
      </section>

      {/* Store Analytics (admin) */}
      {(storeOverview || storeLowStock.length > 0) && (
        <section className="mb-6 bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Store Analytics
            </h2>
            <Link to="/store" className="text-sm text-primary hover:underline">View store</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            {storeOverview && (
              <>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Total orders</p>
                  <p className="text-xl font-semibold text-gray-900">{storeOverview.total_orders ?? 0}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Revenue</p>
                  <p className="text-xl font-semibold text-primary">${storeOverview.total_revenue ?? '0'}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Orders today</p>
                  <p className="text-xl font-semibold text-gray-900">{storeOverview.orders_today ?? 0}</p>
                </div>
              </>
            )}
          </div>
          {storeLowStock.length > 0 && (
            <div>
              <p className="text-sm font-medium text-amber-800 mb-2 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" /> Low stock (&lt; 5)
              </p>
              <ul className="text-sm text-gray-600 space-y-1">
                {storeLowStock.slice(0, 5).map((p) => (
                  <li key={p.id}>{p.name} — {p.stock} left</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Pending Verifications */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Pending Verifications
            </h2>
            {loading ? (
              <p className="text-sm text-gray-600">Loading...</p>
            ) : pendingVerifications.length === 0 ? (
              <p className="text-sm text-gray-600">No pending verification requests.</p>
            ) : (
              <div className="space-y-4">
                {pendingVerifications.map((u) => (
                  <div
                    key={u.id}
                    className="border border-gray-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {(u.first_name && u.last_name) ? `${u.first_name} ${u.last_name}` : u.username}
                      </p>
                      <p className="text-sm text-gray-600">{u.email}</p>
                      <p className="text-xs text-gray-500 capitalize">{u.role}</p>
                      {u.verification_submitted_at && (
                        <p className="text-xs text-gray-500 mt-1">
                          Submitted: {new Date(u.verification_submitted_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {u.role === 'veterinarian' && (
                        <>
                          <button
                            type="button"
                            onClick={() => openDocument(u.id, 'license_document')}
                            className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                          >
                            License
                          </button>
                          <button
                            type="button"
                            onClick={() => openDocument(u.id, 'certification_document')}
                            className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                          >
                            Certification
                          </button>
                        </>
                      )}
                      {u.role === 'shelter' && (
                        <>
                          <button
                            type="button"
                            onClick={() => openDocument(u.id, 'registration_certificate')}
                            className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                          >
                            Registration
                          </button>
                          <button
                            type="button"
                            onClick={() => openDocument(u.id, 'organization_document')}
                            className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                          >
                            Organization
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => handleApprove(u)}
                        disabled={actionLoading !== null}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-800 rounded-lg text-sm font-medium hover:bg-green-200 disabled:opacity-50"
                      >
                        <CheckCircle className="w-4 h-4" />
                        {actionLoading === u.id ? '...' : 'Approve'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRejectModal({ open: true, user: u })}
                        disabled={actionLoading !== null}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-800 rounded-lg text-sm font-medium hover:bg-red-200 disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* User Management */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              User Management
            </h2>
            <p className="text-sm text-gray-600">
              {loading ? 'Loading...' : 'Manage all platform users.'}
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* System Activity */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              System Activity
            </h2>
            <p className="text-sm text-gray-600">Recent platform activity.</p>
          </div>
        </div>
      </div>

      {/* Reject reason modal */}
      {rejectModal.open && rejectModal.user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Reject verification</h3>
            <p className="text-sm text-gray-600 mb-3">
              Reject verification for {(rejectModal.user.first_name && rejectModal.user.last_name)
                ? `${rejectModal.user.first_name} ${rejectModal.user.last_name}`
                : rejectModal.user.username}?
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason (required)</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Provide a reason for rejection..."
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => { setRejectModal({ open: false, user: null }); setRejectReason(''); }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectSubmit}
                disabled={actionLoading !== null}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading === rejectModal.user?.id ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default AdminDashboard;

