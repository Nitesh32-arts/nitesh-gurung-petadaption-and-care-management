import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import FeaturedPets from '../components/FeaturedPets';
import WhyChooseUs from '../components/WhyChooseUs';
import HowItWorks from '../components/HowItWorks';
import CTA from '../components/CTA';
import Footer from '../components/Footer';

const Home = () => {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main>
        <Hero />
        <FeaturedPets />
        <WhyChooseUs />
        <HowItWorks />
        <CTA />
      </main>
      <Footer />
    </div>
  );
};

export default Home;

