import React, { useState } from 'react';
import { Bell, X, AlertCircle } from 'lucide-react';
import { isSafariWebPush, requiresPwaInstallForPush } from '../utils/notificationUtils';

interface NotificationPermissionBannerProps {
  onRequestPermission: () => Promise<boolean>;
  onDismiss: () => void;
  supportMessage?: string;
}

const NotificationPermissionBanner: React.FC<NotificationPermissionBannerProps> = ({
  onRequestPermission,
  onDismiss,
  supportMessage
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEnableNotifications = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Show Safari-specific instructions if needed
      if (isSafariWebPush() && requiresPwaInstallForPush()) {
        setError('Please install Replay as an app first. Tap the Share button and select "Add to Home Screen".');
        return;
      }

      const granted = await onRequestPermission();

      if (granted) {
        // Banner will be hidden by parent component
      } else {
        setError('Notification permission was denied. You can enable it later in Settings.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to enable notifications');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 bg-white shadow-lg z-50 animate-slide-down">
      <div className="max-w-4xl mx-auto p-4">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <div className="p-2 bg-blue-100 rounded-full">
              <Bell className="h-6 w-6 text-blue-600" />
            </div>
          </div>

          <div className="flex-grow">
            <h3 className="text-lg font-semibold text-gray-900">
              Stay Connected with Your Practice
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              Get notified when your personalized meditations are ready, receive daily reminders to capture moments, and maintain your streak.
            </p>

            {supportMessage && (
              <p className="mt-2 text-xs text-gray-500">
                {supportMessage}
              </p>
            )}

            {error && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start space-x-2">
                <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-800">{error}</p>
              </div>
            )}

            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleEnableNotifications}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Enabling...' : 'Enable Notifications'}
              </button>

              <button
                onClick={onDismiss}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Maybe Later
              </button>
            </div>

            <p className="mt-3 text-xs text-gray-500">
              You can manage notification settings anytime in your Profile.
            </p>
          </div>

          <button
            onClick={onDismiss}
            className="flex-shrink-0 p-1 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationPermissionBanner;
