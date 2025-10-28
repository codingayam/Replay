import { Card } from '../ui/card';
import { Mic, Camera, Sparkles, TrendingUp } from 'lucide-react';

const features = [
  {
    icon: Mic,
    title: 'Journaling Done Your Way',
    description:
      'Voice notes, photos, or text—capture thoughts as they come.',
    gradient: 'from-primary/20 to-secondary/20',
  },
  {
    icon: Sparkles,
    title: 'Meditations Built from Your Words',
    description:
      'Generate personalized 5–10 minute guided meditations based on your own journals and reflections. Your thoughts become your guide.',
    gradient: 'from-secondary/20 to-accent/20',
  },
  {
    icon: TrendingUp,
    title: 'Weekly Pulse',
    description:
      'AI surfaces patterns, identifies your core values, and crystallizes insights from the week. Understand yourself better, day by day.',
    gradient: 'from-accent/20 to-primary/20',
  },
  {
    icon: Camera,
    title: 'Connect the Dots',
    description:
      'Make sense of scattered thoughts and experiences. Find meaning, calm, authenticity, and a path forward—one entry at a time.',
    gradient: 'from-primary/20 to-accent/20',
  },
];

const Features = () => {
  return (
    <section className="py-24 px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-muted/30 to-background" />

      <div className="container mx-auto relative z-10">
        <div className="text-center mb-16 space-y-4 animate-fade-in">
          <h2 className="text-4xl md:text-5xl font-bold">
            Don't Fight Thoughts—{' '}
            <span className="bg-gradient-primary bg-clip-text text-transparent">Shape Them</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Easy brain dumps. AI-powered insights. Personalized meditations. All in one quiet space.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card
                key={feature.title}
                className="p-8 bg-card hover:shadow-glow transition-all duration-300 border-border/50 hover:scale-105 animate-fade-in-up group"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div
                  className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}
                >
                  <Icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-2xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Features;
