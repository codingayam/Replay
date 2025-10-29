import { useEffect, type FC } from 'react';
import Footer from '../../components/homepage/Footer';

const PrivacyPolicyPage: FC = () => {
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);
  return (
    <div className="min-h-screen bg-gradient-hero flex flex-col">
      <div className="container mx-auto flex-1 px-4 py-20 space-y-10">
        <header className="space-y-4 text-center animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground">Privacy Policy</h1>
          <p className="text-muted-foreground text-lg">
            We built Replay with privacy-first principles. This policy explains how we collect, use, and protect your personal information.
          </p>
        </header>

        <section className="mx-auto max-w-4xl space-y-8 text-muted-foreground">
          <article className="rounded-3xl border border-border/60 bg-card/90 p-8 shadow-soft backdrop-blur-sm animate-fade-in-up">
            <h2 className="text-2xl font-semibold text-foreground mb-3">Information we collect</h2>
            <p className="leading-relaxed">
              We store the content you add to Replay (journal entries, uploads, reflections), along with the preferences you choose to personalize your experience. We never sell this information, and we never use it to train external AI models.
            </p>
          </article>

          <article className="rounded-3xl border border-border/60 bg-card/90 p-8 shadow-soft backdrop-blur-sm animate-fade-in-up">
            <h2 className="text-2xl font-semibold text-foreground mb-3">How we use your data</h2>
            <p className="leading-relaxed">
              Data powers features such as guided meditation generation, streak tracking, and weekly insight reports. We keep processing scoped to Replay&apos;s functionality and only retain the minimum information required to deliver these services reliably.
            </p>
          </article>

          <article className="rounded-3xl border border-border/60 bg-card/90 p-8 shadow-soft backdrop-blur-sm animate-fade-in-up">
            <h2 className="text-2xl font-semibold text-foreground mb-3">Your controls</h2>
            <p className="leading-relaxed">
              You can export your data, request deletion at any time, or permanently close your account from the Profile tab. When deletion is confirmed, we remove logs and backups within 30 days.
            </p>
          </article>

          <p className="text-sm text-muted-foreground/80 text-center">
            Questions? Email us at <a className="text-primary font-semibold" href="mailto:privacy@replay.ai">privacy@replay.ai</a>.
          </p>
        </section>
      </div>
      <Footer />
    </div>
  );
};

export default PrivacyPolicyPage;
