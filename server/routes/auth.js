import rateLimit from 'express-rate-limit';

const PASSWORD_RESET_COOLDOWN_MS = 60 * 1000;
const DEFAULT_COOLDOWN_SECONDS = Math.ceil(PASSWORD_RESET_COOLDOWN_MS / 1000);
const passwordResetTimestamps = new Map();

function resolveRedirectUrl() {
  const redirectEnvKeys = [
    'PASSWORD_RESET_REDIRECT_URL',
    'SUPABASE_PASSWORD_RESET_REDIRECT_URL',
    'SUPABASE_SITE_URL',
    'SITE_URL'
  ];

  for (const key of redirectEnvKeys) {
    const value = process.env[key];
    if (value) {
      return value;
    }
  }

  return undefined;
}

export function registerAuthRoutes({ app, supabase }) {
  const passwordResetLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Too many password reset requests. Please try again later.'
    }
  });

  app.post('/api/auth/forgot-password', passwordResetLimiter, async (req, res) => {
    const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';

    if (!rawEmail) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }

    const now = Date.now();
    const lastRequest = passwordResetTimestamps.get(rawEmail);
    if (lastRequest && now - lastRequest < PASSWORD_RESET_COOLDOWN_MS) {
      const retryAfter = Math.ceil((PASSWORD_RESET_COOLDOWN_MS - (now - lastRequest)) / 1000);
      return res.status(429).json({
        error: 'Please wait before requesting another reset email.',
        retryAfter
      });
    }

    try {
      const redirectTo = resolveRedirectUrl();
      const options = redirectTo ? { redirectTo } : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(rawEmail, options);

      if (error) {
        const status = error.status && Number.isInteger(error.status) ? error.status : 400;
        return res.status(status).json({ error: error.message || 'Failed to send password reset email.' });
      }

      passwordResetTimestamps.set(rawEmail, now);
      setTimeout(() => passwordResetTimestamps.delete(rawEmail), PASSWORD_RESET_COOLDOWN_MS).unref?.();

      return res.json({
        message: 'Password reset email sent.',
        cooldownSeconds: DEFAULT_COOLDOWN_SECONDS
      });
    } catch (error) {
      console.error('Password reset request failed:', error);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  });
}

export const __TEST_ONLY__ = {
  clearPasswordResetCooldowns() {
    passwordResetTimestamps.clear();
  }
};
