import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "./DashboardLayout";
import { useAuth } from "../hooks/useAuth";
import {
  getVerificationStatus,
  submitVerification,
  fetchCurrentUser,
} from "../authService";
import { getErrorMessage } from "../utils/apiError";

const VerificationSubmission = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [files, setFiles] = useState({
    license_document: null,
    certification_document: null,
    registration_certificate: null,
    organization_document: null,
  });

  const isVet = user?.role === "veterinarian";
  const isShelter = user?.role === "shelter";
  const needsVerification = isVet || isShelter;

  useEffect(() => {
    if (!user) return;
    if (!needsVerification) {
      navigate("/dashboard", { replace: true });
      return;
    }
    setLoadError("");
    getVerificationStatus()
      .then((data) => {
        setStatus(data);
        setLoadError("");
      })
      .catch(() => {
        setLoadError("Failed to load verification status. Please try again.");
        setStatus(null);
      })
      .finally(() => setLoading(false));
  }, [user, needsVerification, navigate]);

  const handleFileChange = (e, field) => {
    const file = e.target.files?.[0];
    setFiles((prev) => ({ ...prev, [field]: file || null }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (isVet) {
      if (!files.license_document || !files.certification_document) {
        setError("Please upload both license and certification documents.");
        return;
      }
    } else if (isShelter) {
      if (!files.registration_certificate || !files.organization_document) {
        setError("Please upload both registration certificate and organization document.");
        return;
      }
    }
    setSubmitting(true);
    const formData = new FormData();
    if (files.license_document) formData.append("license_document", files.license_document);
    if (files.certification_document) formData.append("certification_document", files.certification_document);
    if (files.registration_certificate) formData.append("registration_certificate", files.registration_certificate);
    if (files.organization_document) formData.append("organization_document", files.organization_document);
    try {
      await submitVerification(formData);
      const updated = await getVerificationStatus();
      setStatus(updated);
      setFiles({ license_document: null, certification_document: null, registration_certificate: null, organization_document: null });
      const profile = await fetchCurrentUser();
      if (profile) updateUser(profile);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to submit documents. Please try again."));
      getVerificationStatus().then(setStatus).catch(() => {});
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;
  if (!needsVerification) return null;
  if (loading) {
    return (
      <DashboardLayout title="Verification">
        <p className="text-gray-600">Loading...</p>
      </DashboardLayout>
    );
  }

  if (loadError && !status) {
    return (
      <DashboardLayout title="Account Verification" subtitle="Unable to load verification status.">
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-800 max-w-xl">
          <p className="font-medium">{loadError}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setLoadError("");
              getVerificationStatus()
                .then((data) => {
                  setStatus(data);
                  setLoadError("");
                })
                .catch(() => setLoadError("Failed to load verification status. Please try again."))
                .finally(() => setLoading(false));
            }}
            className="mt-3 text-sm font-medium text-red-700 hover:underline"
          >
            Try again
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const submittedAt = status?.verification_submitted_at
    ? new Date(status.verification_submitted_at).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  return (
    <DashboardLayout
      title="Account Verification"
        subtitle={
        status?.is_verified
          ? "Your account is verified."
          : status?.verification_status === "rejected"
          ? "Verification was rejected. You may resubmit documents below."
          : status?.verification_status === "pending" && status?.verification_submitted_at
          ? "Your documents are under review."
          : "Submit your documents to get verified and unlock all features."
      }
    >
      <div className="space-y-6">
        {/* Status message - only show "under review" when user has actually submitted documents (has submitted date) */}
        {status?.verification_status === "pending" && status?.verification_submitted_at && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-amber-800">
            <p className="font-medium">Your documents are under review.</p>
            <p className="text-sm mt-1">Submitted: {submittedAt}</p>
          </div>
        )}
        {status?.verification_status === "approved" && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-emerald-800">
            <p className="font-medium">Your account is verified.</p>
            <p className="text-sm mt-1">You have full access to all features for your role.</p>
          </div>
        )}
        {status?.verification_status === "rejected" && status?.rejection_reason && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-800">
            <p className="font-medium">Verification rejected</p>
            <p className="text-sm mt-1">Reason: {status.rejection_reason}</p>
            <p className="text-sm mt-2">You may resubmit documents below.</p>
          </div>
        )}

        {/* Form: show only for first-time submit (pending, no submitted_at) or rejected (resubmit). Hide when under review. */}
        {(status?.verification_status === "rejected" ||
          (status?.verification_status === "pending" && !status?.verification_submitted_at)) && (
          <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            {isVet && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">License document (PDF or image)</label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleFileChange(e, "license_document")}
                    className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-emerald-50 file:text-emerald-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Certification document (PDF or image)</label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleFileChange(e, "certification_document")}
                    className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-emerald-50 file:text-emerald-700"
                  />
                </div>
              </>
            )}
            {isShelter && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Registration certificate (PDF or image)</label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleFileChange(e, "registration_certificate")}
                    className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-emerald-50 file:text-emerald-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Organization verification document (PDF or image)</label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleFileChange(e, "organization_document")}
                    className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-emerald-50 file:text-emerald-700"
                  />
                </div>
              </>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-primary hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Submitting..." : status?.verification_status === "rejected" ? "Resubmit documents" : "Submit for verification"}
            </button>
          </form>
        )}

        {status?.is_verified && (
          <p className="text-sm text-gray-600">
            <button
              type="button"
              onClick={() => navigate(user?.role === "veterinarian" ? "/dashboard/vet" : "/dashboard/shelter")}
              className="text-primary font-medium hover:underline"
            >
              Go to dashboard
            </button>
          </p>
        )}
      </div>
    </DashboardLayout>
  );
};

export default VerificationSubmission;
