import React from 'react';
import { NavLink } from 'react-router-dom';
import { useMatrimony } from '../context/MatrimonyContext';

export const ProfileEditorTabs: React.FC = () => {
  const { t } = useMatrimony();

  const profileTabs = [
    { to: '/profile/create', label: t('profile.overview') },
    { to: '/profile/personal', label: t('profile.personal') },
    { to: '/profile/religion', label: t('profile.religion_comm') },
    { to: '/profile/family', label: t('profile.family') },
    { to: '/profile/education', label: t('profile.education') },
    { to: '/profile/jataka', label: t('profile.jataka') },
    { to: '/profile/preferences', label: t('profile.preferences') },
    { to: '/profile/photos', label: t('profile.photos') },
  ];

  return (
    <div className="mb-8 border-b border-hairline">
      <nav
        aria-label="Profile editor sections"
        className="flex items-center gap-1 overflow-x-auto pb-px"
      >
        {profileTabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `whitespace-nowrap shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-brand text-brand'
                  : 'border-transparent text-slate-600 hover:border-brand-accent/60 hover:text-brand'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
};
