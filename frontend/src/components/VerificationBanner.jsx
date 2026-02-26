import { Link } from "react-router-dom";

/**
 * Show when user is Vet or Shelter and not verified.
 * PENDING: "Your documents are under review."
 * REJECTED: "Verification rejected: <reason>" + link to resubmit
 */
const VerificationBanner = ({ user }) => {
  if (!user) return null;
  const role = user.role;
  if (role !== "veterinarian" && role !== "shelter") return null;
  if (user.is_verified) return null;

  const status = user.verification_status || "pending";
  const hasSubmitted = !!user.verification_submitted_at;

  if (status === "pending" && hasSubmitted) {
    return (
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 mb-6 text-amber-800">
        <p className="font-medium">Your documents are under review.</p>
        <p className="text-sm mt-1">You will get full access once an admin approves your verification.</p>
        <Link to="/verification" className="text-sm font-medium text-amber-700 hover:underline mt-2 inline-block">
          View verification status →
        </Link>
      </div>
    );
  }

  if (status === "pending" && !hasSubmitted) {
    return (
      <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 mb-6 text-blue-800">
        <p className="font-medium">Complete your verification</p>
        <p className="text-sm mt-1">Submit your documents to get verified and unlock all features.</p>
        <Link to="/verification" className="text-sm font-medium text-blue-700 hover:underline mt-2 inline-block">
          Submit documents →
        </Link>
      </div>
    );
  }

  if (status === "rejected") {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-4 mb-6 text-red-800">
        <p className="font-medium">Verification rejected</p>
        {user.rejection_reason && (
          <p className="text-sm mt-1">Reason: {user.rejection_reason}</p>
        )}
        <Link to="/verification" className="text-sm font-medium text-red-700 hover:underline mt-2 inline-block">
          Resubmit documents →
        </Link>
      </div>
    );
  }

  return null;
};

export default VerificationBanner;
