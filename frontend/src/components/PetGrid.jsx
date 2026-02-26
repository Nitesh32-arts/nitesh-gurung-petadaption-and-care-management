import PetCard from './PetCard';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { adoptionRequestsService } from '../services/adopterService';
import { useState } from 'react';

const PetGrid = ({ pets, viewMode = 'grid', onAdoptionRequestSuccess }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [requestingPets, setRequestingPets] = useState(new Set());
  const [requestedPets, setRequestedPets] = useState(new Set());
  const [errors, setErrors] = useState({});

  const handleAdoptionRequest = async (petId) => {
    if (!user || user.role !== 'adopter') return;
    
    setRequestingPets(prev => new Set(prev).add(petId));
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[petId];
      return newErrors;
    });
    
    try {
      await adoptionRequestsService.create(petId);
      setRequestedPets(prev => new Set(prev).add(petId));
      onAdoptionRequestSuccess?.();
    } catch (err) {
      console.error('Adoption request failed:', err);
      
      // Extract error message from various possible formats
      let errorMessage = 'Failed to send adoption request. Please try again.';
      
      if (err.response?.data) {
        const data = err.response.data;
        
        // Check for field-specific errors (e.g., {'pet': ['error message']})
        if (data.pet) {
          errorMessage = Array.isArray(data.pet) ? data.pet[0] : data.pet;
        }
        // Check for non-field errors (e.g., {'detail': 'error message'})
        else if (data.detail) {
          errorMessage = data.detail;
        }
        // Check for general error message
        else if (data.message) {
          errorMessage = data.message;
        }
        // Check if data is a string
        else if (typeof data === 'string') {
          errorMessage = data;
        }
        // Check for nested error structure
        else if (data.error) {
          errorMessage = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setErrors(prev => ({ ...prev, [petId]: errorMessage }));
    } finally {
      setRequestingPets(prev => {
        const newSet = new Set(prev);
        newSet.delete(petId);
        return newSet;
      });
    }
  };

  if (viewMode === 'list') {
    return (
      <div className="space-y-4">
        {pets.map((pet) => (
          <div key={pet.id} className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all overflow-hidden">
            <div className="flex flex-col md:flex-row">
              <div className="md:w-64 h-64 md:h-auto relative">
                {pet.image ? (
                  <img
                    src={pet.image}
                    alt={pet.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-400">No image</span>
                  </div>
                )}
                <span className="absolute top-4 right-4 bg-primary text-white px-3 py-1 rounded-full text-sm font-medium">
                  Available
                </span>
              </div>
              <div className="flex-1 p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-1">{pet.name}</h3>
                <p className="text-gray-600 mb-2">{pet.breed}</p>
                {pet.description && (
                  <p className="text-sm text-gray-500 mb-4">{pet.description}</p>
                )}
                <div className="flex items-center text-sm text-gray-600 mb-4 space-x-4">
                  <span>{pet.age}</span>
                  <span>•</span>
                  <span>{pet.gender}</span>
                  <span>•</span>
                  <span>{pet.location}</span>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => navigate(`/pets/${pet.id}`)}
                    className="bg-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-emerald-600 transition-colors"
                  >
                    View Details
                  </button>
                  {user?.role === 'adopter' && pet.status === 'available' && (
                    <>
                      {requestedPets.has(pet.id) ? (
                        <button
                          disabled
                          className="bg-gray-300 text-gray-600 px-6 py-2 rounded-lg font-medium cursor-not-allowed"
                        >
                          Request Sent
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAdoptionRequest(pet.id)}
                          disabled={requestingPets.has(pet.id)}
                          className="bg-secondary text-white px-6 py-2 rounded-lg font-medium hover:bg-orange-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                        >
                          {requestingPets.has(pet.id) ? 'Sending...' : 'Request Adoption'}
                        </button>
                      )}
                    </>
                  )}
                </div>
                {errors[pet.id] && (
                  <p className="text-xs text-red-600 mt-1">{errors[pet.id]}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {pets.map((pet) => (
        <PetCard key={pet.id} pet={pet} onAdoptionRequestSuccess={onAdoptionRequestSuccess} />
      ))}
    </div>
  );
};

export default PetGrid;

