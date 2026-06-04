/**
 * Small reusable UI components for AnalysisPanel.
 * These are pure presentational components for displaying analysis data.
 */
import { Text, Badge, Tooltip } from '@fluentui/react-components';
import { SearchRegular } from '@fluentui/react-icons';
import type { SectionInsight } from '../../../lib/workers/linguistics.types';
import type { DetectedSchema } from '../../../lib/linguistics/core/types';

export function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--border-color)] p-2 bg-[var(--bg-sidebar)] text-center">
      <Text size={500} weight="bold" className="block font-mono text-[var(--lcars-amber)]">
        {value}
      </Text>
      {/* size={200} = Fluent SM ≈ 12px — was size={100} ≈ 10px (below floor) */}
      <Text size={200} className="text-[var(--text-muted)] uppercase tracking-wider">
        {label}
      </Text>
    </div>
  );
}

export function SectionInsightCard({ section }: { section: SectionInsight }) {
  return (
    <div className="rounded-lg border border-[var(--border-color)] p-3 bg-[var(--bg-sidebar)]">
      <div className="flex items-center justify-between mb-2">
        <Text weight="semibold" size={300} className="font-mono text-[var(--lcars-amber)]">
          {section.sectionName}
        </Text>
        {/* size={200} — was size={100} */}
        <Text size={200} className="text-[var(--text-muted)]">
          {section.lineInsights.length} lines
        </Text>
      </div>
      <div className="grid grid-cols-3 gap-1 text-center text-xs">
        <div>
          <Text weight="bold" className="block font-mono">{section.totalSyllables}</Text>
          {/* size={200} — was size={100} */}
          <Text size={200} className="text-[var(--text-muted)]">σ total</Text>
        </div>
        <div>
          <Text weight="bold" className="block font-mono">{section.avgSyllablesPerLine.toFixed(1)}</Text>
          <Text size={200} className="text-[var(--text-muted)]">σ/line</Text>
        </div>
        <div>
          <Text weight="bold" className="block font-mono">{section.avgWordsPerLine.toFixed(1)}</Text>
          <Text size={200} className="text-[var(--text-muted)]">w/line</Text>
        </div>
      </div>
    </div>
  );
}

export function SchemaDisplay({
  target,
  detected,
  detectedSchemaObj,
}: {
  target: string;
  detected: string;
  detectedSchemaObj?: DetectedSchema;
}) {
  const match = target && detected && target === detected;
  const confidence = detectedSchemaObj?.confidence ?? null;
  const confidencePct = confidence !== null ? `${Math.round(confidence * 100)}%` : null;

  const detectedTooltip = [
    `Detected: ${detected || '—'}`,
    confidencePct ? `Confidence: ${confidencePct}` : null,
    detectedSchemaObj?.lineCount ? `Lines: ${detectedSchemaObj.lineCount}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex items-center gap-1">
      {target && (
        <Tooltip content="Target schema" relationship="label">
          <Badge appearance="outline" color="informative" size="small">{target}</Badge>
        </Tooltip>
      )}
      {target && detected && <span className="text-[var(--text-muted)]">→</span>}
      <Tooltip content={detectedTooltip} relationship="label">
        <Badge
          appearance="filled"
          color={match ? 'success' : detected ? 'warning' : 'informative'}
          size="small"
        >
          {detected || '—'}
        </Badge>
      </Tooltip>
      {/* text-xs = 12px minimum */}
      {confidencePct && (
        <span className="text-[var(--text-muted)] text-xs font-mono">{confidencePct}</span>
      )}
    </div>
  );
}

export function DensityBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <Text size={200} className="text-[var(--text-muted)] min-w-[80px]">{label}:</Text>
      <div className="flex-1 h-1.5 rounded-full bg-[var(--border-color)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${Math.round(value * 100)}%`, backgroundColor: color }}
        />
      </div>
      <Text size={200} className="text-[var(--text-muted)] min-w-[32px] text-right font-mono">
        {(value * 100).toFixed(0)}%
      </Text>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      {/* SearchRegular disambiguates from the DataBarVertical24Regular panel header icon */}
      <SearchRegular className="text-[var(--text-muted)] mb-2 w-6 h-6" />
      <Text size={200} className="text-[var(--text-muted)]">{message}</Text>
    </div>
  );
}

export function rhymeTypeColor(type: string): 'success' | 'warning' | 'danger' | 'informative' | 'brand' {
  switch (type) {
    case 'rich': return 'success';
    case 'sufficient': return 'brand';
    case 'assonance': return 'warning';
    case 'weak': return 'informative';
    default: return 'informative';
  }
}
