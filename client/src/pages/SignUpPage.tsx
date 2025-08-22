import React from 'react';
import { SignUp } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';

const SignUpPage: React.FC = () => {
  const { isLoaded, isSignedIn } = useUser();

  // If user is already signed in, redirect to main app
  if (isLoaded && isSignedIn) {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* App Branding */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Replay</h1>
          <p className="text-gray-600 text-lg">
            Start your journey of reflection and growth
          </p>
        </div>

        {/* Clerk Sign Up Component */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <SignUp 
            redirectUrl="/onboarding"
            appearance={{
              elements: {
                formButtonPrimary: "bg-green-600 hover:bg-green-700 text-white",
                card: "shadow-none",
                headerTitle: "text-2xl font-semibold text-gray-900",
                headerSubtitle: "text-gray-600",
                socialButtonsBlockButton: "border border-gray-300 hover:bg-gray-50",
                dividerLine: "bg-gray-200",
                dividerText: "text-gray-500",
                formFieldInput: "border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500",
                footerActionLink: "text-green-600 hover:text-green-700"
              }
            }}
          />
        </div>

        {/* Features Preview */}
        <div className="mt-8 grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <p className="text-sm text-gray-600">Voice Notes</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <p className="text-sm text-gray-600">Reflections</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <p className="text-sm text-gray-600">Insights</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;