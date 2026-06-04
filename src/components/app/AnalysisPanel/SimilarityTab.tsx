/**
 * SimilarityTab — Pairwise similarity matrix
 */
import { Text, Badge, ProgressBar } from '@fluentui/react-components';
import { EmptyState, rhymeTypeColor } from './MicroComponents';
import type { SimilarityPair } from '../../../lib/workers/linguistics.types';

export function SimilarityTab({ pairs }: { pairs: SimilarityPair[] }) {
  if (pairs.length === 0) {
    return <EmptyState message="No similarity pairs found." />;
  }

  return (
    <div className="flex flex-col gap-1">
      {/* size={200} = Fluent SM ≈ 12px — minimum floor */}
      <Text size={200} className="text-[var(--text-muted)] mb-1">
        Top {Math.min(pairs.length, 30)} pairs by phonological similarity
      </Text>
      {pairs.slice(0, 30).map((pair) => (
        <div
          key={`${pair.lineIdA}-${pair.lineIdB}`}
          className="rounded border border-[var(--border-color)] p-2 bg-[var(--bg-sidebar)]"
        >
          <div className="flex items-center gap-2 mb-1">
            <Badge appearance="filled" color={rhymeTypeColor(pair.rhymeType)} size="small">
              {pair.rhymeType}
            </Badge>
            <span className="text-xs font-mono text-[var(--lcars-amber)]">
              {(pair.score * 100).toFixed(0)}%
            </span>
            <ProgressBar
              value={pair.score}
              max={1}
              thickness="large"
              className="flex-1"
              color={pair.score >= 0.85 ? 'success' : pair.score >= 0.6 ? 'warning' : 'brand'}
            />
          </div>
          <div className="text-xs font-mono space-y-0.5">
            <div className="truncate text-[var(--text-secondary)]" title={pair.textA}>
              <span className="text-[var(--text-muted)] mr-1">A:</span>{pair.textA.slice(0, 50)}
            </div>
            <div className="truncate text-[var(--text-secondary)]" title={pair.textB}>
              <span className="text-[var(--text-muted)] mr-1">B:</span>{pair.textB.slice(0, 50)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
