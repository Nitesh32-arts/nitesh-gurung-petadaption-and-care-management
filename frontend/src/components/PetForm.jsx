import { useState, useEffect } from 'react';
import { X, Upload } from 'lucide-react';
import apiClient from '../apiClient';

const PetForm = ({ pet, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    pet_type: 'dog',
    breed: '',
    age: '',
    gender: 'male',
    health_status: '',
    description: '',
    location: '',
    status: 'available',
  });
  const [images, setImages] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadingImages, setUploadingImages] = useState(false);

  useEffect(() => {
    if (pet) {
      setFormData({
        name: pet.name || '',
        pet_type: pet.pet_type || 'dog',
        breed: pet.breed || '',
        age: pet.age || '',
        gender: pet.gender || 'male',
        health_status: pet.health_status || '',
        description: pet.description || '',
        location: pet.location || '',
        status: pet.status || 'available',
      });
      setExistingImages(Array.isArray(pet.images) ? pet.images : []);
    } else {
      // Reset form when creating new pet
      setFormData({
        name: '',
        pet_type: 'dog',
        breed: '',
        age: '',
        gender: 'male',
        health_status: '',
        description: '',
        location: '',
        status: 'available',
      });
      setExistingImages([]);
      setImages([]);
    }
  }, [pet]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    setImages(prev => [...prev, ...files]);
  };

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = async (imageId) => {
    try {
      // Note: You may need to add a delete endpoint for images
      // For now, we'll just remove it from the UI
      setExistingImages(prev => prev.filter(img => img.id !== imageId));
    } catch (err) {
      console.error('Failed to delete image:', err);
    }
  };

  const uploadImages = async (petId) => {
    // Safely check images array
    if (!images || !Array.isArray(images) || images.length === 0) return;

    setUploadingImages(true);
    try {
      for (let i = 0; i < images.length; i++) {
        const formData = new FormData();
        formData.append('image', images[i]);
        // Safely check existingImages array
        const hasExistingImages = existingImages && Array.isArray(existingImages) && existingImages.length > 0;
        formData.append('is_primary', i === 0 && !hasExistingImages);
        
        // DO NOT manually set Content-Type - browser will set it with boundary automatically
        await apiClient.post(`/pets/${petId}/upload_image/`, formData);
      }
    } catch (err) {
      throw err;
    } finally {
      setUploadingImages(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Prepare data - ensure age is an integer
      const submitData = {
        ...formData,
        age: parseInt(formData.age, 10),
      };

      let response;
      
      if (pet) {
        // Update existing pet
        // Exclude shelter and other read-only fields from update payload
        const { shelter, shelter_info, primary_image, id, created_at, updated_at, ...updateData } = submitData;
        
        // Use PATCH for partial updates (more appropriate than PUT)
        response = await apiClient.patch(`/pets/${pet.id}/`, updateData);
        
        // Check if request was successful (200 or 201)
        if (response.status === 200 || response.status === 201) {
          if (images && Array.isArray(images) && images.length > 0) {
            try {
              await uploadImages(pet.id);
            } catch {
              // Pet update succeeded; images can be added later
            }
          }
        }
      } else {
        // Create new pet
        response = await apiClient.post('/pets/', submitData);
        
        // Check if request was successful (200 or 201)
        if (response.status === 200 || response.status === 201) {
          const newPetId = response.data.id;
          if (images && Array.isArray(images) && images.length > 0 && newPetId) {
            try {
              await uploadImages(newPetId);
            } catch {
              // Pet creation succeeded; images can be added later
            }
          }
        }
      }

      // If we reach here, the pet was created/updated successfully
      // Clear any previous errors and reset form state
      setError('');
      setImages([]);
      
      // Call success callback to refresh pet list (images are already uploaded)
      // This ensures the refreshed list includes the newly uploaded images
      onSuccess?.();
      onClose();
      
    } catch (err) {
      console.error('Failed to save pet - Full error:', err);
      
      // Only show error if HTTP status is >= 400 or network error
      const status = err.response?.status;
      const isNetworkError = err.code === 'ERR_NETWORK' || err.message?.includes('Network Error');
      
      if (isNetworkError) {
        setError('Cannot reach the server. Make sure the Django backend is running on http://localhost:8000.');
      } else if (status === 404) {
        setError('API endpoint not found. Please check if the backend server is running on http://localhost:8000 and the endpoint /api/pets/ is accessible.');
      } else if (status === 403) {
        const detail = err.response?.data?.detail;
        setError(
          typeof detail === 'string' ? detail : 'Permission denied. Make sure you are logged in as a shelter user.'
        );
      } else if (status === 401) {
        setError('Authentication failed. Please log in again.');
      } else if (status >= 400) {
        // Handle other HTTP errors (400, 500, etc.)
        const errorData = err.response?.data;
        if (errorData?.detail) {
          setError(errorData.detail);
        } else if (errorData?.message) {
          setError(errorData.message);
        } else if (typeof errorData === 'object') {
          // Extract field errors
          const fieldErrors = Object.entries(errorData)
            .map(([field, errors]) => {
              const errorMsg = Array.isArray(errors) ? errors.join(', ') : String(errors);
              return `${field}: ${errorMsg}`;
            })
            .join('; ');
          setError(fieldErrors || 'Validation failed. Please check your input.');
        } else {
          setError('Failed to save pet. Please check your input and try again.');
        }
      } else {
        // Unknown error
        setError(err.message || 'Failed to save pet. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            {pet ? 'Edit Pet' : 'Add New Pet'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pet Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pet Type *
              </label>
              <select
                name="pet_type"
                value={formData.pet_type}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="dog">Dog</option>
                <option value="cat">Cat</option>
                <option value="bird">Bird</option>
                <option value="rabbit">Rabbit</option>
                <option value="hamster">Hamster</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Breed *
              </label>
              <input
                type="text"
                name="breed"
                value={formData.breed}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Age (months) *
              </label>
              <input
                type="number"
                name="age"
                value={formData.age}
                onChange={handleChange}
                required
                min="0"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gender *
              </label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status *
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="available">Available</option>
                <option value="pending">Pending Adoption</option>
                <option value="adopted">Adopted</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Location *
            </label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
              required
              placeholder="City, State or Full Address"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Health Status *
            </label>
            <textarea
              name="health_status"
              value={formData.health_status}
              onChange={handleChange}
              required
              rows="3"
              placeholder="Current health status, vaccinations, medical conditions..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description *
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              rows="4"
              placeholder="Detailed description of the pet, personality, special needs..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {/* Images */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pet Images
            </label>
            
            {/* Existing Images */}
            {existingImages && Array.isArray(existingImages) && existingImages.length > 0 && (
              <div className="grid grid-cols-4 gap-4 mb-4">
                {existingImages.map((img) => (
                  <div key={img.id} className="relative group">
                    <img
                      src={img.image_url || img.image}
                      alt="Pet"
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    {pet && (
                      <button
                        type="button"
                        onClick={() => removeExistingImage(img.id)}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* New Images Preview */}
            {images && Array.isArray(images) && images.length > 0 && (
              <div className="grid grid-cols-4 gap-4 mb-4">
                {images.map((img, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={URL.createObjectURL(img)}
                      alt="Preview"
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <label className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary transition">
              <div className="text-center">
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <span className="text-sm text-gray-600">Click to upload images</span>
              </div>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-4 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || uploadingImages}
              className="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-emerald-600 transition disabled:opacity-50"
            >
              {loading || uploadingImages ? 'Saving...' : pet ? 'Update Pet' : 'Add Pet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PetForm;

