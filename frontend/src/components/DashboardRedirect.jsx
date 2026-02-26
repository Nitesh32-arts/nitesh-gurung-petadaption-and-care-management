import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const DashboardRedirect = () => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if ((user.role === 'veterinarian' || user.role === 'shelter') && !user.is_verified) {
    return <Navigate to="/verification" replace />;
  }

  const roleRoutes = {
    adopter: '/dashboard/adopter',
    shelter: '/dashboard/shelter',
    veterinarian: '/dashboard/vet',
    admin: '/dashboard/admin',
  };

  const redirectPath = roleRoutes[user.role] || '/dashboard/adopter';
  return <Navigate to={redirectPath} replace />;
};

export default DashboardRedirect;

