const faqs = [
  {
    question: 'How many photos can be uploaded in a journal?',
    answer: 'A maximum of 10 photos can be uploaded in a single journal entry.',
  },
  {
    question: 'How long does it take to generate a meditation?',
    answer:
      'It usually takes about 1-2 minutes for the AI to generate your personalized meditation. The process involves taking your selected journals, and sending it to a specialized AI model to generate the script for the guided meditation. The script is then sent to yet another trained AI model to produce the audio itself in a soothing and calm voice. To minimize waiting time, we recommend users to close the app anytime after the generation. The app will notify the users when meditation generation is complete.',
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
