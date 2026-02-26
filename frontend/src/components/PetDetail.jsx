import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPin, Calendar, Users, Heart, ArrowLeft, Shield, Mail, Phone, MessageCircle } from 'lucide-react';
import Navbar from './Navbar';
import Footer from './Footer';
import { petsService } from '../services/petsService';
import { adoptionRequestsService, healthRecordsService } from '../services/adopterService';
import { useAuth } from '../hooks/useAuth';
import { getErrorMessage } from '../utils/apiError';

const PetDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [pet, setPet] = useState(null);
  const [healthRecords, setHealthRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [hasRequested, setHasRequested] = useState(false);
  const [requestError, setRequestError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    fetchPetDetails();
  }, [id, user]);

  const fetchPetDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const petIdNum = parseInt(id, 10);
      const isAdopter = user?.role === 'adopter';
      const [petData, healthRecordsData, hasPending] = await Promise.all([
        petsService.getById(id),
        user ? healthRecordsService.getForPets([petIdNum]).catch(() => []) : Promise.resolve([]),
        isAdopter ? adoptionRequestsService.checkPending(petIdNum) : Promise.resolve(false),
      ]);
      setPet(petData);
      setHealthRecords(healthRecordsData);
      if (isAdopter && hasPending) setHasRequested(true);
    } catch (err) {
      console.error('Failed to fetch pet details:', err);
      if (err.response?.status === 404) {
        setError('Pet not found.');
      } else {
        setError('Failed to load pet details. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAdoptionRequest = async () => {
    if (!user || user.role !== 'adopter') return;
    
    // Validate pet.id exists
    if (!pet || !pet.id) {
      setRequestError('Invalid pet data. Please refresh the page and try again.');
      return;
    }
    
    setRequestError(null);
    setIsRequesting(true);
    
    try {
      await adoptionRequestsService.create(pet.id);
      setHasRequested(true);
      setSuccessMessage('Adoption request sent successfully!');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setRequestError(getErrorMessage(err, 'Failed to send adoption request. Please try again.'));
    } finally {
      setIsRequesting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600">Loading pet details...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !pet) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <button
            onClick={() => navigate(-1)}
            className="mb-6 flex items-center text-primary hover:text-emerald-600 transition"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Browse
          </button>
          <div className="text-center py-12">
            <p className="text-red-600 text-lg mb-4">{error || 'Pet not found'}</p>
            <button
              onClick={() => navigate('/browse')}
              className="bg-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-emerald-600 transition"
            >
              Browse Pets
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Filter vaccination records
  const vaccinationRecords = healthRecords.filter(record => 
    record.record_type === 'vaccination' && record.vaccination
  );

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center text-primary hover:text-emerald-600 transition"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back
        </button>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {successMessage}
          </div>
        )}

        {/* Error Message */}
        {requestError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {requestError}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Pet Images */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              {pet.primary_image ? (
                <img
                  src={pet.primary_image}
                  alt={pet.name}
                  className="w-full h-96 object-cover"
                />
              ) : pet.images && pet.images.length > 0 ? (
                <img
                  src={pet.images[0].image_url}
                  alt={pet.name}
                  className="w-full h-96 object-cover"
                />
              ) : (
                <div className="w-full h-96 bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-400">No image available</span>
                </div>
              )}
              
              {/* Additional Images */}
              {pet.images && pet.images.length > 1 && (
                <div className="grid grid-cols-4 gap-2 p-4">
                  {pet.images.slice(1, 5).map((img, index) => (
                    <img
                      key={img.id || index}
                      src={img.image_url || img.image}
                      alt={`${pet.name} ${index + 2}`}
                      className="w-full h-24 object-cover rounded-lg"
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Pet Information */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">{pet.name}</h1>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="flex items-center text-gray-600">
                  <Users className="w-5 h-5 mr-2 text-primary" />
                  <span className="font-medium">Breed:</span>
                  <span className="ml-2">{pet.breed || 'Not specified'}</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <Calendar className="w-5 h-5 mr-2 text-primary" />
                  <span className="font-medium">Age:</span>
                  <span className="ml-2">{pet.age ? `${pet.age} ${pet.age === 1 ? 'month' : 'months'}` : 'Unknown'}</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <Users className="w-5 h-5 mr-2 text-primary" />
                  <span className="font-medium">Gender:</span>
                  <span className="ml-2 capitalize">{pet.gender || 'Unknown'}</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <MapPin className="w-5 h-5 mr-2 text-primary" />
                  <span className="font-medium">Location:</span>
                  <span className="ml-2">{pet.location || 'Not specified'}</span>
                </div>
              </div>

              {pet.health_status && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center">
                    <Shield className="w-5 h-5 mr-2 text-primary" />
                    Health Status
                  </h3>
                  <p className="text-gray-700">{pet.health_status}</p>
                </div>
              )}

              {pet.description && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">About</h3>
                  <p className="text-gray-700 leading-relaxed">{pet.description}</p>
                </div>
              )}
            </div>

            {/* Vaccination Records */}
            {vaccinationRecords.length > 0 && (
              <div className="bg-white rounded-xl shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <Shield className="w-5 h-5 mr-2 text-primary" />
                  Vaccination Records
                </h2>
                <div className="space-y-4">
                  {vaccinationRecords.map((record) => (
                    <div key={record.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-gray-900">{record.vaccination.vaccine_type}</h3>
                        <span className="text-sm text-gray-500">
                          {formatDate(record.vaccination.administered_date)}
                        </span>
                      </div>
                      {record.vaccination.next_due_date && (
                        <p className="text-sm text-gray-600">
                          Next due: {formatDate(record.vaccination.next_due_date)}
                        </p>
                      )}
                      {record.description && (
                        <p className="text-sm text-gray-600 mt-2">{record.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Adoption Request Card */}
            <div className="bg-white rounded-xl shadow-md p-6 sticky top-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Adoption Information</h2>
              
              {/* Shelter Information */}
              {pet.shelter_info && (
                <div className="mb-6">
                  <h3 className="font-medium text-gray-900 mb-2">Shelter</h3>
                  <p className="text-gray-700">{pet.shelter_info.username}</p>
                  {pet.shelter_info.email && (
                    <p className="text-sm text-gray-600 flex items-center mt-1">
                      <Mail className="w-4 h-4 mr-1" />
                      {pet.shelter_info.email}
                    </p>
                  )}
                  {user?.role === 'adopter' && pet.shelter_info.id && (
                    <button
                      type="button"
                      onClick={() => window.dispatchEvent(new CustomEvent('openChat', { detail: { userId: pet.shelter_info.id, petId: pet.id, name: pet.shelter_info.username } }))}
                      className="mt-2 flex items-center gap-1.5 text-sm text-primary hover:text-emerald-600 font-medium"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Message Shelter
                    </button>
                  )}
                </div>
              )}

              {/* Status Badge */}
              <div className="mb-6">
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  pet.status === 'available' 
                    ? 'bg-green-100 text-green-800' 
                    : pet.status === 'pending'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {pet.status?.charAt(0).toUpperCase() + pet.status?.slice(1)}
                </span>
              </div>

              {/* Request Adoption Button */}
              {user?.role === 'adopter' && pet.status === 'available' && (
                <div className="space-y-2">
                  {hasRequested ? (
                    <button
                      disabled
                      className="w-full bg-gray-300 text-gray-600 py-3 rounded-lg font-medium cursor-not-allowed"
                    >
                      Request Already Sent
                    </button>
                  ) : (
                    <button
                      onClick={handleAdoptionRequest}
                      disabled={isRequesting}
                      className="w-full bg-secondary text-white py-3 rounded-lg font-medium hover:bg-orange-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      {isRequesting ? 'Sending Request...' : 'Request Adoption'}
                    </button>
                  )}
                  <p className="text-xs text-gray-500 text-center">
                    Submit an adoption request to this shelter
                  </p>
                </div>
              )}

              {(!user || user.role !== 'adopter') && pet.status === 'available' && (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-600 mb-3">
                    {!user ? 'Please log in as an adopter to request adoption.' : 'Only adopters can request adoption.'}
                  </p>
                  {!user && (
                    <button
                      onClick={() => navigate('/login')}
                      className="text-primary hover:text-emerald-600 text-sm font-medium"
                    >
                      Log In
                    </button>
                  )}
                </div>
              )}

              {pet.status !== 'available' && (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-600">
                    This pet is not available for adoption.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PetDetail;

