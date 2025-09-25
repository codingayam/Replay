import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';

const REDIRECT_SECONDS = 3;

const EmailConfirmationPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');
  const [redirectCountdown, setRedirectCountdown] = useState(REDIRECT_SECONDS);
  const [email, setEmail] = useState('');

  const hashParams = useMemo(() => new URLSearchParams(window.location.hash.replace(/^#/, '')), []);

  useEffect(() => {
    let isMounted = true;
    const accessToken = searchParams.get('access_token') || hashParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token') || hashParams.get('refresh_token');
    const type = searchParams.get('type') || hashParams.get('type');
    const userEmail = searchParams.get('email') || hashParams.get('email');

    if (userEmail) {
      setEmail(userEmail);
    }

    const confirmEmail = async () => {
      if (!accessToken || !refreshToken || type !== 'signup') {
        setStatus('error');
        setError('Invalid or expired confirmation link. Please sign in to request a new one.');
        return;
      }

      setStatus('verifying');

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (!isMounted) {
        return;
      }

      if (sessionError) {
        console.error('Supabase confirmation session error:', sessionError);
        setStatus('error');
        setError('This confirmation link has expired. Please sign in to request a new one.');
        return;
      }

      // Ensure we have the latest user profile (optional but helpful for future flows)
      const { data, error: userError } = await supabase.auth.getUser();
      if (!isMounted) {
        return;
      }

      if (userError || !data?.user) {
        console.error('Supabase confirmation getUser error:', userError);
        setStatus('error');
        setError('Something went wrong finishing your signup. Please sign in to retry.');
        return;
      }

      setEmail(data.user.email ?? userEmail ?? '');
      setStatus('success');
    };

    confirmEmail();

    return () => {
      isMounted = false;
    };
  }, [hashParams, searchParams]);

  useEffect(() => {
    if (status !== 'success') {
      return;
    }

    setRedirectCountdown(REDIRECT_SECONDS);
    const interval = window.setInterval(() => {
      setRedirectCountdown(prev => {
        if (prev <= 1) {
          window.clearInterval(interval);
          navigate('/onboarding', { replace: true });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [navigate, status]);

  const renderContent = () => {
    if (status === 'verifying' || status === 'idle') {
      return (
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Confirming your account…</h2>
          <p className="text-gray-600">
            Sit tight while we verify your email and get your account ready.
          </p>
        </div>
      );
    }

    if (status === 'success') {
      return (
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Replay!</h2>
          <p className="text-gray-600 mb-6">
            {email ? (
              <>
                <span className="font-semibold">{email}</span> is verified. We’re ready to personalize your mindfulness journey.
              </>
            ) : (
              'Your email is verified. We’re ready to personalize your mindfulness journey.'
            )}
          </p>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-green-800 text-sm">
              We’re redirecting you to onboarding so you can set your preferences and start reflecting.
            </p>
          </div>

          <Link
            to="/onboarding"
            className="inline-flex justify-center w-full py-3 px-4 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all"
          >
            Continue to Onboarding
          </Link>

          <p className="mt-4 text-sm text-gray-500">
            Redirecting automatically in {redirectCountdown}s…
          </p>
        </div>
      );
    }

    return (
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
          <AlertCircle className="w-10 h-10 text-red-600" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-3">We couldn’t confirm that link</h2>
        <p className="text-gray-600 mb-6">{error}</p>

        <div className="space-y-3">
          <Link
            to="/login"
            className="inline-flex justify-center w-full py-3 px-4 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all"
          >
            Back to Sign In
          </Link>
          <Link
            to="/signup"
            className="inline-flex justify-center w-full py-3 px-4 border border-blue-200 text-blue-600 rounded-lg shadow-sm text-base font-medium hover:bg-blue-50 transition-all"
          >
            Create a new account
          </Link>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Hero Image */}
      <div className="relative lg:w-1/2 h-[40vh] lg:h-auto">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: 'url("https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=2070")',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-blue-900/40 to-purple-900/40" />
        </div>

        <div className="relative z-10 flex items-start p-8 lg:p-12">
          <blockquote className="text-white/90 text-base sm:text-lg lg:text-xl italic font-light max-w-lg">
            "The unexamined life is not worth living. Take time to reflect, grow, and find peace in your daily journey."
          </blockquote>
        </div>

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

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 bg-gray-50 py-8 lg:py-0">
        <div className="w-full max-w-md">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default EmailConfirmationPage;
