import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, Camera, Map as MapIcon, Plus, Trophy, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { fetchUnreadCount } from "@/lib/notifications";

const tabs = [
  { to: "/map", label: "Map", Icon: MapIcon },
  { to: "/report/capture", label: "Report", Icon: Camera },
  { to: "/alerts", label: "Alerts", Icon: Bell },
  { to: "/community", label: "Community", Icon: Trophy },
  { to: "/profile", label: "Profile", Icon: User },
] as const;

export function BottomNav() {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    void fetchUnreadCount(user.id).then(setUnread).catch(() => undefined);
  }, [user]);

  return (
    <>
      <Link
        to="/report/capture"
        aria-label="Capture a new road damage report"
        className="fixed bottom-9 left-1/2 z-[901] flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-[0_8px_24px_rgba(0,212,255,0.35)]"
      >
        <Plus className="h-7 w-7" aria-hidden="true" />
      </Link>
      <nav
        aria-label="Primary"
        className="glass fixed inset-x-0 bottom-0 z-[900] grid grid-cols-5 border-t border-border pb-[env(safe-area-inset-bottom)]"
      >
        {tabs.map(({ to, label, Icon }) => (
          <Link
            key={to}
            to={to}
            className={`tap-target flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium text-muted-foreground ${
              to === "/alerts" ? "" : ""
            }`}
            activeProps={{ className: "text-accent" }}
            activeOptions={{ exact: to === "/map" }}
          >
            <span className="relative">
              <Icon className="h-5 w-5" aria-hidden="true" />
              {to === "/alerts" && unread > 0 ? (
                <span
                  aria-label={`${unread} unread alerts`}
                  className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[10px] font-bold text-foreground"
                >
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </span>
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
