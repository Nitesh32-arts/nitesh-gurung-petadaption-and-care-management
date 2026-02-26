import { PawPrint } from "lucide-react";

const AuthLayout = ({ children, title = "PetCare" }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-emerald-100">
      <div className="w-full max-w-lg px-4 sm:px-6">
        {/* Logo / Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary text-white shadow-md mb-3">
            <PawPrint className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {title}
          </h1>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl shadow-lg px-6 py-7 sm:px-8 sm:py-8">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;


