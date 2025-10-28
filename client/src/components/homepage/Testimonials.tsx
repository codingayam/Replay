import { Card } from '../ui/card';
import { Quote } from 'lucide-react';

type Testimonial = {
  name: string;
  role: string;
  quote: string;
  rating: number;
};

const testimonials: Testimonial[] = [
  {
    name: 'Emma L.',
    role: 'College Student, 22',
    quote:
      "I can't switch off. Guided stuff helps, but it's generic. This app turns MY notes into a meditation I'll actually use. It's the first thing that's clicked for me.",
    rating: 5,
  },
  {
    name: 'Marcus T.',
    role: 'Marketing Manager, 31',
    quote:
      "I love journaling but it becomes backlog guilt. Now I just voice-record on my commute, and by the weekend I have a meditation ready. No guilt, just progress.",
    rating: 5,
  },
  {
    name: 'Jasmine K.',
    role: 'Freelance Designer, 26',
    quote:
      "I over-collect ideas, under-process them. This app finally gives me a format that works. Dump → distill → listen. My thoughts aren't the problem anymore—they're my guide.",
    rating: 5,
  },
];

const Testimonials = () => {
  return (
    <section className="py-24 px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-muted/30 via-background to-muted/30" />

      <div className="container mx-auto relative z-10">
        <div className="text-center mb-16 space-y-4 animate-fade-in">
          <h2 className="text-4xl md:text-5xl font-bold">
            Real People,{' '}
            <span className="bg-gradient-primary bg-clip-text text-transparent">Real Clarity</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Join thousands who've transformed messy thoughts into moments of calm
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <Card
              key={testimonial.name}
              className="p-8 bg-gradient-card border-border/50 hover:shadow-glow transition-all duration-300 hover:scale-105 animate-fade-in-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <Quote className="w-10 h-10 text-primary/20 mb-4" />

              <p className="text-foreground mb-6 leading-relaxed italic">"{testimonial.quote}"</p>

              <div className="flex items-center gap-1 mb-4">
                {Array.from({ length: testimonial.rating }, (_, i) => (
                  <span key={i} className="text-accent text-lg">
                    ★
                  </span>
                ))}
              </div>

              <div>
                <div className="font-semibold text-foreground">{testimonial.name}</div>
                <div className="text-sm text-muted-foreground">{testimonial.role}</div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
