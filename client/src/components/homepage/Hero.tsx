import { Link } from 'react-router-dom';
import { Button } from '../ui/button';
import { Sparkles, ArrowRight } from 'lucide-react';
import heroImage from '../../assets/hero-meditation.jpg';

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-hero">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(120,119,198,0.1),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_60%,rgba(74,222,128,0.1),transparent_50%)]" />

      <div className="container mx-auto px-4 py-20 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-card/80 backdrop-blur-sm rounded-full border border-primary/20 shadow-soft">
              <Sparkles className="w-4 h-4 text-primary animate-glow" />
              <span className="text-sm font-medium text-foreground">ADHD-Friendly: Short, Structured, Zero Judgment</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold leading-tight">
              From Brain Dump to{' '}
              <span className="bg-gradient-primary bg-clip-text text-transparent">5-Minute Reset</span>
            </h1>

            <p className="text-xl text-muted-foreground max-w-xl">
              A quiet space to discover growth, calm and meaning from daily experiences.
              Journal with voice, pictures, or text — then turn them into personalized guided meditation sessions.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button asChild variant="hero" size="xl" className="group">
                <Link to="/login">
                  Start Your Journey
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              <Button variant="outlineHero" size="xl">
                Watch Demo
              </Button>
            </div>

            <div className="flex items-center gap-6 pt-4">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((item) => (
                  <div
                    key={item}
                    className="w-10 h-10 rounded-full bg-gradient-primary border-2 border-background"
                  />
                ))}
              </div>
              <div className="text-sm text-muted-foreground">
                Join <span className="font-semibold text-foreground">10,000+</span> mindful explorers
              </div>
            </div>
          </div>

          <div className="relative animate-scale-in">
            <div className="absolute inset-0 bg-gradient-primary opacity-20 blur-3xl rounded-full" />
            <img
              src={heroImage}
              alt="Person journaling in peaceful meditation space"
              className="relative rounded-3xl shadow-glow w-full animate-float"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
