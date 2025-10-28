import type { FC } from 'react';
import Footer from '../../components/homepage/Footer';

const AboutPage: FC = () => {
  return (
    <div className="min-h-screen bg-gradient-hero flex flex-col">
      <div className="container mx-auto flex-1 px-4 py-20 space-y-16">
        <header className="max-w-3xl space-y-6 animate-fade-in">
          <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
            My Story
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground">"All of us are in a search for meaning and purpose."</h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
             In my daily life, I am often bombarded with ideas, thoughts and struck by feelings or experiences that I want to remember. Yet, more often than not, they fade and I find myself facing new ideas, thoughts and feelings the next moment. Nothing gets remembered, in a deep sense of the word.
          </p>

          <p className="text-lg text-muted-foreground leading-relaxed">
             Just as how a cup of tea has to stay still before the tea leaves can settle, I believe that all of us need to have a quiet space to reflect and ruminate on the raw experiences that constitute the tapesty of our lives. 
          </p>

          <p className="text-lg text-muted-foreground leading-relaxed">
             Replay was born out of a desire to make it easy for all of us to connect the dots. Because when we do, we come closer to figuring out our meaning and purpose - our "why." It is my sincerest hope that Replay can be useful for your journey and adventures in life :)
          </p>
          
        </header>

        
        
      </div>
      <Footer />
    </div>
  );
};

export default AboutPage;
