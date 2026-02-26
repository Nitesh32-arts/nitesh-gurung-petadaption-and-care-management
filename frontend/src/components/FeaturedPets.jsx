import PetCard from './PetCard';

const FeaturedPets = () => {
  const pets = [
    {
      id: 1,
      name: 'Luna',
      breed: 'Golden Retriever',
      age: '2 years',
      gender: 'Female',
      location: 'New York, NY',
      image: 'https://images.unsplash.com/photo-1633722715463-d30f4f325e24?w=400&q=80',
    },
    {
      id: 2,
      name: 'Max',
      breed: 'Persian',
      age: '1 year',
      gender: 'Male',
      location: 'Los Angeles, CA',
      image: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400&q=80',
    },
    {
      id: 3,
      name: 'Bella',
      breed: 'Labrador',
      age: '3 years',
      gender: 'Female',
      location: 'Chicago, IL',
      image: 'https://images.unsplash.com/photo-1552053831-71594a27632d?w=400&q=80',
    },
    {
      id: 4,
      name: 'Charlie',
      breed: 'Siamese',
      age: '6 months',
      gender: 'Male',
      location: 'Miami, FL',
      image: 'https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=400&q=80',
    },
    {
      id: 5,
      name: 'Daisy',
      breed: 'Beagle',
      age: '1.5 years',
      gender: 'Female',
      location: 'Seattle, WA',
      image: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=400&q=80',
    },
    {
      id: 6,
      name: 'Rocky',
      breed: 'German Shepherd',
      age: '4 years',
      gender: 'Male',
      location: 'Boston, MA',
      image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&q=80',
    },
  ];

  return (
    <section id="browse" className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Meet Our Featured Pets
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Discover loving companions waiting for their forever homes. Each pet is health-checked and ready to join your family.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {pets.map((pet) => (
            <PetCard key={pet.id} pet={pet} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturedPets;

