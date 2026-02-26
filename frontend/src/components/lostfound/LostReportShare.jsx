import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { lostFoundService } from '../../services/lostFoundService';
import Navbar from '../Navbar';
import Footer from '../Footer';
import { MapPin, Calendar, Share2 } from 'lucide-react';

export default function LostReportShare() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    lostFoundService.getLostReportShare(id)
      .then(setReport)
      .catch(() => setError('Report not found.'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!report) return;
    const title = `Lost: ${report.pet_info?.name || 'Pet'} – PetCare Lost & Found`;
    const description = report.description || `Lost pet last seen near ${report.last_seen_location}. Help us find ${report.pet_info?.name || 'them'}!`;
    const image = report.primary_image || report.pet_info?.primary_image_url;
    const url = window.location.href;

    document.title = title;

    const setMeta = (name, content, isProperty = false) => {
      const attr = isProperty ? 'property' : 'name';
      let el = document.querySelector(`meta[${attr}="${name}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content || '');
    };

    setMeta('og:title', title, true);
    setMeta('og:description', description, true);
    setMeta('og:image', image, true);
    setMeta('og:url', url, true);
    setMeta('og:type', 'website', true);
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', title);
    setMeta('twitter:description', description);
    setMeta('twitter:image', image);

    return () => {
      document.title = 'PetCare';
    };
  }, [report]);

  const handleShare = () => {
    const url = window.location.href;
    const title = `Lost: ${report?.pet_info?.name || 'Pet'} – PetCare`;
    if (navigator.share) {
      navigator.share({
        title,
        text: report?.description || `Help find ${report?.pet_info?.name || 'this pet'}!`,
        url,
      }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url).then(() => alert('Link copied to clipboard!'));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 py-12 flex justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 py-12 text-center">
          <p className="text-red-600">{error || 'Report not found.'}</p>
          <Link to="/lost-found" className="text-primary font-medium mt-4 inline-block">Back to Lost & Found</Link>
        </main>
        <Footer />
      </div>
    );
  }

  const imageUrl = report.primary_image || report.pet_info?.primary_image_url;
  const imgSrc = imageUrl?.startsWith('http') ? imageUrl : (imageUrl ? `${imageUrl}` : null);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-amber-100 border-b border-amber-200 px-4 py-2 flex items-center justify-between">
            <span className="font-semibold text-amber-900">LOST PET</span>
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-sm font-medium text-amber-900 hover:bg-amber-50"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
          </div>
          {imgSrc && (
            <img
              src={imgSrc}
              alt={report.pet_info?.name || 'Lost pet'}
              className="w-full h-80 object-cover"
            />
          )}
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {report.pet_info?.name || 'Pet'} is missing
            </h1>
            <p className="text-gray-600 mb-4">{report.pet_info?.breed} • {report.pet_info?.pet_type}</p>
            {report.description && (
              <p className="text-gray-700 mb-4">{report.description}</p>
            )}
            <div className="space-y-2 text-sm text-gray-600">
              <p className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                Last seen: {report.last_seen_location}
              </p>
              <p className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                Date: {report.last_seen_date ? new Date(report.last_seen_date).toLocaleDateString() : '—'}
              </p>
              {(report.color || report.size) && (
                <p>Color/size: {[report.color, report.size].filter(Boolean).join(' • ') || '—'}</p>
              )}
            </div>
            <p className="mt-6 text-sm text-gray-500">
              If you have seen this pet, please log in to PetCare and report a match, or contact us.
            </p>
            <Link
              to="/lost-found"
              className="inline-block mt-4 text-primary font-medium hover:underline"
            >
              ← Back to Lost & Found
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
