import type { ReactNode } from 'react';

interface EditorModeShellProps {
  icon: ReactNode;
  title: string;
  description: string;
  hint?: string;
  /** Optional controls rendered on the right side of the header (e.g. read-aloud). */
  headerActions?: ReactNode;
  children: ReactNode;
}

export function EditorModeShell({
  icon,
  title,
  description,
  hint,
  headerActions,
  children,
}: EditorModeShellProps) {
  return (
    <div
      className="lcars-gradient-container flex-1 min-h-0 flex flex-col rounded-[24px_8px_24px_8px] border border-[var(--border-color)] bg-[var(--bg-card)] shadow-2xl overflow-hidden fluent-fade-in"
      style={{ minHeight: 'calc(100vh - 280px)' }}
    >
      <div className="px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/20 flex items-center justify-center">
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-bold tracking-widest text-[var(--text-primary)] uppercase">
            {title}
          </h3>
          <p className="text-xs text-[var(--accent-color)] uppercase tracking-wider mt-0.5">
            {description}
          </p>
        </div>
        {headerActions ? (
          <div className="ml-auto flex items-center gap-1">{headerActions}</div>
        ) : null}
      </div>
      {children}
      {hint ? (
        <div className="px-6 py-3 border-t border-[var(--border-color)] bg-[var(--bg-sidebar)]">
          <p className="text-xs text-[var(--text-secondary)]">{hint}</p>
        </div>
      ) : null}
    </div>
  );
}
