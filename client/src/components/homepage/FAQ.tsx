const faqs = [
  {
    question: 'How many photos can be uploaded in a journal?',
    answer: 'A maximum of 10 photos can be uploaded in a single journal entry.',
  },
  {
    question: 'How does the meditation generation work?',
    answer: 'Our proprietary generative AI models generate a meditation script based on the type of meditation and journals you select. After the script is generated, a separate AI model converts the script into speech - with a prosody that is suited to the type of meditation chosen.',
  },
  {
    question: 'How long does it take to generate a meditation?',
    answer:
      'It usually takes about 1-2 minutes.',
  },
  {
    question: 'How long is a typical meditation session?',
    answer:
      '10-12 minutes, depending on the content of the journals you choose and the type of meditation.',
  },
  {
    question: 'How secure is the information and data I share?',
    answer:
      'Replay is SOC 2 Type 2 compliant. All customer data is encrypted at rest with AES-256 and in transit via TLS. We also do not share any of your information with third parties.',
  },

  {
    question: 'How do I delete all my information if I want to stop using Replay?',
    answer:
      'You can delete your profile forever and permanently by navigating to the bottom of the Profile tab. Rest assured that no information will be retained by us.',
  },
];

const FAQ = () => {
  return (
    <section id="faq" className="py-24 px-4">
      <div className="container mx-auto max-w-4xl">
        <div className="text-center mb-12 space-y-4 animate-fade-in">
          <h2 className="text-4xl md:text-5xl font-bold">
            Questions <span className="bg-gradient-primary bg-clip-text text-transparent">Answered</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Everything you need to know before you dive into your first reflection.
          </p>
        </div>

        <div className="space-y-6">
          {faqs.map((faq, index) => (
            <div
              key={faq.question}
              className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm p-6 shadow-soft animate-fade-in-up"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <h3 className="text-xl font-semibold text-foreground mb-2">{faq.question}</h3>
              <p className="text-muted-foreground leading-relaxed">{faq.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQ;
