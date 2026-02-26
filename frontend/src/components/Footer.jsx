import { Link } from 'react-router-dom';
import { PawPrint, Mail, Phone, MapPin } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-primary text-white mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Logo and Description */}
          <div className="lg:col-span-1">
            <Link to="/" className="flex items-center space-x-2 mb-4">
              <PawPrint className="h-8 w-8" />
              <span className="text-2xl font-bold">PetCare</span>
            </Link>
            <p className="text-emerald-100 text-sm">
              Connecting loving families with pets in need. Your trusted platform for pet adoption and care.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-bold text-lg mb-4">Quick Links</h3>
            <ul className="space-y-2 text-emerald-100">
              <li>
                <Link to="/" className="hover:text-white transition-colors">Home</Link>
              </li>
              <li>
                <Link to="/browse" className="hover:text-white transition-colors">Browse Pets</Link>
              </li>
              <li>
                <Link to="/lost-found" className="hover:text-white transition-colors">Lost & Found</Link>
              </li>
              <li>
                <Link to="/store" className="hover:text-white transition-colors">Pet Store</Link>
              </li>
            </ul>
          </div>

          {/* Account */}
          <div>
            <h3 className="font-bold text-lg mb-4">Account</h3>
            <ul className="space-y-2 text-emerald-100">
              <li>
                <a href="#signin" className="hover:text-white transition-colors">Sign In</a>
              </li>
              <li>
                <a href="#signup" className="hover:text-white transition-colors">Sign Up</a>
              </li>
              <li>
                <a href="#dashboard" className="hover:text-white transition-colors">Dashboard</a>
              </li>
            </ul>
          </div>

          {/* Contact Us */}
          <div>
            <h3 className="font-bold text-lg mb-4">Contact Us</h3>
            <ul className="space-y-3 text-emerald-100">
              <li className="flex items-center">
                <Mail className="h-5 w-5 mr-2" />
                <a href="mailto:info@petcare.com" className="hover:text-white transition-colors">
                  info@petcare.com
                </a>
              </li>
              <li className="flex items-center">
                <Phone className="h-5 w-5 mr-2" />
                <span>+1 (555) 123-4567</span>
              </li>
              <li className="flex items-center">
                <MapPin className="h-5 w-5 mr-2" />
                <span>San Francisco, CA</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-emerald-600 mt-8 pt-8 text-center text-emerald-100 text-sm">
          <p>&copy; {new Date().getFullYear()} PetCare. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

