import type { FC } from 'react';
import { useEffect } from 'react';
import { Mail } from 'lucide-react';
import Footer from '../../components/homepage/Footer';

const ContactPage: FC = () => {
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-hero flex flex-col">
      <div className="container mx-auto flex-1 px-4 py-20">
        <div className="max-w-3xl mx-auto space-y-12">
          <header className="space-y-4 text-center animate-fade-in">
            <span className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              <Mail className="w-4 h-4" /> Reach the Replay team
            </span>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground">We&apos;d love to hear from you</h1>
            <p className="text-lg text-muted-foreground">
              Share feedback, partnership ideas, or just tell us how Replay is helping you grow. Drop us a note any time at{' '}
              <a href="mailto:xj@replay-ai.app" className="text-primary font-semibold">
                xj@replay-ai.app
              </a>
              . We respond to every message within two business days.
            </p>
          </header>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ContactPage;
