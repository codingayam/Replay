const InstallingReplay = () => {
  return (
    <section id="install" className="py-24 px-4">
      <div className="container mx-auto max-w-5xl px-4">
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
                    <li>
                      Tap the share icon, then choose <span className="font-semibold text-foreground">Add to Home Screen</span>.
                    </li>
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

export default InstallingReplay;
