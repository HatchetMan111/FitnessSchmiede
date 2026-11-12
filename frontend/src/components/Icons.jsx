/** Inline-SVG-Icons für die Navigation - keine externe Icon-Abhängigkeit. */

const base = {
  viewBox: "0 0 24 24",
  width: 22,
  height: 22,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export function FlameIcon() {
  return (
    <svg {...base}>
      <path d="M12 3c.9 2.8-2.1 4.6-2.1 7.1a2.6 2.6 0 0 0 5.1.5C16.5 8.7 18 10.7 18 13.2A6 6 0 0 1 6 13.2c0-3.3 2.5-5.4 3.8-7.2C10.7 4.8 11.6 3.7 12 3Z" />
    </svg>
  );
}

export function CalendarIcon() {
  return (
    <svg {...base}>
      <rect x="4" y="5.5" width="16" height="15" rx="2.5" />
      <path d="M4 10.5h16M8.5 3v4M15.5 3v4" />
    </svg>
  );
}

export function ChartIcon() {
  return (
    <svg {...base}>
      <path d="M5 20v-6M12 20V5.5M19 20v-9" />
    </svg>
  );
}

export function AppleIcon() {
  return (
    <svg {...base}>
      <path d="M12 7.5c-2.8-2-6.8-.4-6.8 4.4 0 3.9 2.9 7.6 4.8 7.6.9 0 1.4-.5 2-.5s1.1.5 2 .5c1.9 0 4.8-3.7 4.8-7.6 0-4.8-4-6.4-6.8-4.4Z" />
      <path d="M12 7.5c0-2.1 1-3.6 3-4.3" />
    </svg>
  );
}

export function GearIcon() {
  return (
    <svg {...base}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v2.8M12 18.7v2.8M2.5 12h2.8M18.7 12h2.8M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
    </svg>
  );
}
