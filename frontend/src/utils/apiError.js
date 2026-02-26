/**
 * Extract a user-friendly error message from an API error (axios-style or generic).
 * Handles DRF validation errors (non_field_errors, field-specific).
 * @param {Error} err - Caught error from apiClient or fetch
 * @param {string} fallback - Default message when nothing can be extracted
 * @returns {string}
 */
export function getErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback;
  const data = err.response?.data;
  if (data) {
    if (data.pet) return Array.isArray(data.pet) ? data.pet[0] : data.pet;
    if (data.detail) return typeof data.detail === 'string' ? data.detail : Array.isArray(data.detail) ? data.detail.join(', ') : String(data.detail);
    if (data.non_field_errors) return Array.isArray(data.non_field_errors) ? data.non_field_errors[0] : String(data.non_field_errors);
    // DRF field validation: license_document, certification_document, etc.
    if (typeof data === 'object') {
      const firstKey = Object.keys(data)[0];
      if (firstKey) {
        const val = data[firstKey];
        return Array.isArray(val) ? val[0] : String(val);
      }
    }
    if (data.message) return data.message;
    if (typeof data === 'string') return data;
    if (data.error) return typeof data.error === 'string' ? data.error : String(data.error);
  }
  return err.message || fallback;
}
