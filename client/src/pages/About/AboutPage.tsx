import { useEffect, type FC } from 'react';
import Footer from '../../components/homepage/Footer';

const AboutPage: FC = () => {
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);
  return (
    <div className="min-h-screen bg-gradient-hero flex flex-col">
      <div className="container mx-auto flex-1 px-4 py-20 space-y-16">
        <header className="max-w-3xl space-y-6 animate-fade-in">
          <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
            My Story
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground">"The universal thing about everyone is that we are all searching for meaning and purpose - the reason for our existence."</h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
          Only when the cup of tea is still can the tea leaves settle - we all need a quiet space to reflect and ruminate on the raw experiences that constitute the tapesty of our lives.
          </p>

          <p className="text-lg text-muted-foreground leading-relaxed">
          However, it's so difficult to find such a space today, especially when we are busy living out our lives. As a result, ideas, flashes of inspiration, memorable feelings and experiences are left unrecorded and unvisited. They fade and we never get a chance to sit and revist them in their fullness and entirety. We never get the chance to hit <b>Replay</b>.   
          </p>

          <p className="text-lg text-muted-foreground leading-relaxed">
          <b>Replay</b> was born out of a desire to make it easy to remember our lives and connect the dots looking backwards. Not in a superficial way of recalling something that haappened, but in the deepest sense of living the memory with presence and the full awareness of it. And in this space of awareness, we inch closer - slowly but steadily - to figuring out our meaning and purpose, our "why"." I hope that <b>Replay</b> will play a useful role in your lives, as it did mine :)
          </p>
          
        </header>

        
        
      </div>
      <Footer />
    </div>
  );
};

export default AboutPage;
