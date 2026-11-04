import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

const base = (p: P) => ({
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  width: 16,
  height: 16,
  ...p,
});

export const IconAperture = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3v7.5M20.5 8.2l-6.9 3.9M18.4 18.9l-4.3-7.3M5.6 18.9l6.9-4M3.5 8.2l7 4" />
  </svg>
);
export const IconUpload = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" />
    <path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" />
  </svg>
);
export const IconDownload = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 4v11m0 0 4.5-4.5M12 15l-4.5-4.5" />
    <path d="M4 17v1.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V17" />
  </svg>
);
export const IconImage = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="4.5" width="18" height="15" rx="2" />
    <circle cx="8.5" cy="9.5" r="1.6" />
    <path d="m3.5 17 5-4.6 3.6 3.2 3-2.6 5.4 4.6" />
  </svg>
);
export const IconSliders = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 4v6m0 4v6M12 4v3m0 4v9M19 4v10m0 4v2" />
    <circle cx="5" cy="12" r="2" />
    <circle cx="12" cy="9" r="2" />
    <circle cx="19" cy="16" r="2" />
  </svg>
);
export const IconWheel = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3.5v5M12 15.5v5M3.5 12h5M15.5 12h5" />
  </svg>
);
export const IconCurve = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 20h18M3 3v18" />
    <path d="M4 19C8 19 9 6 20 5" />
    <circle cx="9.6" cy="13.2" r="1.5" />
    <circle cx="15.4" cy="7.6" r="1.5" />
  </svg>
);
export const IconSplit = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 3.5v17" />
    <path d="M12 3.5a8.5 8.5 0 0 1 0 17" fill="currentColor" opacity=".25" stroke="none" />
  </svg>
);
export const IconSparkle = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3.5 13.7 9 19 10.7 13.7 12.4 12 18l-1.7-5.6L5 10.7 10.3 9z" />
    <path d="M18.5 16.5 19.2 18.6 21.3 19.3 19.2 20 18.5 22.1 17.8 20 15.7 19.3 17.8 18.6z" />
  </svg>
);
export const IconNodes = (p: P) => (
  <svg {...base(p)}>
    <rect x="2.5" y="8" width="6" height="8" rx="1.6" />
    <rect x="15.5" y="8" width="6" height="8" rx="1.6" />
    <path d="M8.5 12h7" />
    <circle cx="12" cy="12" r="1.6" />
  </svg>
);
export const IconUndo = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 9h11a5 5 0 0 1 0 10H8" />
    <path d="M7.5 5.5 4 9l3.5 3.5" />
  </svg>
);
export const IconRedo = (p: P) => (
  <svg {...base(p)}>
    <path d="M20 9H9a5 5 0 0 0 0 10h7" />
    <path d="M16.5 5.5 20 9l-3.5 3.5" />
  </svg>
);
export const IconEye = (p: P) => (
  <svg {...base(p)}>
    <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="2.8" />
  </svg>
);
export const IconEyeOff = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 4.5 20 20" />
    <path d="M9.6 6.2A9.6 9.6 0 0 1 12 5.8c6 0 9.5 6.2 9.5 6.2a17 17 0 0 1-3.3 4" />
    <path d="M6.4 8A17 17 0 0 0 2.5 12S6 18.2 12 18.2a9.7 9.7 0 0 0 3.6-.7" />
    <path d="M10.2 10.4a2.8 2.8 0 0 0 3.7 3.9" />
  </svg>
);
export const IconCompare = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M12 5v14" />
    <path d="M8.4 10.2 6 12l2.4 1.8M15.6 10.2 18 12l-2.4 1.8" />
  </svg>
);
export const IconZoomIn = (p: P) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M11 8.5v5M8.5 11h5M16 16l4.5 4.5" />
  </svg>
);
export const IconZoomOut = (p: P) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M8.5 11h5M16 16l4.5 4.5" />
  </svg>
);
export const IconFit = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15" />
  </svg>
);
export const IconX = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const IconPlus = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconTrash = (p: P) => (
  <svg {...base(p)}>
    <path d="M4.5 7h15M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7" />
    <path d="M6.5 7 7.4 19a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />
    <path d="M10.5 11v5.5M13.5 11v5.5" />
  </svg>
);
export const IconReset = (p: P) => (
  <svg {...base(p)}>
    <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
    <path d="M3.5 4.5V10H9" />
  </svg>
);
export const IconGithub = (p: P) => (
  <svg {...base({ ...p, fill: "currentColor", stroke: "none" })}>
    <path d="M12 2.2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48l-.01-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.36 1.09 2.94.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85l-.01 2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2.2Z" />
  </svg>
);
export const IconKeyboard = (p: P) => (
  <svg {...base(p)}>
    <rect x="2.5" y="6" width="19" height="12" rx="2" />
    <path d="M6 9.5h.01M9.5 9.5h.01M13 9.5h.01M16.5 9.5h.01M6 13h.01M18 13h.01M9 16h6" />
    <path d="M9.5 13h5" />
  </svg>
);
export const IconFilm = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="4.5" width="18" height="15" rx="2" />
    <path d="M7 4.5v15M17 4.5v15M3 9h4M3 15h4M17 9h4M17 15h4" />
  </svg>
);
export const IconChart = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 20h18" />
    <path d="M6 20V13M10 20V6M14 20v-5M18 20V9" />
  </svg>
);
export const IconWave = (p: P) => (
  <svg {...base(p)}>
    <path d="M2.5 12c2-5 3.5 5 5.5 0s3.5 5 5.5 0 3.5 5 5.5 0" />
  </svg>
);
export const IconScope = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 3.5v17M3.5 12h17" />
    <circle cx="15" cy="9" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);
export const IconLock = (p: P) => (
  <svg {...base(p)}>
    <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
  </svg>
);
export const IconSave = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 4.5h11L19.5 8v11.5a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1Z" />
    <path d="M8 4.5v5h7M8 20v-5.5h8V20" />
  </svg>
);
export const IconFolder = (p: P) => (
  <svg {...base(p)}>
    <path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h3.6l1.8 2.2H19a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 19.2H5A1.5 1.5 0 0 1 3.5 17.7Z" />
  </svg>
);
export const IconChevron = (p: P) => (
  <svg {...base(p)}>
    <path d="m9 5 7 7-7 7" />
  </svg>
);
export const IconCheck = (p: P) => (
  <svg {...base(p)}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </svg>
);
export const IconPower = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3.5v8" />
    <path d="M6.8 6.9a7.5 7.5 0 1 0 10.4 0" />
  </svg>
);
export const IconLayers = (p: P) => (
  <svg {...base(p)}>
    <path d="m12 3.5 8.5 4.4L12 12.3 3.5 7.9Z" />
    <path d="m3.5 12.4 8.5 4.4 8.5-4.4M3.5 16.6 12 21l8.5-4.4" />
  </svg>
);
export const IconWarning = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 4.5 21 19.5H3Z" />
    <path d="M12 10v4.2M12 17h.01" />
  </svg>
);
export const IconDroplet = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3.5s5.5 6 5.5 9.6a5.5 5.5 0 1 1-11 0C6.5 9.5 12 3.5 12 3.5Z" />
  </svg>
);
