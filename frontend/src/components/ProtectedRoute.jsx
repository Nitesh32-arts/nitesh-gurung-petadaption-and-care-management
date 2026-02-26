import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (roles && !roles.includes(user.role)) {
    // Redirect to user's own dashboard instead of generic /dashboard
    const roleRoutes = {
      adopter: '/dashboard/adopter',
      shelter: '/dashboard/shelter',
      veterinarian: '/dashboard/vet',
      admin: '/dashboard/admin',
    };
    const userDashboard = roleRoutes[user.role] || '/dashboard/adopter';
    return <Navigate to={userDashboard} replace />;
  }

  return children;
};

export default ProtectedRoute;


