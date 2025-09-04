import React from 'react';
import { useNotifications, Notification } from '../contexts/NotificationContext';

// Individual notification component
function NotificationItem({ notification }: { notification: Notification }) {
  const { dismissNotification } = useNotifications();

  const getNotificationStyles = () => {
    const baseStyles = "relative p-4 rounded-lg shadow-lg border-l-4 mb-2 animate-slide-down";
    
    switch (notification.type) {
      case 'success':
        return `${baseStyles} bg-green-50 border-green-500 text-green-800`;
      case 'error':
        return `${baseStyles} bg-red-50 border-red-500 text-red-800`;
      case 'info':
        return `${baseStyles} bg-blue-50 border-blue-500 text-blue-800`;
      default:
        return `${baseStyles} bg-gray-50 border-gray-500 text-gray-800`;
    }
  };

  const getIconForType = () => {
    switch (notification.type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'info':
        return 'ℹ️';
      default:
        return '📢';
    }
  };

  return (
    <div className={getNotificationStyles()}>
      {/* Close button */}
      <button
        onClick={() => dismissNotification(notification.id)}
        className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-lg font-bold"
        aria-label="Dismiss notification"
      >
        ✕
      </button>

      {/* Icon and content */}
      <div className="flex items-start pr-8">
        <span className="text-lg mr-3 flex-shrink-0">
          {getIconForType()}
        </span>
        
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h4 className="font-semibold text-sm mb-1">
            {notification.title}
          </h4>
          
          {/* Message */}
          <p className="text-sm text-gray-600 mb-3">
            {notification.message}
          </p>
          
          {/* Actions */}
          {notification.actions && notification.actions.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {notification.actions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => {
                    action.onClick();
                    if (action.variant === 'primary') {
                      // Dismiss notification after primary action
                      dismissNotification(notification.id);
                    }
                  }}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    action.variant === 'primary'
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Auto-hide progress indicator */}
      {notification.autoHide && notification.duration && (
        <div 
          className="absolute bottom-0 left-0 h-1 bg-blue-500 rounded-bl-lg animate-shrink"
          style={{
            animationDuration: `${notification.duration}ms`
          }}
        />
      )}
    </div>
  );
}

// Main notification container
export function NotificationContainer() {
  const { notifications } = useNotifications();

  if (notifications.length === 0) {
    return null;
  }

  return (
    <>
      {/* Add required CSS animations */}
      <style>{`
        @keyframes slide-down {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        
        @keyframes shrink {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
        
        .animate-slide-down {
          animation: slide-down 0.3s ease-out;
        }
        
        .animate-shrink {
          animation: shrink linear;
        }
      `}</style>

      {/* Notification container */}
      <div className="fixed top-4 right-4 z-50 w-80 max-w-sm pointer-events-none">
        <div className="space-y-2 pointer-events-auto">
          {notifications.map(notification => (
            <NotificationItem 
              key={notification.id} 
              notification={notification} 
            />
          ))}
        </div>
      </div>

      {/* Mobile responsive styles */}
      <style>{`
        @media (max-width: 640px) {
          .notification-container {
            top: 8px;
            left: 8px;
            right: 8px;
            width: auto;
          }
        }
      `}</style>
    </>
  );
}

export default NotificationContainer;