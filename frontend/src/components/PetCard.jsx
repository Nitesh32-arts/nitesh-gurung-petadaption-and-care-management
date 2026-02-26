import { MapPin, Heart, Calendar, Users } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { adoptionRequestsService, savedPetsService } from '../services/adopterService';
import { getErrorMessage } from '../utils/apiError';

const PetCard = ({ pet, onAdoptionRequestSuccess, onSaveChange }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isFavorited, setIsFavorited] = useState(false);
  const [isSaveLoading, setIsSaveLoading] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [hasRequested, setHasRequested] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user?.role === 'adopter' && pet?.id) {
      savedPetsService.isSaved(pet.id).then(setIsFavorited).catch(() => setIsFavorited(false));
    } else {
      setIsFavorited(false);
    }
  }, [user?.role, pet?.id]);

  const handleSaveClick = async () => {
    if (!user || user.role !== 'adopter' || !pet?.id) return;
    setIsSaveLoading(true);
    setError(null);
    try {
      if (isFavorited) {
        const saved = await savedPetsService.getAll();
        const entry = saved.find(sp => sp.pet?.id === pet.id);
        if (entry?.id) {
          await savedPetsService.unsave(entry.id);
          setIsFavorited(false);
        }
      } else {
        await savedPetsService.save(pet.id);
        setIsFavorited(true);
      }
      onSaveChange?.();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save pet. Try again.');
    } finally {
      setIsSaveLoading(false);
    }
  };

  const handleAdoptionRequest = async () => {
    if (!user || user.role !== 'adopter') return;
    
    // Validate pet.id exists
    if (!pet || !pet.id) {
      setError('Invalid pet data. Please refresh the page and try again.');
      return;
    }
    
    setError(null);
    setIsRequesting(true);
    
    try {
      await adoptionRequestsService.create(pet.id);
      setHasRequested(true);
      onAdoptionRequestSuccess?.();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to send adoption request. Please try again.'));
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1 overflow-hidden">
      <div className="relative">
        {pet.image ? (
          <img
            src={pet.image}
            alt={pet.name}
            className="w-full h-64 object-cover"
          />
        ) : (
          <div className="w-full h-64 bg-gray-200 flex items-center justify-center">
            <span className="text-gray-400">No image</span>
          </div>
        )}
        <span className="absolute top-4 right-4 bg-primary text-white px-3 py-1 rounded-full text-sm font-medium">
          Available
        </span>
        {user?.role === 'adopter' && (
          <button
            type="button"
            onClick={handleSaveClick}
            disabled={isSaveLoading}
            className="absolute top-4 left-4 bg-white/90 hover:bg-white rounded-full p-2 transition-colors disabled:opacity-70"
            aria-label={isFavorited ? 'Remove from saved' : 'Save pet'}
          >
            <Heart
              className={`h-5 w-5 transition-colors ${
                isFavorited ? 'fill-red-500 text-red-500' : 'text-gray-600 hover:text-red-500'
              }`}
            />
          </button>
        )}
      </div>
      <div className="p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-1">{pet.name}</h3>
        <p className="text-gray-600 mb-2">{pet.breed}</p>
        {pet.description && (
          <p className="text-sm text-gray-500 mb-4 line-clamp-2">{pet.description}</p>
        )}
        <div className="flex items-center text-sm text-gray-600 mb-4 space-x-4">
          <div className="flex items-center">
            <Calendar className="h-4 w-4 mr-1 text-primary" />
            <span>{pet.age}</span>
          </div>
          <div className="flex items-center">
            <Users className="h-4 w-4 mr-1 text-primary" />
            <span>{pet.gender}</span>
          </div>
          <div className="flex items-center">
            <MapPin className="h-4 w-4 mr-1 text-primary" />
            <span className="truncate">{pet.location}</span>
          </div>
        </div>
        <div className="space-y-2">
          <button 
            onClick={() => navigate(`/pets/${pet.id}`)}
            className="w-full bg-primary text-white py-2.5 rounded-lg font-medium hover:bg-emerald-600 transition-colors"
          >
            View Details
          </button>
          {user?.role === 'adopter' && pet.status === 'available' && (
            <>
              {hasRequested ? (
                <button
                  disabled
                  className="w-full bg-gray-300 text-gray-600 py-2.5 rounded-lg font-medium cursor-not-allowed"
                >
                  Request Sent
                </button>
              ) : (
                <button
                  onClick={handleAdoptionRequest}
                  disabled={isRequesting}
                  className="w-full bg-secondary text-white py-2.5 rounded-lg font-medium hover:bg-orange-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {isRequesting ? 'Sending Request...' : 'Request Adoption'}
                </button>
              )}
              {error && (
                <p className="text-xs text-red-600 text-center">{error}</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PetCard;

