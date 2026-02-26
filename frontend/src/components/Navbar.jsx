import { Link, useLocation, useNavigate } from 'react-router-dom';
import { PawPrint, User, LogOut, Menu, X, Bell, ShoppingCart } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { notificationsService } from '../services/adopterService';
import { storeService } from '../services/storeService';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notificationDropdownOpen, setNotificationDropdownOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [avatarImageError, setAvatarImageError] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  const profilePictureUrl = user?.profile_picture_url || user?.profile_picture;

  const loadCartCount = useCallback(async () => {
    if (!user) return;
    try {
      const cart = await storeService.getCart();
      setCartCount(cart?.item_count ?? 0);
    } catch {
      setCartCount(0);
    }
  }, [user]);

  useEffect(() => {
    loadCartCount();
  }, [loadCartCount]);

  useEffect(() => {
    const handler = () => loadCartCount();
    window.addEventListener('cartUpdated', handler);
    return () => window.removeEventListener('cartUpdated', handler);
  }, [loadCartCount]);

  useEffect(() => {
    setAvatarImageError(false);
  }, [profilePictureUrl]);

  const loadNotificationCount = useCallback(async () => {
    if (user?.role !== 'adopter') return;
    try {
      const count = await notificationsService.getUnreadCount();
      setUnreadCount(count);
    } catch {
      setUnreadCount(0);
    }
  }, [user?.role]);

  const loadNotifications = useCallback(async () => {
    if (user?.role !== 'adopter') return;
    setNotificationsLoading(true);
    try {
      const list = await notificationsService.getAll();
      setNotifications(Array.isArray(list) ? list : []);
      await loadNotificationCount();
    } catch {
      setNotifications([]);
    } finally {
      setNotificationsLoading(false);
    }
  }, [user?.role, loadNotificationCount]);

  useEffect(() => {
    loadNotificationCount();
  }, [loadNotificationCount]);

  useEffect(() => {
    if (notificationDropdownOpen && user?.role === 'adopter') {
      loadNotifications();
    }
  }, [notificationDropdownOpen, user?.role, loadNotifications]);

  const linkBase = 'text-gray-700 hover:text-primary transition-colors font-medium';
  const isActive = (path) => location.pathname === path ? 'text-primary font-semibold' : '';

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
    setProfileDropdownOpen(false);
    setMobileMenuOpen(false);
  };

  const getDashboardPath = () => {
    if (!user) return '/dashboard';
    const roleRoutes = {
      adopter: '/dashboard/adopter',
      shelter: '/dashboard/shelter',
      veterinarian: '/dashboard/vet',
      admin: '/dashboard/admin',
    };
    return roleRoutes[user.role] || '/dashboard/adopter';
  };

  const getUserInitials = () => {
    if (!user) return '';
    const firstName = user.first_name || '';
    const lastName = user.last_name || '';
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    return user.username?.[0]?.toUpperCase() || 'U';
  };

  return (
    <nav className="sticky top-0 z-50 bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <PawPrint className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold text-gray-900">PetCare</span>
          </Link>

          {/* Center Links - Hidden on mobile */}
          <div className="hidden md:flex items-center space-x-8 text-sm">
            <Link to="/" className={`${linkBase} ${isActive('/')}`}>
              Home
            </Link>
            <Link to="/browse" className={`${linkBase} ${isActive('/browse')}`}>
              Browse Pets
            </Link>
            {user && (
              <>
                <Link to={getDashboardPath()} className={`${linkBase} ${isActive('/dashboard')}`}>
                  Dashboard
                </Link>
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('openChat'))}
                  className={linkBase}
                >
                  Messages
                </button>
              </>
            )}
            <Link to="/lost-found" className={`${linkBase} ${isActive('/lost-found')}`}>
              Lost &amp; Found
            </Link>
            <Link to="/store" className={`${linkBase} ${isActive('/store')}`}>
              Store
            </Link>
          </div>

          {/* Right Buttons */}
          <div className="flex items-center space-x-4">
            {user ? (
              <>
                {/* Notifications (adopter only) - beside navbar */}
                {user.role === 'adopter' && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setNotificationDropdownOpen(!notificationDropdownOpen);
                        setProfileDropdownOpen(false);
                      }}
                      className="relative p-2 rounded-lg hover:bg-gray-100 transition text-gray-700"
                      aria-label="Notifications"
                    >
                      <Bell className="w-6 h-6" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-xs font-medium flex items-center justify-center">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </button>
                    {notificationDropdownOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setNotificationDropdownOpen(false)}
                          aria-hidden="true"
                        />
                        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-hidden bg-white rounded-lg shadow-lg border z-20 flex flex-col">
                          <div className="p-3 border-b flex items-center justify-between gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900">Notifications</span>
                            <div className="flex items-center gap-2">
                              {unreadCount > 0 && (
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      await notificationsService.markAllAsRead();
                                      loadNotificationCount();
                                      loadNotifications();
                                    } catch (err) {
                                      console.error('Failed to mark all as read:', err);
                                    }
                                  }}
                                  className="text-sm text-primary hover:underline"
                                >
                                  Mark all read
                                </button>
                              )}
                              <Link
                                to="/dashboard/adopter"
                                onClick={() => setNotificationDropdownOpen(false)}
                                className="text-sm text-primary hover:underline"
                              >
                                View all
                              </Link>
                            </div>
                          </div>
                          <div className="overflow-y-auto max-h-72">
                            {notificationsLoading ? (
                              <div className="p-4 text-center text-sm text-gray-500">Loading...</div>
                            ) : notifications.length === 0 ? (
                              <p className="p-4 text-sm text-gray-500">No notifications yet.</p>
                            ) : (
                              notifications.slice(0, 8).map((n) => (
                                <div
                                  key={n.id}
                                  className={`p-3 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer ${
                                    n.is_read ? 'bg-white' : 'bg-blue-50/50'
                                  }`}
                                  onClick={async () => {
                                    if (!n.is_read) {
                                      try {
                                        await notificationsService.markAsRead(n.id);
                                        loadNotificationCount();
                                        setNotifications((prev) =>
                                          prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x))
                                        );
                                      } catch (err) {
                                        console.error('Failed to mark as read:', err);
                                      }
                                    }
                                  }}
                                >
                                  <p className="text-sm font-medium text-gray-900">{n.title}</p>
                                  <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{n.message}</p>
                                  <p className="text-xs text-gray-400 mt-1">
                                    {n.created_at ? new Date(n.created_at).toLocaleDateString() : ''}
                                  </p>
                                  {!n.is_read && (
                                    <button
                                      type="button"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        try {
                                          await notificationsService.markAsRead(n.id);
                                          loadNotificationCount();
                                          setNotifications((prev) =>
                                            prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x))
                                          );
                                        } catch (err) {
                                          console.error('Failed to mark as read:', err);
                                        }
                                      }}
                                      className="text-xs text-primary hover:underline mt-1"
                                    >
                                      Mark read
                                    </button>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Cart */}
                <Link
                  to="/store/cart"
                  className="relative p-2 rounded-lg hover:bg-gray-100 transition text-gray-700"
                  aria-label="Cart"
                >
                  <ShoppingCart className="w-6 h-6" />
                  {cartCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-white text-xs font-medium flex items-center justify-center">
                      {cartCount > 99 ? '99+' : cartCount}
                    </span>
                  )}
                </Link>

                {/* User Profile Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setProfileDropdownOpen(!profileDropdownOpen);
                      setNotificationDropdownOpen(false);
                    }}
                    className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-semibold overflow-hidden shrink-0">
                      {profilePictureUrl && !avatarImageError ? (
                        <img
                          src={profilePictureUrl}
                          alt={user.username}
                          className="w-full h-full rounded-full object-cover"
                          onError={() => setAvatarImageError(true)}
                        />
                      ) : (
                        <span className="leading-none">{getUserInitials()}</span>
                      )}
                    </div>
                    <span className="hidden sm:block text-sm font-medium text-gray-700">
                      {user.first_name || user.username}
                    </span>
                  </button>

                  {/* Dropdown Menu */}
                  {profileDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setProfileDropdownOpen(false)}
                      />
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 z-20">
                        <Link
                          to="/profile"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                          onClick={() => setProfileDropdownOpen(false)}
                        >
                          <User className="w-4 h-4 mr-2" />
                          Profile
                        </Link>
                        <Link
                          to="/store/orders"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                          onClick={() => setProfileDropdownOpen(false)}
                        >
                          <ShoppingCart className="w-4 h-4 mr-2" />
                          My Orders
                        </Link>
                        <button
                          onClick={handleLogout}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center"
                        >
                          <LogOut className="w-4 h-4 mr-2" />
                          Logout
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-gray-700 hover:text-primary transition-colors font-medium px-4 py-2 text-sm"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="bg-primary text-white px-6 py-2 rounded-full font-medium hover:bg-emerald-600 transition-colors shadow-md text-sm"
                >
                  Sign Up
                </Link>
              </>
            )}

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6 text-gray-700" />
              ) : (
                <Menu className="w-6 h-6 text-gray-700" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t">
            <div className="flex flex-col space-y-2">
              <Link to="/" className={`${linkBase} px-4 py-2`} onClick={() => setMobileMenuOpen(false)}>
                Home
              </Link>
              <Link to="/browse" className={`${linkBase} px-4 py-2`} onClick={() => setMobileMenuOpen(false)}>
                Browse Pets
              </Link>
              {user ? (
                <>
                  <Link to={getDashboardPath()} className={`${linkBase} px-4 py-2`} onClick={() => setMobileMenuOpen(false)}>
                    Dashboard
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('openChat'));
                      setMobileMenuOpen(false);
                    }}
                    className={`${linkBase} px-4 py-2 w-full text-left`}
                  >
                    Messages
                  </button>
                  {user.role === 'adopter' && (
                    <Link
                      to="/dashboard/adopter"
                      className={`${linkBase} px-4 py-2 flex items-center gap-2`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Bell className="w-4 h-4" />
                      Notifications
                      {unreadCount > 0 && (
                        <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className="text-left text-red-600 px-4 py-2 font-medium"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link to="/lost-found" className={`${linkBase} px-4 py-2`} onClick={() => setMobileMenuOpen(false)}>
                    Lost & Found
                  </Link>
                  <Link to="/store" className={`${linkBase} px-4 py-2`} onClick={() => setMobileMenuOpen(false)}>
                    Store
                  </Link>
                  <Link to="/login" className={`${linkBase} px-4 py-2`} onClick={() => setMobileMenuOpen(false)}>
                    Sign In
                  </Link>
                  <Link to="/register" className={`${linkBase} px-4 py-2`} onClick={() => setMobileMenuOpen(false)}>
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;

