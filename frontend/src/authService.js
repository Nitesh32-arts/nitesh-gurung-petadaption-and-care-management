import apiClient from "./apiClient";

const ROLE_MAP = {
  adopter: "adopter",
  shelter: "shelter",
  veterinarian: "veterinarian",
};

export async function registerUser(form, selectedRole) {
  const role = ROLE_MAP[selectedRole] || "adopter";

  const payload = {
    username: form.email,
    email: form.email,
    password: form.password,
    password_confirm: form.confirmPassword,
    first_name: form.firstName || "",
    last_name: form.lastName || "",
    role,
    phone_number: form.phone || "",
    address: "",
  };

  const res = await apiClient.post("auth/register/", payload);
  return res.data;
}

export async function loginUser({ emailOrUsername, password }) {
  const payload = {
    username: emailOrUsername,
    password,
  };

  const res = await apiClient.post("auth/login/", payload);
  return res.data;
}

export async function fetchCurrentUser() {
  const res = await apiClient.get("auth/me/");
  return res.data;
}

/** GET role-based profile (same as me/ but explicit profile endpoint) */
export async function getProfile() {
  const res = await apiClient.get("profile/");
  return res.data?.user ?? res.data;
}

/** PATCH profile. Pass FormData if profile_picture file is included. */
export async function updateProfile(data) {
  const res = await apiClient.patch("profile/", data);
  return res.data?.user ?? res.data;
}

// ----- Verification (Vet/Shelter) -----

/** GET current user verification status */
export async function getVerificationStatus() {
  const res = await apiClient.get("auth/verification/status/", {
    headers: { "Cache-Control": "no-cache" },
  });
  return res.data;
}

/** POST verification documents (FormData). Fields: license_document, certification_document (vet) | registration_certificate, organization_document (shelter) */
export async function submitVerification(formData) {
  // Let browser set Content-Type with boundary - remove any default that would break multipart
  const config =
    formData instanceof FormData
      ? {
          transformRequest: [(data, headers) => {
            delete headers["Content-Type"];
            return data;
          }],
        }
      : {};
  const res = await apiClient.post("auth/verification/submit/", formData, config);
  return res.data;
}

/** GET verification notifications for current user */
export async function getVerificationNotifications() {
  const res = await apiClient.get("auth/verification/notifications/");
  return res.data;
}

/** POST mark verification notifications as read (optional body: { ids: [1,2] }) */
export async function markVerificationNotificationsRead(ids = null) {
  const res = await apiClient.post("auth/verification/notifications/", ids ? { ids } : {});
  return res.data;
}

// ----- Admin verification panel -----

/** GET pending verification requests */
export async function getPendingVerifications() {
  const res = await apiClient.get("auth/verification/pending/");
  return res.data;
}

/** GET verification detail for a user (admin) */
export async function getVerificationDetail(userId) {
  const res = await apiClient.get(`auth/verification/${userId}/`);
  return res.data;
}

/** POST approve verification (admin) */
export async function approveVerification(userId) {
  const res = await apiClient.post(`auth/verification/${userId}/approve/`);
  return res.data;
}

/** POST reject verification with reason (admin) */
export async function rejectVerification(userId, rejectionReason) {
  const res = await apiClient.post(`auth/verification/${userId}/reject/`, {
    rejection_reason: rejectionReason,
  });
  return res.data;
}

/** Get document download URL (admin). Use with apiClient baseURL so auth header is sent. */
export function getVerificationDocumentUrl(userId, fieldName) {
  return `/api/auth/verification/${userId}/document/${fieldName}/`;
}


