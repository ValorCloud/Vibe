/**
 * Skeleton loading components for AnalysisPanel tabs.
 * Mirrors the layout of actual content to prevent layout shift.
 */
import { Divider } from '@fluentui/react-components';

// ─── Skeleton primitives ─────────────────────────────────────────────

export function SkeletonBar({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded animate-pulse bg-black/[0.06] dark:bg-white/[0.06] ${className}`}
      aria-hidden="true"
    />
  );
}

function KpiCardSkeleton() {
  return (
    <div className="rounded-lg border border-[var(--border-color)] p-2 bg-[var(--bg-sidebar)] text-center space-y-1.5">
      <SkeletonBar className="h-6 w-10 mx-auto" />
      <SkeletonBar className="h-3 w-14 mx-auto" />
    </div>
  );
}

function SectionCardSkeleton() {
  return (
    <div className="rounded-lg border border-[var(--border-color)] p-3 bg-[var(--bg-sidebar)] space-y-2">
      <div className="flex items-center justify-between">
        <SkeletonBar className="h-3.5 w-28" />
        <SkeletonBar className="h-3 w-12" />
      </div>
      <div className="grid grid-cols-3 gap-1">
        <SkeletonBar className="h-8 rounded" />
        <SkeletonBar className="h-8 rounded" />
        <SkeletonBar className="h-8 rounded" />
      </div>
    </div>
  );
}

/** Mirrors InsightsTab layout: 3 KPI cards + divider + 2 section cards. */
export function InsightsTabSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Computing analysis">
      <div className="grid grid-cols-3 gap-2">
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
      </div>
      <Divider />
      <SectionCardSkeleton />
      <SectionCardSkeleton />
    </div>
  );
}

/** Mirrors AnalysisTab layout: section header + density bars + badge row + line list. */
export function AnalysisTabSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Computing analysis">
      {[0, 1].map(i => (
        <div key={i} className="rounded-lg border border-[var(--border-color)] p-3 bg-[var(--bg-sidebar)] space-y-2">
          {/* section name */}
          <SkeletonBar className="h-3.5 w-24" />
          {/* schema row */}
          <div className="flex items-center gap-2">
            <SkeletonBar className="h-3 w-16" />
            <SkeletonBar className="h-5 w-10 rounded-full" />
          </div>
          {/* density bars */}
          <SkeletonBar className="h-2.5 w-full rounded-full" />
          <SkeletonBar className="h-2.5 w-4/5 rounded-full" />
          {/* badge row */}
          <div className="flex gap-1.5">
            <SkeletonBar className="h-5 w-14 rounded-full" />
            <SkeletonBar className="h-5 w-16 rounded-full" />
          </div>
          {/* line rows */}
          <SkeletonBar className="h-4 w-full" />
          <SkeletonBar className="h-4 w-11/12" />
          <SkeletonBar className="h-4 w-4/5" />
        </div>
      ))}
    </div>
  );
}

/** Mirrors SimilarityTab layout: header label + pair cards with progress bar. */
export function SimilarityTabSkeleton() {
  return (
    <div className="flex flex-col gap-1" aria-busy="true" aria-label="Computing similarity">
      <SkeletonBar className="h-3 w-40 mb-2" />
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="rounded border border-[var(--border-color)] p-2 bg-[var(--bg-sidebar)] space-y-1.5">
          <div className="flex items-center gap-2">
            <SkeletonBar className="h-5 w-16 rounded-full" />
            <SkeletonBar className="h-3 w-8" />
            <SkeletonBar className="h-2.5 flex-1 rounded-full" />
          </div>
          <SkeletonBar className="h-3 w-full" />
          <SkeletonBar className="h-3 w-10/12" />
        </div>
      ))}
    </div>
  );
}
