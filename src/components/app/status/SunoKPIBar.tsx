import { useEffect, useState } from 'react';
import { getKPISnapshot } from '../../../services/sunoService';
import type { SunoKPISnapshot } from '../../../types/suno';

export function SunoKPIBar() {
  const [kpi, setKpi] = useState<SunoKPISnapshot>(() => getKPISnapshot());

  useEffect(() => {
    const id = window.setInterval(() => setKpi(getKPISnapshot()), 2000);
    return () => window.clearInterval(id);
  }, []);

  const metrics = [
    { key: 'mode', label: 'Mode', value: kpi.mode.toUpperCase() },
    { key: 'req', label: 'Requests', value: String(kpi.totalRequests) },
    { key: 'ok', label: 'Success', value: String(kpi.successCount) },
    { key: 'err', label: 'Errors', value: String(kpi.errorCount) },
    { key: 'pend', label: 'Pending', value: String(kpi.pendingCount) },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
      {metrics.map((metric) => (
        <div
          key={metric.key}
          className="rounded-md border border-[var(--border-color)] bg-[var(--bg-app)] px-2 py-1.5"
        >
          <div className="text-[9px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">
            {metric.label}
          </div>
          <div className="text-[11px] font-semibold text-[var(--text-primary)]">
            {metric.value}
          </div>
        </div>
      ))}
    </div>
  );
}
