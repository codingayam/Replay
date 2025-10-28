import type { FC } from 'react';
import Hero from '../components/homepage/Hero';
import Features from '../components/homepage/Features';
import HowItWorks from '../components/homepage/HowItWorks';
import Testimonials from '../components/homepage/Testimonials';
import CTA from '../components/homepage/CTA';
import Footer from '../components/homepage/Footer';

const HomePage: FC = () => {
  return (
    <div className="bg-background text-foreground">
      <Hero />
      <Features />
      <HowItWorks />
      <Testimonials />
      <CTA />
      <Footer />
    </div>
  );
};

export default HomePage;
