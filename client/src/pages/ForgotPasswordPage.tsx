import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle, Sparkles } from 'lucide-react';
import api from '../utils/api';

const DEFAULT_COOLDOWN_SECONDS = 60;

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    if (cooldownSeconds <= 0) {
      return undefined;
    }

    const timerId = window.setInterval(() => {
      setCooldownSeconds(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [cooldownSeconds]);

  const deriveCooldownSeconds = (value: unknown, fallback = DEFAULT_COOLDOWN_SECONDS) => {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return Math.ceil(value);
    }
    return fallback;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const normalizedEmail = email.trim();
      if (!normalizedEmail) {
        setError('Please enter your email address.');
        return;
      }

      setEmail(normalizedEmail);

      const response = await api.post('/auth/forgot-password', { email: normalizedEmail });
      const cooldown = deriveCooldownSeconds(response.data?.cooldownSeconds);
      setCooldownSeconds(cooldown);
      setIsSuccess(true);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const message = err.response?.data?.error || 'Unable to send password reset email.';
        setError(message);
        const retryAfter = err.response?.data?.retryAfter;
        if (retryAfter) {
          setCooldownSeconds(deriveCooldownSeconds(retryAfter));
        }
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldownSeconds > 0) {
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const normalizedEmail = email.trim();
      const response = await api.post('/auth/forgot-password', { email: normalizedEmail });
      const cooldown = deriveCooldownSeconds(response.data?.cooldownSeconds);
      setCooldownSeconds(cooldown);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const message = err.response?.data?.error || 'Unable to resend password reset email.';
        setError(message);
        const retryAfter = err.response?.data?.retryAfter;
        if (retryAfter) {
          setCooldownSeconds(deriveCooldownSeconds(retryAfter));
        }
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Hero Image - visible on all devices */}
      <div className="relative lg:w-1/2 h-[40vh] lg:h-auto">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: 'url("https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=2070")',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-blue-900/40 to-purple-900/40" />
        </div>

        {/* Quote overlay - adjusted for mobile */}
        <div className="relative z-10 flex items-start p-8 lg:p-12">
          <blockquote className="text-white/90 text-base sm:text-lg lg:text-xl italic font-light max-w-lg">
            "The unexamined life is not worth living. Take time to reflect, grow, and find peace in your daily journey."
          </blockquote>
        </div>

        {/* Logo and App name - adjusted positioning for mobile */}
        <div className="absolute bottom-6 left-6 lg:bottom-12 lg:left-12 z-10">
          <div className="flex items-center gap-3 lg:gap-4 bg-white/10 backdrop-blur-md rounded-xl lg:rounded-2xl px-4 py-3 lg:px-6 lg:py-4">
            <div className="w-12 h-12 lg:w-14 lg:h-14 bg-white rounded-lg lg:rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 lg:w-8 lg:h-8 text-blue-600" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-lg lg:text-xl">Replay</h3>
              <p className="text-white/80 text-xs lg:text-sm">Daily Reflections & Mindfulness</p>
            </div>
          </div>
        </div>
      </div>

      {/* Form Section */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 bg-gray-50 py-8 lg:py-0">
        <div className="w-full max-w-md space-y-8">
          {!isSuccess ? (
            <>
              <div>
                <h2 className="text-3xl font-bold text-gray-900 text-center">
                  Reset your password
                </h2>
                <p className="mt-2 text-center text-gray-600">
                  Enter your email to receive reset instructions
                </p>
              </div>

              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to sign in
              </Link>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-900 mb-2">
                    Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent placeholder-gray-400 transition-all"
                      placeholder="Enter your email address"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isLoading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="text-center">
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>

                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                  Check your email
                </h2>
                <p className="text-gray-600 mb-6">
                  We've sent password reset instructions to your email
                </p>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                )}

                <div className="bg-gray-50 rounded-lg p-4 mb-8">
                  <p className="text-gray-900 font-medium mb-2">
                    We've sent a password reset link to <strong>{email}</strong>
                  </p>
                  <p className="text-gray-600 text-sm">
                    Please check your email and follow the instructions to reset your password. If you don't see the email, check your spam folder.
                  </p>
                </div>

                <Link
                  to="/login"
                  className="inline-flex justify-center w-full py-3 px-4 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all"
                >
                  Back to Sign In
                </Link>

                <button
                  onClick={handleResend}
                  disabled={isLoading || cooldownSeconds > 0}
                  className="mt-4 text-sm text-blue-600 hover:text-blue-500 font-medium disabled:opacity-50"
                >
                  {isLoading
                    ? 'Sending...'
                    : cooldownSeconds > 0
                      ? `Resend available in ${cooldownSeconds}s`
                      : "Didn't receive the email? Resend"}
                </button>

                {cooldownSeconds > 0 && (
                  <p className="mt-2 text-xs text-gray-500">
                    You can request another reset email once the timer reaches zero.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
