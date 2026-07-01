import { useEffect, useState } from 'react';
import { getKPISnapshot } from '../../../services/sunoService';
import type { SunoKPISnapshot } from '../../../types/suno';

function formatLatency(lastGenerationMs: number | null): string {
  return lastGenerationMs == null ? '—' : `${lastGenerationMs}ms`;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)]">{label}</div>
      <div className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{value}</div>
    </div>
  );
}

export function SunoKPIBar() {
  const [kpi, setKpi] = useState<SunoKPISnapshot>(getKPISnapshot());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setKpi(getKPISnapshot());
    }, 2000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <StatCard label="Mode" value={kpi.mode === 'prod' ? 'EvoLink' : 'Dev'} />
        <StatCard label="Requests" value={kpi.totalRequests} />
        <StatCard label="Success" value={kpi.successCount} />
        <StatCard label="Errors" value={kpi.errorCount} />
        <StatCard label="Pending" value={kpi.pendingCount} />
        <StatCard label="Last gen" value={formatLatency(kpi.lastGenerationMs)} />
      </div>
      {kpi.lastError && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-[var(--text-primary)]">
          {kpi.lastError}
        </p>
      )}
    </div>
  );
}
