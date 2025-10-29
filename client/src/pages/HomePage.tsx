import type { FC } from 'react';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Hero from '../components/homepage/Hero';
import Features from '../components/homepage/Features';
import HowItWorks from '../components/homepage/HowItWorks';
import Testimonials from '../components/homepage/Testimonials';
import Pricing from '../components/homepage/Pricing';
import InstallingReplay from '../components/homepage/InstallingReplay';
import FAQ from '../components/homepage/FAQ';
import CTA from '../components/homepage/CTA';
import Footer from '../components/homepage/Footer';

const HomePage: FC = () => {
  const { hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const element = document.getElementById(hash.slice(1));
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      window.scrollTo({ top: 0 });
    }
  }, [hash]);

  return (
    <div className="bg-background text-foreground">
      <Hero />
      <Features />
      <HowItWorks />
      <Testimonials />
      <Pricing />
      <CTA />
      <InstallingReplay />
      <FAQ />
      <Footer />
    </div>
  );
};

export default HomePage;
