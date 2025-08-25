module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:5173/',
        'http://localhost:5173/login',
        'http://localhost:5173/signup',
        'http://localhost:5173/experiences',
        'http://localhost:5173/reflections',
        'http://localhost:5173/profile'
      ],
      startServerCommand: 'npm start',
      startServerReadyPattern: 'Server running on',
      startServerReadyTimeout: 30000,
      numberOfRuns: 3
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.8 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.8 }],
        'categories:seo': ['warn', { minScore: 0.8 }],
        'categories:pwa': 'off' // Not a PWA currently
      }
    },
    upload: {
      target: 'temporary-public-storage'
    }
  }
};