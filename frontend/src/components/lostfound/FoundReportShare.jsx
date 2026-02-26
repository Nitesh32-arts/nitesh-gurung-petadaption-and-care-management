import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { lostFoundService } from '../../services/lostFoundService';
import Navbar from '../Navbar';
import Footer from '../Footer';
import { MapPin, Calendar, Share2, Mail, Phone } from 'lucide-react';

export default function FoundReportShare() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    lostFoundService.getFoundReportShare(id)
      .then(setReport)
      .catch(() => setError('Report not found.'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!report) return;
    const title = `Found: ${report.pet_type} – PetCare Lost & Found`;
    const description = report.description || `Found pet in ${report.location_found}. Is this your pet?`;
    const image = report.primary_image;
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
    const title = `Found pet – PetCare Lost & Found`;
    if (navigator.share) {
      navigator.share({
        title,
        text: report?.description || 'Found a pet. Is it yours?',
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

  const imgSrc = report.primary_image?.startsWith('http') ? report.primary_image : report.primary_image;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-emerald-100 border-b border-emerald-200 px-4 py-2 flex items-center justify-between">
            <span className="font-semibold text-emerald-900">FOUND PET</span>
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-emerald-300 rounded-lg text-sm font-medium text-emerald-900 hover:bg-emerald-50"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
          </div>
          {imgSrc && (
            <img
              src={imgSrc}
              alt="Found pet"
              className="w-full h-80 object-cover"
            />
          )}
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Found: {report.pet_type} {report.breed ? `(${report.breed})` : ''}
            </h1>
            <p className="text-gray-600 mb-4">{report.description}</p>
            <div className="space-y-2 text-sm text-gray-600">
              <p className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                Found at: {report.location_found}
              </p>
              <p className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                Date found: {report.date_found ? new Date(report.date_found).toLocaleDateString() : '—'}
              </p>
              {(report.color || report.size) && (
                <p>Color/size: {[report.color, report.size].filter(Boolean).join(' • ') || '—'}</p>
              )}
            </div>
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-semibold text-gray-900 mb-2">Contact the finder</p>
              {report.contact_email && (
                <p className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4" />
                  <a href={`mailto:${report.contact_email}`} className="text-primary hover:underline">{report.contact_email}</a>
                </p>
              )}
              {report.contact_phone && (
                <p className="flex items-center gap-2 text-sm mt-1">
                  <Phone className="w-4 h-4" />
                  <a href={`tel:${report.contact_phone}`} className="text-primary hover:underline">{report.contact_phone}</a>
                </p>
              )}
            </div>
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
