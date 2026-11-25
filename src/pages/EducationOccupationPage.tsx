import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MemberAuthGate } from '../components/MemberAuthGate';
import { ProfileEditorTabs } from '../components/ProfileEditorTabs';
import { EducationStepForm } from '../components/profile/EducationStepForm';
import { useMatrimony } from '../context/MatrimonyContext';

export const EducationOccupationPage: React.FC = () => {
  const { currentUser, t } = useMatrimony();
  const navigate = useNavigate();

  if (!currentUser) {
    return <MemberAuthGate />;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl sm:text-4xl font-semibold text-brand mb-6">
        {t('edu.page_title')}
      </h1>
      <ProfileEditorTabs />
      <EducationStepForm
        onSavedContinue={() => navigate('/profile/jataka')}
        onSaveAndExit={() => navigate('/dashboard')}
      />
    </div>
  );
};
