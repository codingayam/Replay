import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { validatePasswordStrength, PASSWORD_REQUIREMENT_SUMMARY } from '../utils/passwordPolicy';

const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  const passwordStrength = useMemo(() => validatePasswordStrength(password), [password]);
  const passwordRuleResults = passwordStrength.details;
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const isVerifyingToken = isValidToken && !sessionReady && !isSuccess && !error;

  useEffect(() => {
    // Check for recovery token in URL hash or search params
    const hash = window.location.hash;
    const accessToken = searchParams.get('access_token') ||
                       new URLSearchParams(hash.substring(1)).get('access_token');
    const refreshToken = searchParams.get('refresh_token') ||
                         new URLSearchParams(hash.substring(1)).get('refresh_token');
    const type = searchParams.get('type') ||
                new URLSearchParams(hash.substring(1)).get('type');

    let isMounted = true;

    const establishSession = async () => {
      if (accessToken && refreshToken && type === 'recovery') {
        setError('');
        setIsValidToken(true);
        setSessionReady(false);
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (!isMounted) {
          return;
        }

        if (sessionError) {
          console.error('Failed to establish Supabase session for password reset', sessionError);
          setError('This reset link has expired. Please request a new password reset email.');
          setIsValidToken(false);
          setSessionReady(false);
        } else {
          setError('');
          setSessionReady(true);
        }
      } else {
        setError('Invalid or expired reset link. Please request a new password reset.');
        setIsValidToken(false);
      }
    };

    establishSession();

    return () => {
      isMounted = false;
    };
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (!isValidToken || !sessionReady) {
        setError('Your reset link is no longer valid. Please request a new password reset email.');
        return;
      }

      if (!passwordStrength.isValid) {
        setError(`Password requirements not met: ${passwordStrength.failedRuleLabels.join(', ')}`);
        return;
      }

      if (!passwordsMatch) {
        setError('Passwords do not match');
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message ?? 'Failed to update password. Please try again.');
        return;
      }

      setIsSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 3000);
      try {
        await supabase.auth.signOut();
      } catch (signOutError) {
        console.warn('Failed to sign out after password reset', signOutError);
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isValidToken && !isSuccess) {
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

          {/* Quote overlay */}
          <div className="relative z-10 flex items-start p-8 lg:p-12">
            <blockquote className="text-white/90 text-base sm:text-lg lg:text-xl italic font-light max-w-lg">
              "The unexamined life is not worth living. Take time to reflect, grow, and find peace in your daily journey."
            </blockquote>
          </div>

          {/* Logo and App name */}
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

        {/* Error Section */}
        <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 bg-gray-50 py-8 lg:py-0">
          <div className="w-full max-w-md text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
              <AlertCircle className="w-10 h-10 text-red-600" />
            </div>

            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Invalid Reset Link
            </h2>
            <p className="text-gray-600 mb-8">
              This password reset link is invalid or has expired. Please request a new one.
            </p>

            <Link
              to="/forgot-password"
              className="inline-flex justify-center w-full py-3 px-4 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all"
            >
              Request New Reset Link
            </Link>

            <p className="mt-4 text-center text-sm text-gray-600">
              Remember your password?{' '}
              <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

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

        {/* Quote overlay */}
        <div className="relative z-10 flex items-start p-8 lg:p-12">
          <blockquote className="text-white/90 text-base sm:text-lg lg:text-xl italic font-light max-w-lg">
            "The unexamined life is not worth living. Take time to reflect, grow, and find peace in your daily journey."
          </blockquote>
        </div>

        {/* Logo and App name */}
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
                  Set New Password
                </h2>
                <p className="mt-2 text-center text-gray-600">
                  Enter your new password below
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-900 mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent placeholder-gray-400 transition-all"
                      placeholder="Enter your new password"
                      minLength={10}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      ) : (
                        <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-900 mb-2">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="block w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent placeholder-gray-400 transition-all"
                      placeholder="Confirm your new password"
                      minLength={10}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      ) : (
                        <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Password Requirements */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-blue-900 font-medium text-sm mb-2">Password Requirements</h4>
                  <p className="text-xs text-blue-700 mb-3">{PASSWORD_REQUIREMENT_SUMMARY}</p>
                  <ul className="text-blue-800 text-sm space-y-1">
                    {passwordRuleResults.map((rule) => (
                      <li key={rule.id} className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${rule.met ? 'bg-green-500' : 'bg-gray-300'}`} />
                        {rule.label}
                      </li>
                    ))}
                    <li className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${passwordsMatch ? 'bg-green-500' : 'bg-gray-300'}`} />
                      Passwords match
                    </li>
                  </ul>
                </div>

                <button
                  type="submit"
                  disabled={
                    isLoading ||
                    !sessionReady ||
                    !passwordStrength.isValid ||
                    !passwordsMatch
                  }
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isLoading ? 'Updating Password...' : 'Update Password'}
                </button>

                {isVerifyingToken && (
                  <p className="text-xs text-gray-500 text-center">
                    Verifying your reset link…
                  </p>
                )}
              </form>
            </>
          ) : (
            <>
              <div className="text-center">
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>

                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                  Password Updated!
                </h2>
                <p className="text-gray-600 mb-8">
                  Your password has been successfully updated. You will be redirected to sign in shortly.
                </p>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                  <p className="text-green-800 text-sm">
                    🎉 Welcome back! You can now sign in with your new password.
                  </p>
                </div>

                <Link
                  to="/login"
                  className="inline-flex justify-center w-full py-3 px-4 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all"
                >
                  Continue to Sign In
                </Link>

                <p className="mt-4 text-sm text-gray-500">
                  Redirecting automatically in 3 seconds...
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
