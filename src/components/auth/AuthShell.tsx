import type { ReactNode } from "react";
import { Activity } from "lucide-react";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen flex-col items-center overflow-hidden bg-background px-6 py-10">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-accent/15 blur-3xl" />
      <div className="relative flex w-full max-w-md flex-1 flex-col">
        <div className="flex flex-col items-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface ring-1 ring-accent/40">
            <Activity className="h-6 w-6 text-accent" aria-hidden="true" />
          </span>
          <span className="mt-2 text-sm font-semibold tracking-wide text-muted-foreground">
            Road<span className="text-accent">Pulse</span>
          </span>
        </div>

        <h1 className="mt-8 text-center text-2xl font-bold text-foreground">{title}</h1>
        {subtitle ? (
          <p className="mt-2 text-center text-sm text-muted-foreground">{subtitle}</p>
        ) : null}

        <div className="mt-8">{children}</div>

        {footer ? <div className="mt-auto pt-8">{footer}</div> : null}
      </div>
    </main>
  );
}

export function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5a4.7 4.7 0 0 1-2 3.1l3.2 2.5c1.9-1.7 3-4.3 3-7.4 0-.7-.1-1.4-.2-2.1H12z"
      />
      <path
        fill="#34A853"
        d="M6.6 14.3 5.9 15l-2.5 2A9 9 0 0 0 12 21c2.4 0 4.5-.8 6-2.2l-3.2-2.5c-.8.6-1.9.9-2.8.9-2.3 0-4.3-1.5-5-3.6z"
      />
      <path
        fill="#FBBC05"
        d="M3.4 7A9 9 0 0 0 3.4 17l3.3-2.6a5.4 5.4 0 0 1 0-3.4z"
      />
      <path
        fill="#4285F4"
        d="M12 6.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 3.4 7l3.3 2.6C7.4 8.1 9.5 6.6 12 6.6z"
      />
    </svg>
  );
}
