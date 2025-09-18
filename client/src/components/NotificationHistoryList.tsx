import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle, XCircle, Clock, ExternalLink, ChevronRight } from 'lucide-react';
import api from '../utils/api';

interface NotificationHistoryItem {
  id: string;
  type: string;
  channel: 'fcm' | 'apns';
  title: string;
  body: string;
  data: any;
  sent_at: string;
  delivered: boolean;
  opened: boolean;
  opened_at: string | null;
  error: string | null;
}

const NotificationHistoryList: React.FC = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const fetchNotifications = async (pageNum: number = 0) => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get('/notifications/history', {
        params: {
          limit: 20,
          offset: pageNum * 20
        }
      });

      const { notifications: newNotifications, total } = response.data;

      if (pageNum === 0) {
        setNotifications(newNotifications);
      } else {
        setNotifications(prev => [...prev, ...newNotifications]);
      }

      setTotalCount(total);
      setHasMore(newNotifications.length === 20);
      setPage(pageNum);
    } catch (err: any) {
      console.error('Failed to fetch notification history:', err);
      setError(err.message || 'Failed to load notification history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      fetchNotifications(page + 1);
    }
  };

  const handleOpenDeepLink = (notification: NotificationHistoryItem) => {
    if (notification.data?.url) {
      navigate(notification.data.url);
    }
  };

  const getStatusBadge = (notification: NotificationHistoryItem) => {
    if (notification.error) {
      return (
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded">
          <XCircle className="h-3 w-3 mr-1" />
          Failed
        </span>
      );
    }

    if (notification.opened) {
      return (
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded">
          <CheckCircle className="h-3 w-3 mr-1" />
          Opened
        </span>
      );
    }

    if (notification.delivered) {
      return (
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">
          <Bell className="h-3 w-3 mr-1" />
          Delivered
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
        <Clock className="h-3 w-3 mr-1" />
        Pending
      </span>
    );
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'meditation_ready':
        return '🧘';
      case 'daily_reminder':
        return '📝';
      case 'streak_reminder':
        return '🔥';
      case 'weekly_reflection':
        return '📅';
      default:
        return '🔔';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (loading && page === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error && page === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="text-center py-12">
        <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No notifications yet</p>
        <p className="text-sm text-gray-500 mt-2">
          When you receive notifications, they'll appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Notification History</h2>
        <span className="text-sm text-gray-500">
          {totalCount} total notification{totalCount !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-2">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3 flex-grow">
                <div className="text-2xl flex-shrink-0 mt-1">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-grow">
                  <div className="flex items-start justify-between">
                    <div className="flex-grow">
                      <h3 className="font-medium text-gray-900">
                        {notification.title}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {notification.body}
                      </p>
                      <div className="flex items-center space-x-4 mt-2">
                        <span className="text-xs text-gray-500">
                          {formatDate(notification.sent_at)}
                        </span>
                        <span className="text-xs text-gray-500">
                          via {notification.channel.toUpperCase()}
                        </span>
                        {notification.opened_at && (
                          <span className="text-xs text-gray-500">
                            Opened {formatDate(notification.opened_at)}
                          </span>
                        )}
                      </div>
                      {notification.error && (
                        <p className="text-xs text-red-600 mt-2">
                          Error: {notification.error}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      {getStatusBadge(notification)}
                      {notification.data?.url && (
                        <button
                          onClick={() => handleOpenDeepLink(notification)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Open deep link"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="text-center pt-4">
          <button
            onClick={handleLoadMore}
            disabled={loading}
            className="px-4 py-2 text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <span className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span>Loading...</span>
              </span>
            ) : (
              <span className="flex items-center space-x-2">
                <span>Load More</span>
                <ChevronRight className="h-4 w-4" />
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationHistoryList;