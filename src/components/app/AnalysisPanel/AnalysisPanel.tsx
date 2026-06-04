/**
 * AnalysisPanel — Async phonological analysis sidebar (Star Trek FUI × Fluent 2).
 *
 * Three tabs:
 *   Insights  — KPI overview (syllables, words, chars per section)
 *   Analysis  — Rhyme schema detection, assonance/alliteration density
 *   Similarity — Pairwise similarity matrix
 *
 * Architecture invariant (docs_fusion_optimal.md):
 *   All heavy computation runs in a Web Worker. This component is a pure
 *   observer of the worker's output — it NEVER mutates song state or
 *   participates in the UNDO/REDO stack.
 *
 * Animation:
 *   AnimatePresence is mounted in AppEditorLayout (the parent), not here.
 *   This motion.div handles enter/exit animations driven by the parent's
 *   AnimatePresence. Do NOT re-wrap in AnimatePresence locally.
 */
import React, { useState } from 'react';
import {
  TabList,
  Tab,
  ProgressBar,
  Spinner,
  Text,
} from '@fluentui/react-components';
import {
  DataBarVertical24Regular,
  TextGrammarWand24Regular,
  ArrowSwap24Regular,
} from '@fluentui/react-icons';
import { X } from '../../ui/icons';
import { motion } from 'motion/react';
import type { SelectTabData, SelectTabEventHandler } from '@fluentui/react-components';
import type { AnalysisResult } from '../../../lib/workers/linguistics.types';
import { InsightsTab } from './InsightsTab';
import { AnalysisTab } from './AnalysisTab';
import { SimilarityTab } from './SimilarityTab';
import { InsightsTabSkeleton, AnalysisTabSkeleton, SimilarityTabSkeleton } from './SkeletonComponents';

// Panel width — ~25% larger than original 280
const PANEL_WIDTH = 350;

// ─── Tab content renderer ─────────────────────────────────────────────
// Single decision point per tab: skeleton → content → empty (never mixed).

function TabContent({
  tab,
  showSkeleton,
  result,
}: {
  tab: string;
  showSkeleton: boolean;
  result: AnalysisResult | null;
}) {
  if (tab === 'insights') {
    if (showSkeleton) return <InsightsTabSkeleton />;
    return <InsightsTab sections={result?.sections ?? []} />;
  }
  if (tab === 'analysis') {
    if (showSkeleton) return <AnalysisTabSkeleton />;
    return <AnalysisTab sections={result?.sections ?? []} />;
  }
  if (tab === 'similarity') {
    if (showSkeleton) return <SimilarityTabSkeleton />;
    return <SimilarityTab pairs={result?.similarityPairs ?? []} />;
  }
  return null;
}

// ─── Main panel component ──────────────────────────────────────────────

interface AnalysisPanelProps {
  result: AnalysisResult | null;
  isComputing: boolean;
  error: string | null;
  onClose: () => void;
  isMobileOverlay?: boolean;
}

export const AnalysisPanel = React.memo(function AnalysisPanel({
  result,
  isComputing,
  error,
  onClose,
  isMobileOverlay,
}: AnalysisPanelProps) {
  const [selectedTab, setSelectedTab] = useState<string>('insights');

  const handleTabSelect: SelectTabEventHandler = (_event, data: SelectTabData) => {
    setSelectedTab(data.value as string);
  };

  // Skeleton only on first computation (no prior result available).
  // Recomputations keep previous result visible + ProgressBar/Spinner in header.
  const showSkeleton = isComputing && result === null;

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: isMobileOverlay ? '100%' : PANEL_WIDTH, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className={`flex flex-col z-50 shadow-2xl lcars-panel${
        isMobileOverlay ? ' structure-sidebar-mobile-overlay' : ''
      }`}
      style={{ overflow: 'hidden', position: 'relative' }}
    >
      <div
        className="flex flex-col h-full overflow-hidden"
        style={{ width: isMobileOverlay ? '100%' : PANEL_WIDTH, minWidth: isMobileOverlay ? undefined : PANEL_WIDTH }}
      >
        {/* Header — LCARS standard h-16 */}
        <div
          className="h-16 px-5 flex items-center justify-between shrink-0"
          style={{ position: 'relative', borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.08))' }}
        >
          {/* Accent rail */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: 'var(--accent-rail-thickness, 2px)',
            background: 'var(--accent-rail-gradient-h-rev)',
            opacity: 0.85, pointerEvents: 'none', zIndex: 1,
          }} />
          <div className="flex items-center gap-3">
            <DataBarVertical24Regular className="text-[var(--lcars-amber)] w-4 h-4" />
            {/* text-xs = 12px — was text-[10px] (below floor) */}
            <span className="text-xs uppercase tracking-widest text-[var(--text-secondary)] font-semibold">
              Phonologic Analysis
            </span>
            {isComputing && <Spinner size="tiny" />}
          </div>
          <button
            onClick={onClose}
            aria-label="Close phonologic analysis panel"
            className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Computing progress bar */}
        {isComputing && (
          <ProgressBar thickness="medium" className="w-full shrink-0" />
        )}

        {/* Tab navigation */}
        <TabList
          selectedValue={selectedTab}
          onTabSelect={handleTabSelect}
          size="small"
          className="px-3 pt-1 shrink-0"
        >
          <Tab value="insights" icon={<DataBarVertical24Regular />}>Insights</Tab>
          <Tab value="analysis" icon={<TextGrammarWand24Regular />}>Analysis</Tab>
          <Tab value="similarity" icon={<ArrowSwap24Regular />}>Similarity</Tab>
        </TabList>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
          {error && (
            <div className="rounded-lg border border-[var(--accent-error)]/30 bg-[var(--accent-error)]/10 p-2 mb-3">
              <Text size={200} className="text-[var(--accent-error)]">{error}</Text>
            </div>
          )}
          {result && result.computeTimeMs > 0 && (
            <div className="text-right mb-2">
              {/* text-xs = 12px — was size={100} ≈ 10px */}
              <Text size={200} className="text-[var(--text-muted)] font-mono">
                ⚡ {result.computeTimeMs.toFixed(0)}ms
              </Text>
            </div>
          )}
          <TabContent tab={selectedTab} showSkeleton={showSkeleton} result={result} />
        </div>
      </div>
    </motion.div>
  );
});
