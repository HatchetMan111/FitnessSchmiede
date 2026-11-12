import { NavLink } from "react-router-dom";
import { AppleIcon, CalendarIcon, ChartIcon, FlameIcon, GearIcon } from "./Icons";

const ITEMS = [
  { to: "/", label: "Start", Icon: FlameIcon, end: true },
  { to: "/week/current", label: "Woche", Icon: CalendarIcon },
  { to: "/history", label: "Fortschritt", Icon: ChartIcon },
  { to: "/nutrition", label: "Ernährung", Icon: AppleIcon },
  { to: "/settings", label: "Setup", Icon: GearIcon },
];

/**
 * Mobile: fest stehende Tab-Leiste unten; ab 640px eine flache Pill-Leiste
 * unter dem Kopfbereich (siehe CSS).
 */
export function BottomNav() {
  return (
    <nav className="nav" aria-label="Hauptnavigation">
      {ITEMS.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `nav-item ${isActive ? "is-active" : ""}`}
        >
          <Icon />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
