import { Card } from '../ui/card';
import { Check } from 'lucide-react';

const plans = [
  {
    name: 'Starter',
    price: '$0',
    cadence: '',
    description: 'Dip your toes into Replay with voice, text, and photo journaling.',
    perks: ['10 free journal entries', '2 guided meditations', '2 weekly insight reports'],
    highlight: false,
  },
  {
    name: 'Focus',
    price: '$8',
    cadence: 'per month',
    description: 'For those ready to center your life with mindfulness, calm and purpose.',
    perks: ['Unlimited journals and uploads', 'Unlimited guided meditation generation', "Unlimited weekly insight reports", 'All current and future Replay features and upgrades'],
    highlight: true,
  },
  {
    name: 'Focus (Annual)',
    price: '$60',
    cadence: 'per year',
    description: 'For those ready to make a long-term commitment to yourselves.',
    perks: ['Unlimited journals and uploads', 'Unlimited guided meditation generation', 'Unlimited weekly insight reports', 'All current and future Replay features and upgrades'],
    highlight: false,
  },
];

const Pricing = () => {
  return (
    <section id="pricing" className="py-24 px-4 bg-gradient-to-b from-background via-muted/40 to-background">
      <div className="container mx-auto">
        <div className="text-center mb-16 space-y-4 animate-fade-in">
          <h2 className="text-4xl md:text-5xl font-bold">
            Find Your <span className="bg-gradient-primary bg-clip-text text-transparent">Replay</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Start free and try Replay for two weeks. Only upgrade when you&apos;re ready.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <Card
              key={plan.name}
              className={`relative p-8 backdrop-blur-sm border-border/50 animate-fade-in-up ${
                plan.highlight
                  ? 'bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 shadow-glow'
                  : 'bg-card shadow-soft'
              }`}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {plan.highlight && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-primary text-primary-foreground text-xs font-semibold tracking-wide px-4 py-1 rounded-full shadow-glow">
                  Most loved
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <h3 className="text-2xl font-semibold text-foreground">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">{plan.cadence}</span>
                </div>

                <ul className="space-y-3 text-sm text-muted-foreground">
                  {plan.perks.map((perk) => (
                    <li key={perk} className="flex items-start gap-2">
                      <Check className="mt-0.5 w-4 h-4 text-primary" />
                      <span>{perk}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pricing;
