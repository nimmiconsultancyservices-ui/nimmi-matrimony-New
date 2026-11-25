import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock, Image } from 'lucide-react';
import { MemberAuthGate } from '../components/MemberAuthGate';
import { ProfileEditorTabs } from '../components/ProfileEditorTabs';
import { EducationStepForm } from '../components/profile/EducationStepForm';
import { FamilyStepForm } from '../components/profile/FamilyStepForm';
import { JatakaStepForm } from '../components/profile/JatakaStepForm';
import { PersonalStepForm } from '../components/profile/PersonalStepForm';
import { PreferencesStepForm } from '../components/profile/PreferencesStepForm';
import { ReligionStepForm } from '../components/profile/ReligionStepForm';
import { useMatrimony } from '../context/MatrimonyContext';

export const CreateProfilePage: React.FC = () => {
  const { currentUser, setSelectedProfileForModal, t } = useMatrimony();
  const navigate = useNavigate();
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  if (!currentUser) {
    return <MemberAuthGate description={t('msg.auth_required_desc')} />;
  }

  const member = currentUser;

  const steps = [
    {
      num: '01',
      title: t('profile.personal'),
      desc: t('profile.personal_desc'),
      to: '/profile/personal',
      done: Boolean(member.personal.fullName && member.personal.aboutMe),
    },
    {
      num: '02',
      title: t('profile.religion_comm'),
      desc: t('profile.religion_comm_desc'),
      to: '/profile/religion',
      done: Boolean(member.religionCommunity.religionId && member.religionCommunity.communityId),
    },
    {
      num: '03',
      title: t('profile.family'),
      desc: t('profile.family_desc'),
      to: '/profile/family',
      done: Boolean(member.family.fatherName && member.family.motherName),
    },
    {
      num: '04',
      title: t('profile.education'),
      desc: t('profile.education_desc'),
      to: '/profile/education',
      done: Boolean(member.educationOccupation.qualification && member.educationOccupation.institution),
    },
    {
      num: '05',
      title: t('profile.jataka'),
      desc: t('profile.jataka_desc'),
      to: '/profile/jataka',
      done: Boolean(member.jataka.birthDate && member.jataka.birthPlace),
    },
    {
      num: '06',
      title: t('profile.preferences'),
      desc: t('profile.preferences_desc'),
      to: '/profile/preferences',
      done: Boolean(
        member.partnerPreferences.partnerExpectations || member.partnerPreferences.religion
      ),
    },
  ];

  const completedCount = steps.filter((s) => s.done).length + (member.photos.length > 0 ? 1 : 0);
  const totalSections = steps.length + 1;
  const completionPct = Math.round((completedCount / totalSections) * 100);
  const currentStep = steps[activeStepIndex];

  const goNext = () => {
    if (activeStepIndex < steps.length - 1) {
      setActiveStepIndex((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate('/profile/photos');
    }
  };

  const goPrevious =
    activeStepIndex > 0
      ? () => {
          setActiveStepIndex((prev) => Math.max(0, prev - 1));
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      : undefined;

  const handleSaveAndExit = () => {
    navigate('/dashboard');
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 space-y-6">
      {member.profileStatus === 'Pending' && (
        <div
          role="status"
          className="rounded-xl border border-amber-300 bg-amber-50/80 p-4 flex items-start gap-3"
        >
          <Clock className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900">
            <span className="font-semibold">{t('dashboard.pending_banner_title')}: </span>
            <span>{t('dashboard.pending_banner_desc')}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-accent-deep">
            {t('profile.studio_kicker')}
          </p>
          <h1 className="mt-1 font-display text-3xl sm:text-4xl font-semibold text-brand">
            {t('profile.studio_title')}
          </h1>
          <p className="mt-1 text-xs text-slate-600">{t('profile.wizard_mode_hint')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="rounded-lg border border-hairline bg-white px-3.5 py-2 text-xs font-semibold text-brand tabular-nums">
            {completionPct}% {t('common.completed')}
          </span>
          <button
            type="button"
            onClick={() => setSelectedProfileForModal(member)}
            className="rounded-lg border border-brand px-4 py-2 text-xs font-semibold text-brand hover:bg-brand hover:text-white transition-colors whitespace-nowrap"
          >
            {t('dashboard.preview_profile')}
          </button>
        </div>
      </div>

      <ProfileEditorTabs />

      {/* Multi-Step Progress Bar & Step Selector */}
      <div className="rounded-2xl border border-hairline bg-white p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-accent-deep tabular-nums">
            {t('profile.wizard_step_label', { current: activeStepIndex + 1, total: steps.length })}
            {' · '}
            <span className="text-brand">{currentStep.title}</span>
          </p>
          <Link
            to="/profile/photos"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline"
          >
            <Image className="h-3.5 w-3.5 text-brand-accent" />
            <span>{t('profile.photos')}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-canvas border border-hairline">
          <div
            className="h-full bg-brand transition-all duration-300"
            style={{ width: `${Math.round(((activeStepIndex + 1) / steps.length) * 100)}%` }}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {steps.map((step, idx) => {
            const isCurrent = idx === activeStepIndex;
            return (
              <button
                key={step.num}
                type="button"
                onClick={() => setActiveStepIndex(idx)}
                className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors ${
                  isCurrent
                    ? 'border-brand bg-canvas ring-1 ring-brand'
                    : 'border-hairline bg-white hover:border-brand-accent'
                }`}
              >
                <div className="flex w-full items-center justify-between text-[11px] font-mono">
                  <span className="font-semibold text-brand-accent tabular-nums">{step.num}</span>
                  {step.done ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                  ) : (
                    <Clock className="h-3.5 w-3.5 text-amber-600" />
                  )}
                </div>
                <span className="text-xs font-semibold text-brand line-clamp-1">
                  {step.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Step Header & Form */}
      <div className="space-y-3">
        <div className="px-1">
          <h2 className="font-display text-2xl font-semibold text-brand">
            {currentStep.num}. {currentStep.title}
          </h2>
          <p className="text-xs text-slate-600">{currentStep.desc}</p>
        </div>

        {activeStepIndex === 0 && (
          <PersonalStepForm
            onSavedContinue={goNext}
            onSaveAndExit={handleSaveAndExit}
            submitLabel={t('personal.save_continue')}
          />
        )}
        {activeStepIndex === 1 && (
          <ReligionStepForm
            onPrevious={goPrevious}
            onSavedContinue={goNext}
            onSaveAndExit={handleSaveAndExit}
            submitLabel={t('profile.next_step')}
          />
        )}
        {activeStepIndex === 2 && (
          <FamilyStepForm
            onPrevious={goPrevious}
            onSavedContinue={goNext}
            onSaveAndExit={handleSaveAndExit}
            submitLabel={t('family.save_continue')}
          />
        )}
        {activeStepIndex === 3 && (
          <EducationStepForm
            onPrevious={goPrevious}
            onSavedContinue={goNext}
            onSaveAndExit={handleSaveAndExit}
            submitLabel={t('edu.save_continue')}
          />
        )}
        {activeStepIndex === 4 && (
          <JatakaStepForm
            onPrevious={goPrevious}
            onSavedContinue={goNext}
            onSaveAndExit={handleSaveAndExit}
            submitLabel={t('jataka.save_continue')}
          />
        )}
        {activeStepIndex === 5 && (
          <PreferencesStepForm
            onPrevious={goPrevious}
            onSavedContinue={goNext}
            onSaveAndExit={handleSaveAndExit}
            submitLabel={t('common.save')}
          />
        )}
      </div>
    </div>
  );
};
