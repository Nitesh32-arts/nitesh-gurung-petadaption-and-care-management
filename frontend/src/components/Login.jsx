import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import InputField from "./InputField";
import { useAuth } from "../hooks/useAuth";
import { prefetchDashboard } from "../services/dashboardService";

const Login = () => {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");

  // Reset form when landing on login (e.g. after logout) so switching users starts clean
  useEffect(() => {
    setForm({ email: "", password: "" });
    setError("");
  }, []);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setForm((prev) => ({ ...prev, [id]: value }));
  };

  const redirectAfterLogin = (user) => {
    const role = user?.role;
    const isVetOrShelter = role === 'veterinarian' || role === 'shelter';
    const isVerified = user?.is_verified === true;

    // Unverified vet/shelter must complete verification first
    if (isVetOrShelter && !isVerified) {
      navigate('/verification', { replace: true });
      return;
    }

    const from = location.state?.from?.pathname;
    if (from && from !== "/login" && from.startsWith("/dashboard")) {
      navigate(from, { replace: true });
      return;
    }

    const roleRoutes = {
      adopter: '/dashboard/adopter',
      shelter: '/dashboard/shelter',
      veterinarian: '/dashboard/vet',
      admin: '/dashboard/admin',
    };
    const redirectPath = roleRoutes[role] || '/dashboard/adopter';
    navigate(redirectPath, { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const user = await login({
        emailOrUsername: form.email,
        password: form.password,
      });
      prefetchDashboard(user);
      redirectAfterLogin(user);
    } catch (err) {
      console.error(err);
      setError("Invalid email or password.");
    }
  };

  return (
    <AuthLayout>
      {/* Title + Subtitle */}
      <div className="mb-6 text-center">
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">
          Welcome Back
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Sign in to your account to continue
        </p>
      </div>

      {error && (
        <p className="mb-3 text-sm text-red-600 text-center">{error}</p>
      )}

      {/* Form */}
      <form className="space-y-5" onSubmit={handleSubmit}>
        <InputField
          label="Email or Username"
          id="email"
          type="text"
          placeholder="you@example.com"
          autoComplete="email"
          value={form.email}
          onChange={handleChange}
        />

        <InputField
          label="Password"
          id="password"
          type="password"
          autoComplete="current-password"
          value={form.password}
          onChange={handleChange}
        />

        {/* Options row */}
        <div className="flex items-center justify-between text-sm">
          <label className="inline-flex items-center gap-2 text-gray-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span>Remember me</span>
          </label>
          <button
            type="button"
            className="text-primary hover:text-emerald-700 font-medium"
          >
            Forgot password?
          </button>
        </div>

        {/* Primary button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full mt-1 inline-flex justify-center items-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-emerald-600 active:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 disabled:opacity-70"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>

      {/* Footer text */}
      <p className="mt-6 text-center text-sm text-gray-600">
        Don&apos;t have an account?{" "}
        <Link
          to="/register"
          className="font-semibold text-primary hover:text-emerald-700"
        >
          Sign up
        </Link>
      </p>
    </AuthLayout>
  );
};

export default Login;

