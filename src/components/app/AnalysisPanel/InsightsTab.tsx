/**
 * InsightsTab — KPI overview (syllables, words, chars per section)
 */
import { Divider } from '@fluentui/react-components';
import { KpiCard, SectionInsightCard, EmptyState } from './MicroComponents';
import type { SectionInsight } from '../../../lib/workers/linguistics.types';

export function InsightsTab({ sections }: { sections: SectionInsight[] }) {
  if (sections.length === 0) {
    return <EmptyState message="No sections to analyse." />;
  }

  const totalLines = sections.reduce((s, sec) => s + sec.lineInsights.length, 0);
  const totalSyllables = sections.reduce((s, sec) => s + sec.totalSyllables, 0);
  const totalWords = sections.reduce((s, sec) => s + sec.totalWords, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        <KpiCard label="Lines" value={totalLines} />
        <KpiCard label="Syllables" value={totalSyllables} />
        <KpiCard label="Words" value={totalWords} />
      </div>
      <Divider />
      {sections.map(sec => (
        <SectionInsightCard key={sec.sectionId} section={sec} />
      ))}
    </div>
  );
}
