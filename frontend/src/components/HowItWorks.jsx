import { Search, Heart, FileCheck, Home } from 'lucide-react';

const HowItWorks = () => {
  const steps = [
    {
      number: '01',
      icon: Search,
      title: 'Search & Filter',
      description: 'Browse through our extensive database of pets and use filters to find your perfect match.',
    },
    {
      number: '02',
      icon: Heart,
      title: 'Choose Your Pet',
      description: 'View detailed profiles, photos, and health records to make an informed decision.',
    },
    {
      number: '03',
      icon: FileCheck,
      title: 'Submit Request',
      description: 'Fill out the adoption form and submit your request to the shelter.',
    },
    {
      number: '04',
      icon: Home,
      title: 'Welcome Home',
      description: 'Complete the adoption process and welcome your new family member home!',
    },
  ];

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            How It Works
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Our simple four-step process makes pet adoption easy and stress-free.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={index} className="text-center">
                <div className="relative mb-6">
                  <div className="text-6xl font-bold text-gray-200 absolute -top-4 left-1/2 transform -translate-x-1/2 -z-10">
                    {step.number}
                  </div>
                  <div className="bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto relative">
                    <Icon className="h-10 w-10 text-primary" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-gray-600">{step.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;

