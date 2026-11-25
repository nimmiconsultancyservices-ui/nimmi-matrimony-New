import React from 'react';
import { WifiOff } from 'lucide-react';
import { useLanguage } from '../context/MatrimonyContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const { t } = useLanguage();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg border border-brand-accent/40 bg-brand px-3.5 py-2 text-xs font-medium text-white shadow-lg"
    >
      <WifiOff className="h-3.5 w-3.5 text-on-dark-accent" />
      <span>{t('offline.banner')}</span>
    </div>
  );
};
