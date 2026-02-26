const CTA = () => {
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-primary to-emerald-600">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Ready to Make a Difference?
        </h2>
        <p className="text-lg text-emerald-100 mb-8 max-w-2xl mx-auto">
          Join thousands of happy pet owners who found their perfect companion through PetCare. Start your adoption journey today!
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button className="bg-white text-primary px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors shadow-lg">
            Browse Pets
          </button>
          <button className="bg-secondary text-white px-8 py-3 rounded-lg font-semibold hover:bg-amber-600 transition-colors shadow-lg">
            Register as Shelter
          </button>
        </div>
      </div>
    </section>
  );
};

export default CTA;

