/**
 * AnalysisTab — Rhyme schema detection, assonance/alliteration density
 */
import { Text, Badge } from '@fluentui/react-components';
import { SchemaDisplay, DensityBar, EmptyState, rhymeTypeColor } from './MicroComponents';
import type { SectionInsight } from '../../../lib/workers/linguistics.types';

export function AnalysisTab({ sections }: { sections: SectionInsight[] }) {
  if (sections.length === 0) {
    return <EmptyState message="No sections to analyse." />;
  }

  return (
    <div className="flex flex-col gap-3">
      {sections.map(sec => (
        <div key={sec.sectionId} className="rounded-lg border border-[var(--border-color)] p-3 bg-[var(--bg-sidebar)]">
          {/* text-xs = 12px minimum — font-size floor */}
          <Text weight="semibold" size={300} className="block mb-2 font-mono text-[var(--lcars-amber)]">
            {sec.sectionName}
          </Text>
          <div className="flex items-center gap-2 mb-2">
            <Text size={200} className="text-[var(--text-muted)] min-w-[80px]">Schema:</Text>
            <SchemaDisplay
              target={sec.targetSchema}
              detected={sec.detectedSchema}
              detectedSchemaObj={sec.detectedSchemaObj}
            />
          </div>
          <div className="flex flex-col gap-1 mb-2">
            <DensityBar label="Assonance" value={sec.assonanceDensity} color="var(--lcars-cyan)" />
            <DensityBar label="Alliteration" value={sec.alliterationDensity} color="var(--lcars-violet)" />
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {(Object.entries(sec.rhymeTypes) as [string, number][])
              .filter(([, count]) => count > 0)
              .map(([type, count]) => (
                <Badge key={type} appearance="filled" color={rhymeTypeColor(type)} size="small">
                  {type}: {count}
                </Badge>
              ))}
          </div>
          <div className="mt-2 flex flex-col gap-0.5">
            {sec.lineInsights.map(li => (
              <div key={li.lineId} className="flex items-center gap-2 text-xs font-mono">
                <Badge
                  appearance="outline"
                  color={li.rhymeLabel ? 'brand' : 'informative'}
                  size="small"
                  className="min-w-[20px] text-center"
                >
                  {li.rhymeLabel || '—'}
                </Badge>
                <span className="truncate text-[var(--text-secondary)]" title={li.text}>
                  {li.text.slice(0, 60)}{li.text.length > 60 ? '…' : ''}
                </span>
                <span className="ml-auto text-[var(--text-muted)] whitespace-nowrap">
                  {li.syllableCount}σ · {li.wordCount}w
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
