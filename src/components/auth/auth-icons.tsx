import type { SVGProps } from "react";

const baseProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "h-4 w-4",
};

export const UserIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...baseProps} {...props}>
    <path d="M20 21a8 8 0 0 0-16 0" />
    <circle cx="12" cy="8" r="4" />
  </svg>
);

export const LockIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...baseProps} {...props}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

export const EyeIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...baseProps} {...props}>
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
    <circle cx="12" cy="12" r="2.5" />
  </svg>
);

export const EyeOffIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...baseProps} {...props}>
    <path d="M3 3 21 21" />
    <path d="M10.6 10.6A2 2 0 0 0 12 14a2 2 0 0 0 1.4-.6" />
    <path d="M9.9 4.5A11.5 11.5 0 0 1 12 4c6.5 0 10 6 10 6a19.7 19.7 0 0 1-3 3.8" />
    <path d="M6.3 6.3A19.5 19.5 0 0 0 2 12s3.5 6 10 6a11.2 11.2 0 0 0 3.1-.4" />
  </svg>
);

export const LoginIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...baseProps} {...props}>
    <path d="M10 17 15 12 10 7" />
    <path d="M15 12H3" />
    <path d="M21 4v16" />
  </svg>
);

export const BellIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...baseProps} {...props}>
    <path d="M15 17H9l-1-1H6V10a6 6 0 1 1 12 0v6h-2Z" />
    <path d="M10 19a2 2 0 0 0 4 0" />
  </svg>
);

export const IdBadgeIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...baseProps} {...props}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="9" cy="12" r="2.5" />
    <path d="M14.5 10h3.5M14.5 13h3.5M14.5 16h3.5" />
  </svg>
);

export const ImageIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...baseProps} {...props}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="1.8" />
    <path d="m21 15-4-4-5 5-3-3-6 6" />
  </svg>
);
