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
      <div id="install" className="container mx-auto mt-20 max-w-5xl px-4">
        <div className="rounded-3xl border border-border/60 bg-card/90 p-10 shadow-soft backdrop-blur-sm space-y-8 animate-fade-in-up">
          <div className="space-y-4 text-center">
            <h3 className="text-3xl font-semibold text-foreground">Installing Replay</h3>
            <p className="text-muted-foreground text-lg">
              Replay works beautifully on desktop browsers, laptops, tablets, and phones. Here&apos;s how to keep it handy wherever you reflect.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <h4 className="text-xl font-semibold text-foreground">Using Replay as a web app</h4>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>
                  Visit{' '}
                  <a
                    href="https://replay-ai.app/login"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary font-semibold hover:underline"
                  >
                    replay-ai.app/login
                  </a>{' '}
                  on Chrome, Safari, Edge, or Firefox.
                </li>
                <li>Sign in and keep the tab pinned for quick access to your reflections.</li>
                <li>Replay syncs across devices, so you can start on your laptop and finish on your phone.</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="text-xl font-semibold text-foreground">Add Replay to your home screen</h4>
              <div className="rounded-2xl border border-border/60 bg-background/70 p-4 space-y-4 text-sm text-muted-foreground">
                <div>
                  <p className="text-base font-semibold text-foreground">iPhone & iPad (Safari)</p>
                  <ol className="list-decimal list-inside space-y-1 mt-2">
                    <li>Open Replay in Safari.</li>
                    <li>Tap the share icon, then choose <span className="font-semibold text-foreground">Add to Home Screen</span>.</li>
                    <li>Tap <span className="font-semibold text-foreground">Add</span> to install the app-like shortcut.</li>
                  </ol>
                </div>
                <div>
                  <p className="text-base font-semibold text-foreground">Android (Chrome)</p>
                  <ol className="list-decimal list-inside space-y-1 mt-2">
                    <li>Open Replay in Chrome.</li>
                    <li>Tap the menu (⋮) and pick <span className="font-semibold text-foreground">Add to Home screen</span>.</li>
                    <li>Confirm by tapping <span className="font-semibold text-foreground">Install</span>.</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Pricing;
