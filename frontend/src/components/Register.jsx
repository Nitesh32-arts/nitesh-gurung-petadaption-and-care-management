import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import InputField from "./InputField";
import RoleSelector from "./RoleSelector";
import { useAuth } from "../hooks/useAuth";
import { getErrorMessage } from "../utils/apiError";
import { prefetchDashboard } from "../services/dashboardService";

const Register = () => {
  const { register, loading } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState("adopter");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { id, value } = e.target;
    setForm((prev) => ({ ...prev, [id]: value }));
  };

  const redirectAfterRegister = (user) => {
    if (user.role === 'veterinarian' || user.role === 'shelter') {
      navigate('/verification', { replace: true });
      return;
    }
    const roleRoutes = {
      adopter: '/dashboard/adopter',
      admin: '/dashboard/admin',
    };
    const redirectPath = roleRoutes[user.role] || '/dashboard/adopter';
    navigate(redirectPath, { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!acceptedTerms) return;
    setError("");

    // Basic frontend validation to avoid obvious backend rejections
    if (!form.email) {
      setError("Please enter your email.");
      return;
    }

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      const user = await register(form, role);
      prefetchDashboard(user);
      redirectAfterRegister(user);
    } catch (err) {
      if (err.code === "ERR_NETWORK") {
        setError("Cannot reach the server. Make sure the Django backend is running on http://localhost:8000.");
        return;
      }
      const data = err.response?.data;
      if (data && (data.email || data.username)) {
        setError("An account with this email or username already exists.");
        return;
      }
      setError(getErrorMessage(err, "Registration failed. Please try again."));
    }
  };

  return (
    <AuthLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">
            Create Account
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Join our community and start your journey
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-600 text-center">{error}</p>
        )}

        <form className="space-y-5" onSubmit={handleSubmit}>
          {/* Role selection */}
          <RoleSelector value={role} onChange={setRole} />

          {/* Name fields - two-column on sm+ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField
              label="First Name"
              id="firstName"
              type="text"
              autoComplete="given-name"
              value={form.firstName}
              onChange={handleChange}
            />
            <InputField
              label="Last Name"
              id="lastName"
              type="text"
              autoComplete="family-name"
              value={form.lastName}
              onChange={handleChange}
            />
          </div>

          {/* Single-column fields */}
          <InputField
            label="Email"
            id="email"
            type="email"
            placeholder="your@email.com"
            autoComplete="email"
            value={form.email}
            onChange={handleChange}
          />

          <InputField
            label="Phone"
            id="phone"
            type="tel"
            placeholder="(555) 123-4567"
            autoComplete="tel"
            value={form.phone}
            onChange={handleChange}
          />

          <InputField
            label="Password"
            id="password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={handleChange}
          />

          <InputField
            label="Confirm Password"
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={handleChange}
          />

          {/* Terms checkbox */}
          <div className="flex items-start gap-2 text-sm">
            <input
              id="terms"
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <label htmlFor="terms" className="text-gray-700">
              I agree to the{" "}
              <button
                type="button"
                className="text-primary hover:text-emerald-700 font-medium underline-offset-2 hover:underline"
              >
                Terms of Service
              </button>{" "}
              and{" "}
              <button
                type="button"
                className="text-primary hover:text-emerald-700 font-medium underline-offset-2 hover:underline"
              >
                Privacy Policy
              </button>
            </label>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={!acceptedTerms || loading}
            className={`w-full mt-1 inline-flex justify-center items-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1
              ${
                acceptedTerms
                  ? "bg-primary hover:bg-emerald-600 active:bg-emerald-700 cursor-pointer"
                  : "bg-emerald-300 cursor-not-allowed"
              }`}
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        {/* Footer text */}
        <p className="pt-1 text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-semibold text-primary hover:text-emerald-700"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
};

export default Register;


