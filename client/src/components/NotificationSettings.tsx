import React, { useState, useEffect } from 'react';
import { Bell, Clock, Calendar, Smartphone, TestTube, AlertCircle } from 'lucide-react';

interface NotificationPreferences {
  enabled: boolean;
  daily_reminder: {
    enabled: boolean;
    time: string;
  };
  streak_reminder: {
    enabled: boolean;
    time: string;
  };
  meditation_ready: {
    enabled: boolean;
  };
  weekly_reflection: {
    enabled: boolean;
    day: string;
    time: string;
  };
}

interface NotificationSettingsProps {
  preferences: NotificationPreferences | null;
  onUpdatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<void>;
  onTestNotification: (type: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const NotificationSettings: React.FC<NotificationSettingsProps> = ({
  preferences,
  onUpdatePreferences,
  onTestNotification,
  isLoading,
  error
}) => {
  const [localPrefs, setLocalPrefs] = useState<NotificationPreferences | null>(preferences);
  const [hasChanges, setHasChanges] = useState(false);
  const [testingType, setTestingType] = useState<string | null>(null);

  useEffect(() => {
    setLocalPrefs(preferences);
  }, [preferences]);

  const handleChange = (path: string[], value: any) => {
    if (!localPrefs) return;

    const updated = { ...localPrefs };
    let current: any = updated;

    for (let i = 0; i < path.length - 1; i++) {
      current[path[i]] = { ...current[path[i]] };
      current = current[path[i]];
    }

    current[path[path.length - 1]] = value;

    setLocalPrefs(updated);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!localPrefs || !hasChanges) return;

    await onUpdatePreferences(localPrefs);
    setHasChanges(false);
  };

  const handleTest = async (type: string) => {
    setTestingType(type);
    try {
      await onTestNotification(type);
    } finally {
      setTestingType(null);
    }
  };

  if (!localPrefs) {
    return <div>Loading preferences...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Bell className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold">Notification Settings</h2>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={localPrefs.enabled}
              onChange={(e) => handleChange(['enabled'], e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            <span className="ml-3 text-sm font-medium text-gray-900">
              {localPrefs.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className={`space-y-4 ${!localPrefs.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
          {/* Meditation Ready */}
          <div className="p-4 border border-gray-200 rounded-lg">
            <div className="flex items-start justify-between">
              <div className="flex-grow">
                <h3 className="font-medium text-gray-900">Meditation Ready</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Get notified when your meditation generation is complete
                </p>
                <div className="mt-2">
                  <span className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                    Immediate
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => handleTest('meditation_ready')}
                  disabled={testingType === 'meditation_ready'}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                  title="Send test notification"
                >
                  {testingType === 'meditation_ready' ? (
                    <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
                  ) : (
                    <TestTube className="h-5 w-5" />
                  )}
                </button>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localPrefs.meditation_ready.enabled}
                    onChange={(e) => handleChange(['meditation_ready', 'enabled'], e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Daily Reminder */}
          <div className="p-4 border border-gray-200 rounded-lg">
            <div className="flex items-start justify-between">
              <div className="flex-grow">
                <h3 className="font-medium text-gray-900">Daily Reflection Reminder</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Remind me to capture today's moments
                </p>
                <div className="mt-3 flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <input
                    type="time"
                    value={localPrefs.daily_reminder.time}
                    onChange={(e) => handleChange(['daily_reminder', 'time'], e.target.value)}
                    disabled={!localPrefs.daily_reminder.enabled}
                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => handleTest('daily_reminder')}
                  disabled={testingType === 'daily_reminder'}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                  title="Send test notification"
                >
                  {testingType === 'daily_reminder' ? (
                    <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
                  ) : (
                    <TestTube className="h-5 w-5" />
                  )}
                </button>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localPrefs.daily_reminder.enabled}
                    onChange={(e) => handleChange(['daily_reminder', 'enabled'], e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Streak Reminder */}
          <div className="p-4 border border-gray-200 rounded-lg">
            <div className="flex items-start justify-between">
              <div className="flex-grow">
                <h3 className="font-medium text-gray-900">Meditation Streak Reminder</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Remind me to maintain my meditation streak
                </p>
                <div className="mt-3 flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <input
                    type="time"
                    value={localPrefs.streak_reminder.time}
                    onChange={(e) => handleChange(['streak_reminder', 'time'], e.target.value)}
                    disabled={!localPrefs.streak_reminder.enabled}
                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => handleTest('streak_reminder')}
                  disabled={testingType === 'streak_reminder'}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                  title="Send test notification"
                >
                  {testingType === 'streak_reminder' ? (
                    <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
                  ) : (
                    <TestTube className="h-5 w-5" />
                  )}
                </button>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localPrefs.streak_reminder.enabled}
                    onChange={(e) => handleChange(['streak_reminder', 'enabled'], e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Weekly Reflection */}
          <div className="p-4 border border-gray-200 rounded-lg">
            <div className="flex items-start justify-between">
              <div className="flex-grow">
                <h3 className="font-medium text-gray-900">Weekly Reflection Suggestion</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Suggest creating a weekly reflection
                </p>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <select
                      value={localPrefs.weekly_reflection.day}
                      onChange={(e) => handleChange(['weekly_reflection', 'day'], e.target.value)}
                      disabled={!localPrefs.weekly_reflection.enabled}
                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                    >
                      <option value="sunday">Sunday</option>
                      <option value="monday">Monday</option>
                      <option value="tuesday">Tuesday</option>
                      <option value="wednesday">Wednesday</option>
                      <option value="thursday">Thursday</option>
                      <option value="friday">Friday</option>
                      <option value="saturday">Saturday</option>
                    </select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <input
                      type="time"
                      value={localPrefs.weekly_reflection.time}
                      onChange={(e) => handleChange(['weekly_reflection', 'time'], e.target.value)}
                      disabled={!localPrefs.weekly_reflection.enabled}
                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => handleTest('weekly_reflection')}
                  disabled={testingType === 'weekly_reflection'}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                  title="Send test notification"
                >
                  {testingType === 'weekly_reflection' ? (
                    <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
                  ) : (
                    <TestTube className="h-5 w-5" />
                  )}
                </button>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localPrefs.weekly_reflection.enabled}
                    onChange={(e) => handleChange(['weekly_reflection', 'enabled'], e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {hasChanges && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}

        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-start space-x-3">
            <Smartphone className="h-5 w-5 text-gray-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-600">
              <p className="font-medium mb-1">Browser Notifications</p>
              <p>
                Notifications work best when the browser tab is closed or in the background.
                Make sure your browser notifications are enabled in system settings.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettings;