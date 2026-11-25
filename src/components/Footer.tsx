import React from 'react';
import { Link } from 'react-router-dom';
import { useMatrimony } from '../context/MatrimonyContext';

export const Footer: React.FC = () => {
  const { isAdminAuthenticated, t } = useMatrimony();

  return (
    <footer className="border-t border-hairline bg-footer-bg text-slate-200">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand Column */}
          <div className="space-y-4">
            <Link to="/" className="inline-flex items-center gap-2.5">
              <svg
                width="26"
                height="26"
                viewBox="0 0 32 32"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <circle cx="13" cy="16" r="7.5" stroke="var(--theme-canvas)" strokeWidth="2.2" />
                <circle cx="19" cy="16" r="7.5" stroke="var(--theme-accent)" strokeWidth="2.2" />
                <path d="M16 11.5C17.4 13.6 17.8 15.8 16 20.5C14.2 15.8 14.6 13.6 16 11.5Z" fill="var(--theme-on-dark-accent)" />
              </svg>
              <span className="font-display text-2xl font-semibold text-white">
                {t('brand.name')}
              </span>
            </Link>
            <p className="font-display text-lg italic text-on-dark-accent">
              {t('brand.tagline')}
            </p>
            <p className="text-sm leading-relaxed text-slate-400">
              {t('footer.desc')}
            </p>
          </div>

          {/* Explore Links */}
          <div>
            <h3 className="font-sans text-sm font-semibold text-on-dark-gold mb-4">
              {t('footer.explore')}
            </h3>
            <ul className="space-y-2.5 text-sm text-slate-300">
              <li>
                <Link to="/" className="hover:text-white transition-colors">
                  {t('nav.home')}
                </Link>
              </li>
              <li>
                <Link to="/search" className="hover:text-white transition-colors">
                  {t('nav.search')}
                </Link>
              </li>
              <li>
                <Link to="/membership" className="hover:text-white transition-colors">
                  {t('nav.membership')}
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-white transition-colors">
                  {t('nav.about')}
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-white transition-colors">
                  {t('nav.contact')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Member & Profile Suite */}
          <div>
            <h3 className="font-sans text-sm font-semibold text-on-dark-gold mb-4">
              {t('footer.member_services')}
            </h3>
            <ul className="space-y-2.5 text-sm text-slate-300">
              <li>
                <Link to="/register" className="hover:text-white transition-colors">
                  {t('nav.register')}
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-white transition-colors">
                  {t('nav.login')}
                </Link>
              </li>
              <li>
                <Link to="/dashboard" className="hover:text-white transition-colors">
                  {t('nav.dashboard')}
                </Link>
              </li>
              <li>
                <Link to="/profile/create" className="hover:text-white transition-colors">
                  {t('nav.my_profile')}
                </Link>
              </li>
              <li>
                <Link to="/profile/jataka" className="hover:text-white transition-colors">
                  {t('profile.jataka')}
                </Link>
              </li>
              {isAdminAuthenticated && (
                <li>
                  <Link to="/admin" className="hover:text-white transition-colors">
                    {t('nav.admin')}
                  </Link>
                </li>
              )}
            </ul>
          </div>

          {/* Legal & Support */}
          <div>
            <h3 className="font-sans text-sm font-semibold text-on-dark-gold mb-4">
              {t('footer.trust_policies')}
            </h3>
            <ul className="space-y-2.5 text-sm text-slate-300">
              <li>
                <Link to="/privacy-policy" className="hover:text-white transition-colors">
                  {t('footer.privacy')}
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-white transition-colors">
                  {t('footer.terms')}
                </Link>
              </li>
              <li>
                <Link to="/forgot-password" className="hover:text-white transition-colors">
                  {t('footer.recovery')}
                </Link>
              </li>
              <li className="pt-2 text-xs text-slate-400">
                care@nimmimatrimony.com
                <br />
                Bengaluru · Mumbai · Chennai · London
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-xs text-slate-400 sm:flex-row">
          <p>
            © {new Date().getFullYear()} {t('brand.name')}. {t('footer.rights')}
          </p>
          <p>{t('footer.worldwide')}</p>
        </div>
      </div>
    </footer>
  );
};
