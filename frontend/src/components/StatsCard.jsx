const StatsCard = ({ title, value, icon, iconBg = "bg-emerald-100", onClick }) => {
  const Icon = icon;
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      onClick={onClick}
      className={`bg-emerald-50 rounded-xl shadow-md hover:shadow-lg transition transform hover:-translate-y-0.5 p-4 flex items-center justify-between ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div>
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
      </div>
      <div
        className={`flex items-center justify-center w-11 h-11 rounded-xl ${iconBg} text-primary`}
      >
        <Icon className="w-6 h-6" />
      </div>
    </Component>
  );
};

export default StatsCard;

