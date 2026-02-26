import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Profile from './pages/Profile';
import Messages from './pages/Messages';
import BrowsePets from './components/BrowsePets';
import LostAndFound from './components/LostAndFound';
import LostReportShare from './components/lostfound/LostReportShare';
import FoundReportShare from './components/lostfound/FoundReportShare';
import Matches from './components/Matches';
import Store from './components/Store';
import Cart from './components/store/Cart';
import Checkout from './components/store/Checkout';
import OrderDetail from './components/store/OrderDetail';
import OrdersList from './components/store/OrdersList';
import PaymentSuccess from './components/store/PaymentSuccess';
import PaymentFailure from './components/store/PaymentFailure';
import Login from './components/Login';
import Register from './components/Register';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardRedirect from './components/DashboardRedirect';
import AdopterDashboard from './components/dashboards/AdopterDashboard';
import ShelterDashboard from './components/dashboards/ShelterDashboard';
import VeterinarianDashboard from './components/dashboards/VeterinarianDashboard';
import AdminDashboard from './components/dashboards/AdminDashboard';
import PetDetail from './components/PetDetail';
import GlobalChatPopup from './components/GlobalChatPopup';
import VerificationSubmission from './components/VerificationSubmission';
import { ToastProvider } from './context/ToastContext';
import ToastContainer from './components/Toast';

function App() {
  return (
    <Router>
      <ToastProvider>
        <GlobalChatPopup />
        <ToastContainer />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/browse" element={<BrowsePets />} />
        <Route path="/pets/:id" element={<PetDetail />} />
        <Route path="/lost-found" element={<LostAndFound />} />
        <Route path="/lost-found/lost/:id" element={<LostReportShare />} />
        <Route path="/lost-found/found/:id" element={<FoundReportShare />} />
        <Route path="/lost-found/matches" element={<ProtectedRoute><Matches /></ProtectedRoute>} />
        <Route path="/lost-found/matches/:matchId" element={<ProtectedRoute><Matches /></ProtectedRoute>} />
        <Route path="/store" element={<Store />} />
        <Route path="/store/cart" element={<ProtectedRoute><Cart /></ProtectedRoute>} />
        <Route path="/store/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
        <Route path="/store/orders" element={<ProtectedRoute><OrdersList /></ProtectedRoute>} />
        <Route path="/store/orders/:id" element={<ProtectedRoute><OrderDetail /></ProtectedRoute>} />
        <Route path="/payment-success" element={<ProtectedRoute><PaymentSuccess /></ProtectedRoute>} />
        <Route path="/payment-failure" element={<ProtectedRoute><PaymentFailure /></ProtectedRoute>} />

        {/* Role-specific dashboard routes */}
        <Route
          path="/dashboard/adopter"
          element={
            <ProtectedRoute roles={['adopter']}>
              <AdopterDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/shelter"
          element={
            <ProtectedRoute roles={['shelter']}>
              <ShelterDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/vet"
          element={
            <ProtectedRoute roles={['veterinarian']}>
              <VeterinarianDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/admin"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        
        {/* Generic dashboard redirects to role-specific */}
        <Route
          path="/dashboard"
          element={<DashboardRedirect />}
        />
        
        <Route path="/verification" element={<ProtectedRoute><VerificationSubmission /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>
      </ToastProvider>
    </Router>
  );
}

export default App;
