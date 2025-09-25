import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Mail, Lock, Eye, EyeOff, Sparkles } from 'lucide-react';

const LoginPage: React.FC = () => {
  const { user, loading, signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Handle redirect when user becomes authenticated
  useEffect(() => {
    if (!loading && user) {
      navigate('/experiences', { replace: true });
    }
  }, [user, loading, navigate]);

  // If user is already signed in, redirect to main app
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/experiences" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const { user: signedInUser, error } = await signIn(email, password);
      if (error) {
        setError(error.message);
      } else if (signedInUser) {
        // Successful login - the useEffect will handle the navigation
      }
    } catch (err) {
      setError('An unexpected error occurred');
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

      {/* Login Form - adjusted for mobile with hero image */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 bg-gray-50 py-8 lg:py-0">
        <div className="w-full max-w-md space-y-6 lg:space-y-8">

          <div>
            <h2 className="text-3xl font-bold text-gray-900 text-center">
              Welcome back
            </h2>
            <p className="mt-2 text-center text-gray-600">
              Continue your mindfulness journey
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
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-900 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent placeholder-gray-400 transition-all"
                  placeholder="Enter your password"
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

            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-sm text-blue-600 hover:text-blue-500 font-medium"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-gray-50 text-gray-500">or continue with</span>
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
              setError('');
              setIsGoogleLoading(true);
              try {
                const { error } = await signInWithGoogle();
                if (error) {
                  setError(error.message ?? 'Unable to sign in with Google.');
                }
              } catch (err) {
                setError('An unexpected error occurred while starting Google sign-in.');
              } finally {
                setIsGoogleLoading(false);
              }
            }}
            disabled={isLoading || isGoogleLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg shadow-sm bg-white text-gray-700 font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {isGoogleLoading ? 'Opening Google...' : 'Google'}
          </button>

          <p className="text-center text-sm text-gray-600">
            New to Replay?{' '}
            <Link to="/signup" className="font-medium text-blue-600 hover:text-blue-500">
              Create an account
            </Link>
          </p>

          <p className="text-center text-xs text-gray-500 mt-4">
            By continuing, you agree to our{' '}
            <Link to="/terms" className="text-blue-600 hover:text-blue-500">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className="text-blue-600 hover:text-blue-500">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
