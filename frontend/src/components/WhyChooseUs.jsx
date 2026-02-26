import { Search, FileText, Heart, MessageCircle, Shield, Gift } from 'lucide-react';

const WhyChooseUs = () => {
  const features = [
    {
      icon: Search,
      title: 'Advanced Search',
      description: 'Find the perfect pet with our powerful filtering and search capabilities.',
    },
    {
      icon: FileText,
      title: 'Digital Records',
      description: 'Keep all your pet\'s documents and records in one secure digital place.',
    },
    {
      icon: Heart,
      title: 'Health Tracking',
      description: 'Monitor your pet\'s health with comprehensive tracking and reminders.',
    },
    {
      icon: MessageCircle,
      title: 'Direct Communication',
      description: 'Connect directly with shelters and veterinarians through our platform.',
    },
    {
      icon: Shield,
      title: 'Verified Shelters',
      description: 'All shelters are verified and meet our high standards for animal care.',
    },
    {
      icon: Gift,
      title: 'Rewards System',
      description: 'Earn points and rewards for adopting and caring for your pets.',
    },
  ];

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-emerald-50 to-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Why Choose Our Platform
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            We provide everything you need for a seamless pet adoption and care experience.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow"
              >
                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                  <Icon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default WhyChooseUs;

