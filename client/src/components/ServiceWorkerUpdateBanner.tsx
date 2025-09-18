import React, { useState } from 'react';
import { RefreshCcw, X } from 'lucide-react';

interface ServiceWorkerUpdateBannerProps {
  version: string | null;
  onApplyUpdate: () => Promise<void>;
}

const ServiceWorkerUpdateBanner: React.FC<ServiceWorkerUpdateBannerProps> = ({ version, onApplyUpdate }) => {
  const [dismissed, setDismissed] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  if (dismissed) {
    return null;
  }

  const handleApply = async () => {
    setIsApplying(true);
    try {
      await onApplyUpdate();
      window.location.reload();
    } catch (error) {
      console.error('Failed to apply service worker update:', error);
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-40 bg-emerald-600 text-white shadow-md">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-start space-x-3">
        <div className="flex-shrink-0 mt-0.5">
          <RefreshCcw className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">A new version of Replay is available.</p>
          <p className="text-xs text-emerald-100 mt-1">
            {version ? `Service worker ${version} is ready. Reload now to get the latest improvements.` : 'Reload now to get the latest improvements.'}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleApply}
            disabled={isApplying}
            className="px-3 py-1.5 bg-white text-emerald-700 rounded-md text-xs font-semibold hover:bg-emerald-50 disabled:opacity-60"
          >
            {isApplying ? 'Updating…' : 'Reload'}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded hover:bg-emerald-500"
            aria-label="Dismiss update banner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServiceWorkerUpdateBanner;
