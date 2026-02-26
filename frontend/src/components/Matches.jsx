import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, ArrowLeft, Loader2, MapPin, Calendar, PawPrint } from 'lucide-react';
import Navbar from './Navbar';
import Footer from './Footer';
import { useAuth } from '../hooks/useAuth';
import { lostFoundService } from '../services/lostFoundService';

const statusBadgeClasses = {
  pending: 'bg-amber-100 text-amber-800',
  pending_confirmation: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
  resolved: 'bg-gray-100 text-gray-700',
};

const Matches = () => {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const selectedMatch = useMemo(
    () => matches.find((m) => String(m.id) === String(matchId)) ?? null,
    [matches, matchId],
  );

  const loadMatches = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await lostFoundService.getMatches();
      setMatches(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Failed to load matches.');
      setMatches([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setMatches([]);
      return;
    }
    loadMatches();
  }, [user]);

  const handleAction = async (id, action) => {
    setActionLoadingId(id);
    setError(null);
    try {
      if (action === 'confirm') {
        await lostFoundService.confirmMatch(id);
      } else if (action === 'reject') {
        await lostFoundService.rejectMatch(id);
      } else if (action === 'resolve') {
        await lostFoundService.resolveMatch(id);
      }
      await loadMatches();
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Failed to update match.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleBackToLostFound = () => {
    navigate('/lost-found');
  };

  const renderMatchActions = (match) => {
    const isPending = match.status === 'pending' || match.status === 'pending_confirmation';
    const isConfirmed = match.status === 'confirmed' && match.is_confirmed;
    if (!isPending && !isConfirmed) return null;

    return (
      <div className="flex flex-wrap gap-2 mt-3">
        {isPending && (
          <>
            <button
              type="button"
              onClick={() => handleAction(match.id, 'confirm')}
              disabled={actionLoadingId === match.id}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" />
              {actionLoadingId === match.id ? 'Confirming...' : 'Confirm'}
            </button>
            <button
              type="button"
              onClick={() => handleAction(match.id, 'reject')}
              disabled={actionLoadingId === match.id}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-300 text-red-600 text-sm font-medium hover:bg-red-50 disabled:opacity-60"
            >
              <XCircle className="h-4 w-4" />
              {actionLoadingId === match.id ? 'Rejecting...' : 'Reject'}
            </button>
          </>
        )}
        {isConfirmed && (
          <button
            type="button"
            onClick={() => handleAction(match.id, 'resolve')}
            disabled={actionLoadingId === match.id}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-emerald-300 text-emerald-700 text-sm font-medium hover:bg-emerald-50 disabled:opacity-60"
          >
            <CheckCircle2 className="h-4 w-4" />
            {actionLoadingId === match.id ? 'Resolving...' : 'Mark as resolved'}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Lost &amp; Found Matches</h1>
            <p className="text-gray-600 text-sm">
              Review potential matches between your lost and found reports, confirm or reject them, and mark them as resolved.
            </p>
          </div>
          <button
            type="button"
            onClick={handleBackToLostFound}
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-primary font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Lost &amp; Found
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
            {error}
          </div>
        )}

        {!user && (
          <div className="py-16 text-center text-gray-600">
            <p className="mb-2 text-lg font-medium">You need to be logged in to view matches.</p>
          </div>
        )}

        {user && loading && (
          <div className="py-16 flex flex-col items-center justify-center text-gray-500">
            <Loader2 className="h-6 w-6 animate-spin mb-2" />
            <p>Loading matches...</p>
          </div>
        )}

        {user && !loading && matches.length === 0 && (
          <div className="py-16 text-center text-gray-600">
            <p className="mb-2 text-lg font-medium">No matches yet.</p>
            <p className="text-sm">
              When potential matches are found between lost and found reports, they will appear here.
            </p>
          </div>
        )}

        {user && !loading && matches.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-3">
              {matches.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => navigate(`/lost-found/matches/${m.id}`)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedMatch && selectedMatch.id === m.id
                      ? 'border-primary bg-emerald-50'
                      : 'border-gray-200 hover:border-primary/60 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5">
                      <PawPrint className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold text-gray-900">
                        {m.lost_report_info?.pet_name || 'Lost pet'}
                      </span>
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        statusBadgeClasses[m.status] || 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {m.status.charAt(0).toUpperCase() + m.status.slice(1)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-1">
                    Score: {Math.round(m.match_score)} / 100
                  </p>
                  <p className="text-xs text-gray-500 line-clamp-2">
                    Lost: {m.lost_report_info?.last_seen_location || 'Unknown'} → Found:{' '}
                    {m.found_report_info?.location_found || m.found_report_info?.found_location || 'Unknown'}
                  </p>
                </button>
              ))}
            </div>

            <div className="lg:col-span-2">
              {!selectedMatch && (
                <div className="h-full flex items-center justify-center text-gray-500 border border-dashed border-gray-200 rounded-xl p-6">
                  <p className="text-sm">Select a match from the list to see full details.</p>
                </div>
              )}

              {selectedMatch && (
                <div className="border border-gray-200 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">
                        Match #{selectedMatch.id}{' '}
                        <span className="text-sm font-medium text-gray-500">
                          ({Math.round(selectedMatch.match_score)}% similarity)
                        </span>
                      </h2>
                      <p className="text-xs text-gray-500">
                        Status:{' '}
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            statusBadgeClasses[selectedMatch.status] || 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {(selectedMatch.status || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-lg border border-gray-200 p-4">
                      <h3 className="text-sm font-semibold text-gray-800 mb-2">Lost report</h3>
                      <p className="text-sm font-medium text-gray-900 mb-1">
                        {selectedMatch.lost_report_info?.pet_name || 'Lost pet'}
                      </p>
                      <p className="text-xs text-gray-500 mb-2">
                        Type: {selectedMatch.lost_report_info?.pet_type || 'Unknown'}
                      </p>
                      <div className="space-y-1 text-xs text-gray-600">
                        <div className="flex items-center">
                          <MapPin className="h-3 w-3 mr-1 text-primary" />
                          <span>
                            Last seen:{' '}
                            {selectedMatch.lost_report_info?.last_seen_location || 'Unknown'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-gray-200 p-4">
                      <h3 className="text-sm font-semibold text-gray-800 mb-2">Found report</h3>
                      <p className="text-sm font-medium text-gray-900 mb-1">
                        {selectedMatch.found_report_info?.pet_type || 'Found pet'}
                      </p>
                      <p className="text-xs text-gray-500 mb-2">
                        Report ID: {selectedMatch.found_report_info?.id}
                      </p>
                      <div className="space-y-1 text-xs text-gray-600">
                        <div className="flex items-center">
                          <MapPin className="h-3 w-3 mr-1 text-primary" />
                          <span>
                            Found at: {selectedMatch.found_report_info?.location_found || selectedMatch.found_report_info?.found_location || 'Unknown'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {selectedMatch.match_reasons && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-800 mb-1">Why this is a match</h3>
                      <ul className="list-disc list-inside text-xs text-gray-600 space-y-0.5">
                        {String(selectedMatch.match_reasons)
                          .split(';')
                          .map((reason, idx) => reason.trim() && (
                            <li key={idx}>{reason.trim()}</li>
                          ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-3">
                      {selectedMatch.created_at && (
                        <div className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          <span>
                            Created:{' '}
                            {new Date(selectedMatch.created_at).toLocaleString()}
                          </span>
                        </div>
                      )}
                      {selectedMatch.updated_at && (
                        <div className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          <span>
                            Updated:{' '}
                            {new Date(selectedMatch.updated_at).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {renderMatchActions(selectedMatch)}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Matches;

