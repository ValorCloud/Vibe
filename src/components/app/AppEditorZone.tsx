/**
 * AppEditorZone
 * Renders the central content area: InsightsBar (conditional) + the scrollable
 * lyrics/musical/player zone.
 *
 * Props surface: 6 (isAnalyzing / isAdaptingLanguage / targetLanguage now
 * sourced from InsightsBarContext — no longer passed as props).
 *
 * Ribbon swap: InsightsBar (lyrics tab) ↔ MusicalInsightsBar (musical tab).
 * Player tab: full-height LCARS FUI player, no insights ribbon.
 */
import React, { Suspense, lazy } from 'react';
import { Spinner } from '@fluentui/react-components';
import { ErrorBoundary } from './ErrorBoundary';
import { InsightsBar } from './InsightsBar';
import { MusicalInsightsBar } from './MusicalInsightsBar';
import { LyricsView } from './LyricsView';
import { VoxNovaPlayer } from '../../features/player';
import { useAudioFeedback } from '../../hooks/useAudioFeedback';
import { useInsightsBarStateContext } from '../../contexts/InsightsBarContext';
import { useTranslation } from '../../i18n';
import type { AppTab } from '../../hooks/useUIState';

const MusicalTab = lazy(() =>
  import('./musical/MusicalTab').then(m => ({ default: m.MusicalTab }))
);

function LazyFallback() {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      aria-label={t.common?.loading ?? 'Loading'}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', width: '100%' }}
    >
      <Spinner size="small" />
    </div>
  );
}

type PlayAudioFeedback = ReturnType<typeof useAudioFeedback>['playAudioFeedback'];

interface AppEditorZoneProps {
  activeTab: AppTab;
  isMobileOrTablet: boolean;
  hasApiKey: boolean;
  songHasContent: boolean;
  playAudioFeedback: PlayAudioFeedback;
  canPasteLyrics: boolean;
  onOpenLibrary: () => void;
  onPasteLyrics: () => void;
}

export function AppEditorZone({
  activeTab,
  isMobileOrTablet,
  hasApiKey,
  songHasContent,
  playAudioFeedback,
  canPasteLyrics,
  onOpenLibrary,
  onPasteLyrics,
}: AppEditorZoneProps) {
  const { isAnalyzing, isAdaptingLanguage, targetLanguage } = useInsightsBarStateContext();

  // ── Player tab: full-height standalone layout, no ribbon ─────────────────────
  if (activeTab === 'player') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          height: '100%',
        }}
      >
        <ErrorBoundary label="Player">
          <VoxNovaPlayer />
        </ErrorBoundary>
      </div>
    );
  }

  return (
    <>
      {/* ── Ribbon contextuel : swap selon activeTab ────────────────────────── */}
      {activeTab === 'musical' ? (
        <ErrorBoundary label="Musical insights">
          <MusicalInsightsBar />
        </ErrorBoundary>
      ) : (
        songHasContent && (
          <ErrorBoundary label="Insights">
            <InsightsBar />
          </ErrorBoundary>
        )
      )}

      <div
        className={`flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar relative lcars-lyrics-area ${
          isMobileOrTablet ? 'p-2' : 'p-4 lg:p-8'
        }`}
        style={isMobileOrTablet ? { paddingBottom: 'calc(60px + var(--sab))' } : undefined}
      >
        <div className="lyrics-editor-zoom-wrapper">
          <div className="lyrics-editor-zoom">
            {activeTab === 'lyrics' ? (
              <ErrorBoundary label="Lyrics editor">
                <LyricsView
                  isAnalyzing={isAnalyzing}
                  isAdaptingLanguage={isAdaptingLanguage}
                  hasApiKey={hasApiKey}
                  playAudioFeedback={playAudioFeedback}
                  canPasteLyrics={canPasteLyrics}
                  targetLanguage={targetLanguage}
                  onOpenLibrary={onOpenLibrary}
                  onPasteLyrics={onPasteLyrics}
                />
              </ErrorBoundary>
            ) : (
              <ErrorBoundary label="Musical tab">
                <Suspense fallback={<LazyFallback />}>
                  <MusicalTab hasApiKey={hasApiKey} />
                </Suspense>
              </ErrorBoundary>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
