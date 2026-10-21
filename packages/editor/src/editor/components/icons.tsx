import type { ReactNode } from 'react';

/** 20×20 line icons drawn with currentColor so they follow the theme. */
const PATHS: Record<string, ReactNode> = {
  turnInto: (
    <>
      <path d="M4 7.5a6 6 0 0 1 10.5-3L16 6" />
      <path d="M16 2.5V6h-3.5" />
      <path d="M16 12.5a6 6 0 0 1-10.5 3L4 14" />
      <path d="M4 17.5V14h3.5" />
    </>
  ),
  color: (
    <>
      <path d="M6 13.5 10 3.5l4 10" />
      <path d="M7.4 10h5.2" />
      <path d="M4 17h12" strokeWidth="2" />
    </>
  ),
  duplicate: (
    <>
      <rect x="7" y="7" width="10" height="10" rx="2" />
      <path d="M13 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
    </>
  ),
  copy: (
    <>
      <rect x="5" y="4" width="10" height="13" rx="2" />
      <path d="M8 3h4v2.5H8z" />
      <path d="M8 10h4M8 13h3" />
    </>
  ),
  moveUp: (
    <>
      <path d="M10 16V4" />
      <path d="m5 9 5-5 5 5" />
    </>
  ),
  moveDown: (
    <>
      <path d="M10 4v12" />
      <path d="m5 11 5 5 5-5" />
    </>
  ),
  indent: (
    <>
      <path d="M3 4h14M9 8.5h8M9 12.5h8M3 16.5h14" />
      <path d="m3 8 3 2.5L3 13" />
    </>
  ),
  outdent: (
    <>
      <path d="M3 4h14M9 8.5h8M9 12.5h8M3 16.5h14" />
      <path d="M6 8 3 10.5 6 13" />
    </>
  ),
  trash: (
    <>
      <path d="M3.5 5.5h13" />
      <path d="M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5" />
      <path d="M5 5.5 6 16a1.5 1.5 0 0 0 1.5 1.4h5A1.5 1.5 0 0 0 14 16l1-10.5" />
      <path d="M8.5 9v5M11.5 9v5" />
    </>
  ),
  chevronRight: <path d="m8 5 5 5-5 5" />,
  chevronLeft: <path d="m12 5-5 5 5 5" />,
  check: <path d="m4.5 10.5 3.5 3.5 7.5-8" />,
  text: (
    <>
      <path d="M4 5V3.5h12V5" />
      <path d="M10 3.5v13M7.5 16.5h5" />
    </>
  ),
  bullet: (
    <>
      <circle cx="4.5" cy="5.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="10" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="14.5" r="1.2" fill="currentColor" stroke="none" />
      <path d="M8.5 5.5h8M8.5 10h8M8.5 14.5h8" />
    </>
  ),
  numbered: (
    <>
      <path d="M3.5 4 5 3.2V8M3.5 8h3" strokeWidth="1.3" />
      <path d="M3.4 12.3a1.3 1.3 0 1 1 2.3 1L3.5 16h2.8" strokeWidth="1.3" />
      <path d="M9 5.5h7.5M9 10h7.5M9 14.5h7.5" />
    </>
  ),
  todo: (
    <>
      <rect x="3" y="3" width="14" height="14" rx="3" />
      <path d="m6.5 10 2.5 2.5 4.5-5" />
    </>
  ),
  toggle: (
    <>
      <path d="M4 5.5 7.5 8 4 10.5z" fill="currentColor" stroke="none" />
      <path d="M10 8h7M7 14h10" />
    </>
  ),
  quote: (
    <>
      <path d="M4 3.5v13" strokeWidth="2.2" />
      <path d="M8.5 6h8M8.5 10h8M8.5 14h5" />
    </>
  ),
  callout: (
    <>
      <rect x="2.5" y="4" width="15" height="12" rx="2.5" />
      <circle cx="6.5" cy="8" r="1.2" fill="currentColor" stroke="none" />
      <path d="M9.5 8h5M6 12h8.5" />
    </>
  ),
  code: (
    <>
      <path d="m7 6-4 4 4 4M13 6l4 4-4 4" />
      <path d="m11 4.5-2 11" />
    </>
  ),
  divider: (
    <>
      <path d="M2.5 10h15" />
      <path d="M5 5.5h10M5 14.5h10" opacity="0.4" />
    </>
  ),
  image: (
    <>
      <rect x="2.5" y="3.5" width="15" height="13" rx="2" />
      <circle cx="7" cy="8" r="1.5" />
      <path d="m3 15 4.5-4.5 3 3 2.5-2.5 4.5 4.5" />
    </>
  ),
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

/** Heading tiles read better as type than as a drawing. */
export function TypeGlyph({ icon }: { icon: string | ReactNode }) {
  if (typeof icon !== 'string') return <>{icon}</>;
  return icon in PATHS ? <Icon name={icon as IconName} /> : <span className="glyph">{icon}</span>;
}
