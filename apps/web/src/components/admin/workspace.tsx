import { type CSSProperties, type ReactNode } from "react";

import { cn } from "@tsu-stack/ui/lib/utils";

type WorkspacePageHeaderProps = {
  actions?: ReactNode;
  description: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
};

export function WorkspacePage({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto flex w-full max-w-7xl flex-col gap-6 p-5 sm:p-8", className)}>
      {children}
    </div>
  );
}

export function WorkspacePageHeader({
  actions,
  description,
  eyebrow,
  title
}: WorkspacePageHeaderProps) {
  return (
    <header className="flex flex-col gap-5 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2 text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

type WorkspaceStat = {
  detail?: ReactNode;
  label: ReactNode;
  markerClassName?: string;
  value: ReactNode;
};

export function WorkspaceStatStrip({ label, stats }: { label: string; stats: WorkspaceStat[] }) {
  return (
    <section
      aria-label={label}
      className="grid overflow-hidden rounded-xl border bg-card sm:grid-cols-[repeat(var(--stat-count),minmax(0,1fr))]"
      style={{ "--stat-count": stats.length } as CSSProperties}
    >
      {stats.map((stat, index) => (
        <div
          className={cn(
            "flex min-w-0 items-center justify-between gap-4 p-4 sm:block sm:p-5",
            index > 0 && "border-t sm:border-t-0 sm:border-l"
          )}
          key={index}
        >
          <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-muted-foreground">
            {stat.markerClassName ? (
              <span
                aria-hidden
                className={cn("size-1.5 shrink-0 rounded-full", stat.markerClassName)}
              />
            ) : null}
            <span className="truncate">{stat.label}</span>
          </div>
          <div className="mt-0 flex shrink-0 items-baseline gap-2 sm:mt-2 sm:justify-between">
            <strong className="text-xl font-semibold tabular-nums sm:text-2xl">{stat.value}</strong>
            {stat.detail ? (
              <span className="text-xs text-muted-foreground">{stat.detail}</span>
            ) : null}
          </div>
        </div>
      ))}
    </section>
  );
}

export function WorkspaceToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
      {children}
    </div>
  );
}
