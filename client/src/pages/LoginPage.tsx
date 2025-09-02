import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { User, Lock } from 'lucide-react';

const LoginPage: React.FC = () => {
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

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
    <div className="min-h-screen bg-gradient-to-br from-emerald-400 via-teal-500 to-emerald-600 flex items-center justify-center px-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0">
        {/* Large circles */}
        <div className="absolute top-20 right-20 w-32 h-32 bg-white/10 rounded-full"></div>
        <div className="absolute bottom-40 left-20 w-20 h-20 bg-white/5 rounded-full"></div>
        <div className="absolute top-1/2 right-10 w-4 h-4 bg-white/20 rounded-full"></div>
        
        {/* Wave patterns */}
        <div className="absolute bottom-0 left-0 w-full">
          <svg viewBox="0 0 1200 320" className="w-full h-auto">
            <path fill="rgba(255,255,255,0.1)" fillOpacity="1" d="M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,133.3C672,139,768,181,864,186.7C960,192,1056,160,1152,149.3C1248,139,1344,149,1392,154.7L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
          </svg>
        </div>
        <div className="absolute bottom-0 left-0 w-full">
          <svg viewBox="0 0 1200 320" className="w-full h-auto">
            <path fill="rgba(255,255,255,0.05)" fillOpacity="1" d="M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,213.3C672,224,768,224,864,213.3C960,203,1056,181,1152,181.3C1248,181,1344,203,1392,213.3L1440,224L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
          </svg>
        </div>
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Title */}
          <h2 className="text-2xl font-semibold text-gray-900 text-center mb-2">
            Welcome back
          </h2>
          <p className="text-gray-500 text-center text-base mb-8">
            Enter your credentials to access your account
          </p>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Sign In Form */}
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="text-gray-700 font-medium text-sm mb-2 block">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900"
                  placeholder="Enter your username"
                  required
                />
              </div>
            </div>
            
            <div className="mb-4">
              <label className="text-gray-700 font-medium text-sm mb-2 block">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900"
                  placeholder="Enter your password"
                  required
                />
              </div>
            </div>

            {/* Remember me and Forgot Password */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                  Remember me
                </label>
              </div>
              <Link to="/forgot-password" className="text-sm text-teal-600 hover:text-teal-700">
                Forgot Password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl py-3 font-medium text-base transition-colors"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <span className="text-gray-500 text-sm">
              Don't have an account?{' '}
            </span>
            <Link to="/signup" className="text-teal-600 hover:text-teal-700 font-medium text-sm">
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;