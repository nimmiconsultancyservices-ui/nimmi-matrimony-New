import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MemberAuthGate } from '../components/MemberAuthGate';
import { ProfileEditorTabs } from '../components/ProfileEditorTabs';
import { ReligionStepForm } from '../components/profile/ReligionStepForm';
import { useMatrimony } from '../context/MatrimonyContext';

export const ReligionCommunityPage: React.FC = () => {
  const { currentUser, t } = useMatrimony();
  const navigate = useNavigate();

  if (!currentUser) {
    return <MemberAuthGate description={t('msg.sign_in_edit_desc')} />;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-brand">
          {t('religion.page_title')}
        </h1>
        <p className="mt-1 text-xs text-slate-600">{t('religion.page_subtitle')}</p>
      </div>
      <ProfileEditorTabs />
      <ReligionStepForm
        onSavedContinue={() => navigate('/profile/family')}
        onSaveAndExit={() => navigate('/dashboard')}
      />
    </div>
  );
};
