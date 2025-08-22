import React from 'react';
import { SignIn } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';

const LoginPage: React.FC = () => {
  const { isLoaded, isSignedIn } = useUser();

  // If user is already signed in, redirect to main app
  if (isLoaded && isSignedIn) {
    return <Navigate to="/experiences" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-3xl shadow-lg p-8">
          {/* App Icon */}
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 bg-gray-700 rounded-2xl flex items-center justify-center">
              <div className="w-8 h-8 bg-white rounded-full"></div>
            </div>
          </div>

          {/* Sign In Component */}
          <SignIn 
            redirectUrl="/experiences"
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "shadow-none p-0 w-full",
                headerTitle: "text-2xl font-semibold text-gray-900 text-center mb-2",
                headerSubtitle: "text-gray-500 text-center text-base mb-8",
                socialButtonsBlockButton: "w-full border border-gray-200 hover:bg-gray-50 rounded-xl py-3 mb-3 text-gray-700 font-medium",
                socialButtonsBlockButtonText: "font-medium",
                dividerLine: "bg-gray-200",
                dividerText: "text-gray-500 text-sm",
                formFieldLabel: "text-gray-700 font-medium text-sm mb-2",
                formFieldInput: "w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900",
                formButtonPrimary: "w-full bg-gray-800 hover:bg-gray-900 text-white rounded-xl py-3 font-medium text-base mt-4",
                footerActionLink: "text-gray-600 hover:text-gray-800 font-medium",
                footerActionText: "text-gray-500",
                identityPreviewText: "text-gray-700",
                identityPreviewEditButton: "text-blue-600 hover:text-blue-700"
              },
              layout: {
                socialButtonsPlacement: "top",
                showOptionalFields: false
              },
              variables: {
                borderRadius: "0.75rem"
              }
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default LoginPage;