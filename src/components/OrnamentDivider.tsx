import React from 'react';

interface OrnamentDividerProps {
  className?: string;
}

export const OrnamentDivider: React.FC<OrnamentDividerProps> = ({ className = '' }) => {
  return (
    <div className={`flex items-center justify-center gap-4 ${className}`} aria-hidden="true">
      <span className="h-px w-16 bg-gradient-to-r from-transparent to-brand-accent/60" />
      <svg
        width="28"
        height="18"
        viewBox="0 0 28 18"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-brand-accent shrink-0"
      >
        <path
          d="M14 2C16.2 6.5 16.5 10.5 14 15.5C11.5 10.5 11.8 6.5 14 2Z"
          fill="var(--theme-on-dark-accent)"
          stroke="currentColor"
          strokeWidth="1.2"
        />
        <path
          d="M14 15.5C17.8 14 21.2 11 22.5 6.8C18.5 7.2 15.6 10.2 14 15.5Z"
          stroke="currentColor"
          strokeWidth="1.2"
        />
        <path
          d="M14 15.5C10.2 14 6.8 11 5.5 6.8C9.5 7.2 12.4 10.2 14 15.5Z"
          stroke="currentColor"
          strokeWidth="1.2"
        />
        <circle cx="2" cy="9" r="1.2" fill="currentColor" />
        <circle cx="26" cy="9" r="1.2" fill="currentColor" />
      </svg>
      <span className="h-px w-16 bg-gradient-to-l from-transparent to-brand-accent/60" />
    </div>
  );
};
