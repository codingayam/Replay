import type { FC } from 'react';
import { useState } from 'react';
import { Mail, Send } from 'lucide-react';
import { Button } from '../../components/ui/button';
import Footer from '../../components/homepage/Footer';
import { cn } from '../../utils/cn';

const initialFormState = {
  name: '',
  email: '',
  subject: '',
  message: '',
};

const ContactPage: FC = () => {
  const [formData, setFormData] = useState(initialFormState);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('sending');

    // Mock async email send
    setTimeout(() => {
      setStatus('sent');
      setFormData(initialFormState);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex flex-col">
      <div className="container mx-auto flex-1 px-4 py-20">
        <div className="max-w-3xl mx-auto space-y-12">
          <header className="space-y-4 text-center animate-fade-in">
            <span className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              <Mail className="w-4 h-4" /> Reach the Replay team
            </span>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground">We&apos;d love to hear from you</h1>
            <p className="text-lg text-muted-foreground">
              Share feedback, partnership ideas, or just tell us how Replay is helping you grow. We read every message and reply within two business days.
            </p>
          </header>

          <form
            onSubmit={handleSubmit}
            className="space-y-6 rounded-3xl border border-border/60 bg-card/90 p-10 shadow-soft backdrop-blur-sm animate-fade-in-up"
          >
            <div className="grid md:grid-cols-2 gap-6">
              <label className="space-y-2 text-sm font-medium text-muted-foreground">
                Name
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Your full name"
                  required
                  className="w-full rounded-xl border border-border/60 bg-background/70 px-4 py-3 text-base text-foreground shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </label>
              <label className="space-y-2 text-sm font-medium text-muted-foreground">
                Email
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  required
                  className="w-full rounded-xl border border-border/60 bg-background/70 px-4 py-3 text-base text-foreground shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </label>
            </div>

            <label className="space-y-2 text-sm font-medium text-muted-foreground block">
              Subject
              <input
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                placeholder="How can we help?"
                required
                className="w-full rounded-xl border border-border/60 bg-background/70 px-4 py-3 text-base text-foreground shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>

            <label className="space-y-2 text-sm font-medium text-muted-foreground block">
              Message
              <textarea
                name="message"
                value={formData.message}
                onChange={handleChange}
                placeholder="Share as much detail as you like"
                required
                rows={6}
                className="w-full rounded-xl border border-border/60 bg-background/70 px-4 py-3 text-base text-foreground shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Button
                type="submit"
                variant="hero"
                size="xl"
                className={cn('group w-full sm:w-auto', {
                  'pointer-events-none opacity-70': status === 'sending',
                })}
              >
                {status === 'sending' ? (
                  'Sending...'
                ) : (
                  <span className="flex items-center gap-2">
                    Send message
                    <Send className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                )}
              </Button>
              <p className="text-sm text-muted-foreground">
                Email us anytime at{' '}
                <a href="mailto:hello@replay.ai" className="text-primary font-semibold">
                  hello@replay.ai
                </a>
              </p>
            </div>

            {status === 'sent' && (
              <div className="rounded-xl border border-emerald-400/50 bg-emerald-100/40 px-4 py-3 text-sm text-emerald-800">
                Thanks for reaching out! We&apos;ll reply soon.
              </div>
            )}
          </form>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ContactPage;
