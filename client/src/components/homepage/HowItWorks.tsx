import { Card } from '../ui/card';
import { Mic, Wand2, Headphones, BarChart3 } from 'lucide-react';

const steps = [
  {
    icon: Mic,
    step: '01',
    title: 'Capture Anything',
    description:
      'Voice, pictures, or text—dump any thought, feeling, or flash of inspiration. AI generates a title automatically.',
  },
  {
    icon: Wand2,
    step: '02',
    title: 'AI Connects the Dots',
    description:
      'Our AI analyzes your entries across time to understand patterns, emotions, and what matters most to you.',
  },
  {
    icon: Headphones,
    step: '03',
    title: 'Generate Your Meditation',
    description:
      'Select any journal entry or entries and create a 4–8 minute guided meditation built from your own words.',
  },
  {
    icon: BarChart3,
    step: '04',
    title: 'Weekly Insights',
    description:
      'Get a personalized report that surfaces your values, crystallizes insights, and reminds you what\'s important.',
  },
];

const HowItWorks = () => {
  return (
    <section className="py-24 px-4 bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto">
        <div className="text-center mb-16 space-y-4 animate-fade-in">
          <h2 className="text-4xl md:text-5xl font-bold">
            From Messy Notes to{' '}
            <span className="bg-gradient-primary bg-clip-text text-transparent">Mindful Reset</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Dump → Distill → Listen. It&apos;s that simple.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <Card
                key={step.title}
                className="p-6 bg-card/50 backdrop-blur-sm border-border/50 hover:shadow-soft transition-all duration-300 relative overflow-hidden group animate-fade-in-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="absolute top-0 right-0 text-8xl font-bold text-primary/5 -mr-4 -mt-4 group-hover:text-primary/10 transition-colors">
                  {step.step}
                </div>

                <div className="relative z-10 space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-soft">
                    <Icon className="w-6 h-6 text-primary-foreground" />
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-semibold text-primary">Step {step.step}</div>
                    <h3 className="text-xl font-semibold">{step.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
