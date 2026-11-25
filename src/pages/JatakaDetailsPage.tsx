import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MemberAuthGate } from '../components/MemberAuthGate';
import { ProfileEditorTabs } from '../components/ProfileEditorTabs';
import { JatakaStepForm } from '../components/profile/JatakaStepForm';
import { useMatrimony } from '../context/MatrimonyContext';

export const JatakaDetailsPage: React.FC = () => {
  const { currentUser, t } = useMatrimony();
  const navigate = useNavigate();

  if (!currentUser) {
    return <MemberAuthGate />;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-brand">
          {t('jataka.page_title')}
        </h1>
        <p className="mt-1 text-xs text-slate-600">{t('jataka.subtitle')}</p>
      </div>
      <ProfileEditorTabs />
      <JatakaStepForm
        onSavedContinue={() => navigate('/profile/preferences')}
        onSaveAndExit={() => navigate('/dashboard')}
      />
    </div>
  );
};
