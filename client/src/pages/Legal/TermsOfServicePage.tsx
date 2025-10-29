import { useEffect, type FC } from 'react';
import Footer from '../../components/homepage/Footer';

const TermsOfServicePage: FC = () => {
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);
  return (
    <div className="min-h-screen bg-gradient-hero flex flex-col">
      <div className="container mx-auto flex-1 px-4 py-20 space-y-10">
        <header className="space-y-4 text-center animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground">Terms of Service</h1>
          <p className="text-muted-foreground text-lg">
            These terms outline your rights and responsibilities when using Replay.
          </p>
        </header>

        <section className="mx-auto max-w-4xl space-y-8 text-muted-foreground">
          <article className="rounded-3xl border border-border/60 bg-card/90 p-8 shadow-soft backdrop-blur-sm animate-fade-in-up">
            <h2 className="text-2xl font-semibold text-foreground mb-3">Using Replay</h2>
            <p className="leading-relaxed">
              Replay is designed for personal reflection and growth. Please use the platform responsibly, respect other community members where sharing is enabled, and avoid uploading content that infringes on the rights of others.
            </p>
          </article>

          <article className="rounded-3xl border border-border/60 bg-card/90 p-8 shadow-soft backdrop-blur-sm animate-fade-in-up">
            <h2 className="text-2xl font-semibold text-foreground mb-3">Subscriptions & billing</h2>
            <p className="leading-relaxed">
              Paid plans renew automatically unless cancelled the day before renewal. You can manage or cancel your subscription at any time within the Billing section. Refunds are evaluated case-by-case based on usage.
            </p>
          </article>

          <article className="rounded-3xl border border-border/60 bg-card/90 p-8 shadow-soft backdrop-blur-sm animate-fade-in-up">
            <h2 className="text-2xl font-semibold text-foreground mb-3">Updates to these terms</h2>
            <p className="leading-relaxed">
              We may update the terms to reflect new features or policies. When changes are significant, we will notify you in advance via email or in-app messaging.
            </p>
          </article>

          <p className="text-sm text-muted-foreground/80 text-center">
            Last updated: March 3, 2025. Contact <a className="text-primary font-semibold" href="mailto:legal@replay.ai">legal@replay.ai</a> with any questions.
          </p>
        </section>
      </div>
      <Footer />
    </div>
  );
};

export default TermsOfServicePage;
