import { Link } from "@tanstack/react-router";
import { Bell, Camera, Map as MapIcon, Trophy, User } from "lucide-react";

const tabs = [
  { to: "/map", label: "Map", Icon: MapIcon },
  { to: "/report/capture", label: "Report", Icon: Camera },
  { to: "/alerts", label: "Alerts", Icon: Bell },
  { to: "/community", label: "Community", Icon: Trophy },
  { to: "/profile", label: "Profile", Icon: User },
] as const;

export function BottomNav() {
  return (
    <nav
      aria-label="Primary"
      className="glass fixed inset-x-0 bottom-0 z-[900] grid grid-cols-5 border-t border-border pb-[env(safe-area-inset-bottom)]"
    >
      {tabs.map(({ to, label, Icon }) => (
        <Link
          key={to}
          to={to}
          className="tap-target flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium text-muted-foreground"
          activeProps={{ className: "text-accent" }}
          activeOptions={{ exact: to === "/map" }}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
