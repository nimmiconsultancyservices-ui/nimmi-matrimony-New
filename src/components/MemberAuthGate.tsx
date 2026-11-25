import React from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Lock } from 'lucide-react';
import { useMatrimony } from '../context/MatrimonyContext';

interface MemberAuthGateProps {
  description?: string;
}

export const MemberAuthGate: React.FC<MemberAuthGateProps> = ({ description }) => {
  const { authLoading, t } = useMatrimony();

  if (authLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="rounded-2xl border border-hairline bg-white p-10 space-y-3">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand" />
          <p className="text-sm text-slate-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <div className="rounded-2xl border border-hairline bg-white p-8 space-y-4">
        <Lock className="mx-auto h-9 w-9 text-brand-accent" />
        <h1 className="font-display text-3xl font-semibold text-brand">
          {t('auth.gate_title')}
        </h1>
        <p className="text-sm text-slate-600">
          {description ?? t('msg.auth_required_desc')}
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link
            to="/login"
            className="rounded-lg bg-brand px-5 py-2.5 text-xs font-semibold text-white hover:bg-brand-dark"
          >
            {t('auth.go_login')}
          </Link>
          <Link
            to="/register"
            className="rounded-lg border border-hairline px-5 py-2.5 text-xs font-medium text-brand hover:border-brand"
          >
            {t('auth.go_register')}
          </Link>
        </div>
      </div>
    </div>
  );
};
