import { Link } from 'react-router-dom';
import { Button } from '../ui/button';
import { ArrowRight, Sparkles } from 'lucide-react';
import featureAbstract from '../../assets/feature-abstract.jpg';

const CTA = () => {
  return (
    <section className="py-24 px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-hero" />

      <div className="container mx-auto relative z-10">
        <div className="max-w-4xl mx-auto">
          <div className="relative rounded-3xl overflow-hidden shadow-glow">
            <div className="absolute inset-0 opacity-30">
              <img src={featureAbstract} alt="Abstract gradient waves" className="w-full h-full object-cover" />
            </div>

            <div className="relative bg-gradient-primary/90 backdrop-blur-md p-12 md:p-16 text-center space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-foreground/20 backdrop-blur-sm rounded-full border border-primary-foreground/30">
                <Sparkles className="w-4 h-4 text-primary-foreground animate-glow" />
                <span className="text-sm font-medium text-primary-foreground">Start Free Today</span>
              </div>

              <h2 className="text-4xl md:text-5xl font-bold text-primary-foreground leading-tight">
                Your Mind Isn't Broken—It's Brilliant
              </h2>

              <p className="text-xl text-primary-foreground/90 max-w-2xl mx-auto">
                Start turning messy thoughts into calm, clarity, and meaning. One tap. One meditation. Your words.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <Button
                  asChild
                  variant="outlineHero"
                  size="xl"
                  className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 border-0 group shadow-soft"
                >
                  <Link to="/login">
                    Get Started Free
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
              </div>

              <p className="text-sm text-primary-foreground/80">
                No credit card required • 1-minute setup
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;
