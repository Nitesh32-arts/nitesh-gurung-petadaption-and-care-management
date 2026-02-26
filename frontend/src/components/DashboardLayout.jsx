import Navbar from './Navbar';
import Footer from './Footer';

const DashboardLayout = ({ children, title, subtitle }) => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {(title || subtitle) && (
            <header className="mb-6">
              {title && (
                <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="mt-1 text-sm text-gray-600">{subtitle}</p>
              )}
            </header>
          )}
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default DashboardLayout;

