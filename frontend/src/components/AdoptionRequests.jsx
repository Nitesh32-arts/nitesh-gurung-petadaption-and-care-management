const STATUS_STYLES = {
  Pending: "bg-yellow-100 text-yellow-800",
  Approved: "bg-emerald-100 text-emerald-800",
};

const requests = [
  {
    id: 1,
    petName: "Bella",
    shelter: "Happy Tails Shelter",
    date: "Jan 20, 2026",
    status: "Pending",
    image:
      "https://images.pexels.com/photos/5731865/pexels-photo-5731865.jpeg?auto=compress&cs=tinysrgb&w=200",
  },
  {
    id: 2,
    petName: "Max",
    shelter: "Golden Paws Rescue",
    date: "Jan 18, 2026",
    status: "Approved",
    image:
      "https://images.pexels.com/photos/4587995/pexels-photo-4587995.jpeg?auto=compress&cs=tinysrgb&w=200",
  },
  {
    id: 3,
    petName: "Luna",
    shelter: "City Animal Care",
    date: "Jan 15, 2026",
    status: "Pending",
    image:
      "https://images.pexels.com/photos/5731862/pexels-photo-5731862.jpeg?auto=compress&cs=tinysrgb&w=200",
  },
];

const AdoptionRequests = () => {
  return (
    <section className="bg-white rounded-xl shadow-md hover:shadow-lg transition transform hover:-translate-y-0.5 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Recent Adoption Requests
        </h2>
        <button
          type="button"
          className="text-sm font-medium text-primary hover:underline"
        >
          View All
        </button>
      </div>

      <ul className="space-y-4">
        {requests.map((req) => (
          <li key={req.id} className="flex items-center gap-4">
            <img
              src={req.image}
              alt={req.petName}
              className="w-12 h-12 rounded-lg object-cover"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">
                {req.petName}
              </p>
              <p className="text-xs text-gray-500">
                {req.shelter} • {req.date}
              </p>
            </div>
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                STATUS_STYLES[req.status] || ""
              }`}
            >
              {req.status}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default AdoptionRequests;


