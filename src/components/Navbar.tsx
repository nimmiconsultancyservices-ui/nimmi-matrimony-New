import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Menu, Palette, X } from 'lucide-react';
import { useMatrimony } from '../context/MatrimonyContext';
import { useTheme } from '../context/ThemeContext';
import { LanguageSelector } from './LanguageSelector';
import { PWAInstallButton } from './PWAInstallButton';

export const Navbar: React.FC = () => {
  const {
    userRole,
    isAdminAuthenticated,
    logout,
    t,
  } = useMatrimony();
  const { activeTheme, openThemeSelector } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
      isActive
        ? 'text-brand border-brand-accent'
        : 'text-slate-600 border-transparent hover:text-brand hover:border-brand-accent/50'
    }`;

  const mobileNavItems = [
    { to: '/', label: t('nav.home') },
    { to: '/search', label: t('nav.search') },
    { to: '/membership', label: t('nav.membership') },
    { to: '/about', label: t('nav.about') },
    { to: '/contact', label: t('nav.contact') },
    ...(userRole !== 'guest'
      ? [
          { to: '/dashboard', label: t('nav.dashboard') },
          { to: '/profile/create', label: t('nav.complete_profile') },
        ]
      : []),
    ...(isAdminAuthenticated ? [{ to: '/admin', label: t('nav.admin') }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-1.5 min-[400px]:gap-2.5 sm:gap-4 lg:gap-8 px-2.5 py-2.5 min-[400px]:px-3.5 sm:px-6 sm:py-3.5 lg:px-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <Link
          to="/"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-1.5 sm:gap-2.5 text-brand whitespace-nowrap min-w-0 shrink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-md"
        >
          <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            className="h-5 w-5 min-[400px]:h-6 min-[400px]:w-6 sm:h-7 sm:w-7 shrink-0"
          >
            <circle cx="13" cy="16" r="7.5" stroke="var(--theme-primary)" strokeWidth="2.2" />
            <circle cx="19" cy="16" r="7.5" stroke="var(--theme-accent)" strokeWidth="2.2" />
            <path d="M16 11.5C17.4 13.6 17.8 15.8 16 20.5C14.2 15.8 14.6 13.6 16 11.5Z" fill="var(--theme-on-dark-accent)" />
          </svg>
          <span className="font-display text-[14px] min-[400px]:text-[17px] sm:text-2xl font-semibold tracking-tight text-brand whitespace-nowrap truncate max-w-[115px] min-[440px]:max-w-[180px] sm:max-w-none">
            {t('brand.name')}
          </span>
        </Link>

        {/* Zone 2: Concise Single-line Navigation Links */}
        <nav className="hidden lg:flex items-center gap-6" aria-label="Main navigation">
          <NavLink to="/" className={navLinkClass} end>
            {t('nav.home')}
          </NavLink>
          <NavLink to="/search" className={navLinkClass}>
            {t('nav.search')}
          </NavLink>
          <NavLink to="/membership" className={navLinkClass}>
            {t('nav.membership')}
          </NavLink>
          {userRole === 'guest' ? (
            <NavLink to="/about" className={navLinkClass}>
              {t('nav.about')}
            </NavLink>
          ) : (
            <NavLink to="/dashboard" className={navLinkClass}>
              {t('nav.dashboard')}
            </NavLink>
          )}
          {isAdminAuthenticated ? (
            <NavLink to="/admin" className={navLinkClass}>
              {t('nav.admin')}
            </NavLink>
          ) : userRole === 'member' ? (
            <NavLink to="/profile/create" className={navLinkClass}>
              {t('nav.complete_profile')}
            </NavLink>
          ) : (
            <NavLink to="/contact" className={navLinkClass}>
              {t('nav.contact')}
            </NavLink>
          )}
        </nav>

        {/* Zone 3: Theme, Install, Language Selector & Side-by-Side Header Action Buttons */}
        <div className="flex items-center gap-1 min-[400px]:gap-1.5 sm:gap-2.5 shrink-0">
          <button
            type="button"
            onClick={openThemeSelector}
            aria-label={`${t('nav.theme')}: ${activeTheme.name}`}
            title={`${t('nav.theme')}: ${activeTheme.name}`}
            className="hidden sm:inline-flex h-10 items-center gap-2 rounded-lg border border-hairline bg-canvas px-3 text-xs font-medium text-ink hover:border-brand hover:text-brand transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <span className="flex items-center -space-x-1" aria-hidden="true">
              <span
                className="h-3 w-3 rounded-full border border-white shadow-xs"
                style={{ backgroundColor: activeTheme.swatches[0] }}
              />
              <span
                className="h-3 w-3 rounded-full border border-white shadow-xs"
                style={{ backgroundColor: activeTheme.swatches[1] }}
              />
            </span>
            <span>{t('nav.theme')}</span>
          </button>

          <div className="hidden xl:block">
            <PWAInstallButton />
          </div>

          <LanguageSelector />

          {userRole === 'guest' ? (
            <div className="flex items-center gap-1 min-[400px]:gap-1.5 sm:gap-2.5 shrink-0">
              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                className="inline-flex h-8 min-[400px]:h-9 sm:h-10 items-center justify-center rounded-lg bg-header-login px-1.5 min-[400px]:px-2.5 sm:px-4 text-[10px] min-[400px]:text-xs sm:text-sm font-semibold text-white hover:bg-header-login-hover transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                {t('nav.login')}
              </Link>
              <Link
                to="/register"
                onClick={() => setMobileOpen(false)}
                className="inline-flex h-8 min-[400px]:h-9 sm:h-10 items-center justify-center rounded-lg bg-header-register px-1.5 min-[400px]:px-2.5 sm:px-4 text-[10px] min-[400px]:text-xs sm:text-sm font-semibold text-white hover:bg-header-register-hover transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2"
              >
                {t('nav.register')}
              </Link>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                void logout();
                navigate('/');
              }}
              className="hidden sm:inline-flex h-10 items-center justify-center rounded-lg border border-brand px-4 text-sm font-medium text-brand hover:bg-brand hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              {t('nav.sign_out')}
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="lg:hidden inline-flex h-8 w-8 min-[400px]:h-9 min-[400px]:w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg border border-hairline text-ink hover:bg-canvas shrink-0"
            aria-label={mobileOpen ? t('nav.close_menu') : t('nav.open_menu')}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-4 w-4 sm:h-5 sm:w-5" /> : <Menu className="h-4 w-4 sm:h-5 sm:w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-hairline bg-white px-4 py-5 space-y-4">
          <nav className="flex flex-col space-y-2">
            {mobileNavItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink hover:bg-tint hover:text-brand"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="pt-3 border-t border-hairline flex flex-col gap-2.5">
            <LanguageSelector fullWidth align="left" />

            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                openThemeSelector();
              }}
              className="flex w-full items-center justify-between rounded-lg border border-hairline bg-canvas px-3.5 py-2.5 text-sm font-medium text-ink hover:border-brand"
            >
              <span className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-brand" />
                <span>{t('nav.website_theme')}</span>
              </span>
              <span className="flex items-center gap-2 text-xs font-semibold text-brand">
                <span>{activeTheme.name}</span>
                <span className="flex items-center -space-x-1" aria-hidden="true">
                  {activeTheme.swatches.map((hex) => (
                    <span
                      key={hex}
                      className="h-3 w-3 rounded-full border border-white"
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </span>
              </span>
            </button>
            {userRole === 'guest' ? (
              <div className="grid grid-cols-2 gap-2.5">
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex h-11 items-center justify-center rounded-lg bg-header-login px-3 text-center text-sm font-semibold text-white hover:bg-header-login-hover transition-colors whitespace-nowrap"
                >
                  {t('nav.login')}
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex h-11 items-center justify-center rounded-lg bg-header-register px-3 text-center text-sm font-semibold text-white hover:bg-header-register-hover transition-colors whitespace-nowrap"
                >
                  {t('nav.register')}
                </Link>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  void logout();
                  setMobileOpen(false);
                  navigate('/');
                }}
                className="w-full rounded-lg border border-brand py-3 text-center text-sm font-medium text-brand"
              >
                {t('nav.sign_out')}
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
