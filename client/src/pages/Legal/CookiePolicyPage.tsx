import type { FC } from 'react';
import Footer from '../../components/homepage/Footer';

const CookiePolicyPage: FC = () => {
  return (
    <div className="min-h-screen bg-gradient-hero flex flex-col">
      <div className="container mx-auto flex-1 px-4 py-20 space-y-10">
        <header className="space-y-4 text-center animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground">Cookie Policy</h1>
          <p className="text-muted-foreground text-lg">
            Cookies help Replay stay secure, remember your preferences, and improve your experience.
          </p>
        </header>

        <section className="mx-auto max-w-4xl space-y-8 text-muted-foreground">
          <article className="rounded-3xl border border-border/60 bg-card/90 p-8 shadow-soft backdrop-blur-sm animate-fade-in-up">
            <h2 className="text-2xl font-semibold text-foreground mb-3">Essential cookies</h2>
            <p className="leading-relaxed">
              These cookies keep you signed in, remember your onboarding progress, and secure access to protected areas of Replay. They are required for the product to function.
            </p>
          </article>

          <article className="rounded-3xl border border-border/60 bg-card/90 p-8 shadow-soft backdrop-blur-sm animate-fade-in-up">
            <h2 className="text-2xl font-semibold text-foreground mb-3">Analytics & performance</h2>
            <p className="leading-relaxed">
              We use privacy-aware analytics to understand how features perform. Metrics are aggregated and anonymized—we never sell analytics data or use invasive trackers.
            </p>
          </article>

          <article className="rounded-3xl border border-border/60 bg-card/90 p-8 shadow-soft backdrop-blur-sm animate-fade-in-up">
            <h2 className="text-2xl font-semibold text-foreground mb-3">Managing preferences</h2>
            <p className="leading-relaxed">
              You can update cookie preferences any time from the Profile tab or by emailing <a className="text-primary font-semibold" href="mailto:privacy@replay.ai">privacy@replay.ai</a>. Disabling essential cookies may limit functionality.
            </p>
          </article>

          <p className="text-sm text-muted-foreground/80 text-center">
            Last updated: March 3, 2025.
          </p>
        </section>
      </div>
      <Footer />
    </div>
  );
};

export default CookiePolicyPage;
