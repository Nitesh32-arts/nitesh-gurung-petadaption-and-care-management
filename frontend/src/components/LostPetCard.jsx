import { Heart, MapPin, Calendar, Palette, MessageCircle, CheckCircle, Trash2 } from 'lucide-react';
import { useState } from 'react';

const LostPetCard = ({
  pet,
  status = 'lost',
  reportStatus,
  onMarkResolved,
  onDelete,
  onMessage,
}) => {
  const [isFavorited, setIsFavorited] = useState(false);
  const resolved = reportStatus === 'resolved' || reportStatus === 'closed';
  const matched = reportStatus === 'matched';

  return (
    <div 
      data-report-id={pet.id}
      className={`bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1 overflow-hidden border-2 ${
        status === 'lost' ? 'border-red-200' : 'border-blue-200'
      }`}
    >
      <div className="relative">
        <img
          src={pet.image || 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&q=80'}
          alt={pet.name}
          className="w-full h-64 object-cover"
        />
        {pet.reward != null && pet.reward > 0 && (
          <span className="absolute top-4 left-4 bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-sm font-semibold">
            Reward: ${pet.reward}
          </span>
        )}
        <span className={`absolute top-4 right-4 px-3 py-1 rounded-full text-sm font-semibold ${
          status === 'lost'
            ? 'bg-red-500 text-white'
            : 'bg-blue-500 text-white'
        }`}>
          {status === 'lost' ? 'LOST' : 'FOUND'}
        </span>
        {reportStatus && (
          <span className={`absolute bottom-2 left-2 px-2 py-1 rounded text-xs font-medium ${
            resolved ? 'bg-gray-500 text-white' : matched ? 'bg-amber-500 text-white' : 'bg-green-600 text-white'
          }`}>
            {resolved ? 'Resolved' : matched ? 'Matched' : 'Active'}
          </span>
        )}
      </div>
      <div className="p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-bold text-gray-900">{pet.name}</h3>
          <button
            onClick={() => setIsFavorited(!isFavorited)}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Add to favorites"
          >
            <Heart
              className={`h-5 w-5 transition-colors ${
                isFavorited ? 'fill-red-500 text-red-500' : 'text-gray-400 hover:text-red-500'
              }`}
            />
          </button>
        </div>
        <p className="text-gray-600 mb-3">{pet.breed}</p>
        <p className="text-sm text-gray-500 mb-4 line-clamp-2">{pet.description}</p>

        <div className="space-y-2 mb-4">
          <div className="flex items-center text-sm text-gray-600">
            <Palette className="h-4 w-4 mr-2 text-primary flex-shrink-0" />
            <span>Color: {pet.color || '—'}</span>
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <MapPin className="h-4 w-4 mr-2 text-primary flex-shrink-0" />
            <span>{pet.location || '—'}</span>
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <Calendar className="h-4 w-4 mr-2 text-primary flex-shrink-0" />
            <span>Reported: {pet.dateReported || '—'}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {onMessage && (
            <button
              type="button"
              onClick={onMessage}
              className="w-full inline-flex items-center justify-center gap-2 bg-primary text-white py-2.5 rounded-lg font-medium hover:bg-emerald-600 transition-colors"
            >
              <MessageCircle className="h-4 w-4" />
              Contact
            </button>
          )}
          {!onMessage && status === 'found' && (
            <span className="text-sm text-gray-500 text-center py-1">Contact info on report</span>
          )}
          {onMarkResolved && !resolved && (
            <button
              type="button"
              onClick={onMarkResolved}
              className="w-full inline-flex items-center justify-center gap-2 border border-primary text-primary py-2 rounded-lg font-medium hover:bg-emerald-50 transition-colors"
            >
              <CheckCircle className="h-4 w-4" />
              Mark as resolved
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="w-full inline-flex items-center justify-center gap-2 border border-red-300 text-red-600 py-2 rounded-lg font-medium hover:bg-red-50 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LostPetCard;
