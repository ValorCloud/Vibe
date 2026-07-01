import React, { useCallback, useMemo } from 'react';
import { getLanguageDisplay, SUPPORTED_ADAPTATION_LANGUAGES } from '../../i18n';
import { useSongContext } from '../../contexts/SongContext';
import { useComposerContext } from '../../contexts/ComposerContext';
import {
  useInsightsBarActionsContext,
  useInsightsBarStateContext,
} from '../../contexts/InsightsBarContext';
import { AdaptationProgressBanner } from './AdaptationProgressBanner';
import {
  InsightsBarLayout,
  InsightsActions,
  MetronomeButton,
  MobileKpis,
  TranslateGroup,
  ViewModeSelector,
  useAdaptationBannerVisibility,
} from './insights';
import { DetectLanguageButton } from './insights/DetectLanguageButton';
import { useTranslationAdaptationContext } from '../../contexts/TranslationAdaptationContext';

export const InsightsBar = React.memo(function InsightsBar() {
  const { song, songLanguage, setSongLanguage, detectedLanguages } = useSongContext();

  const hasLyrics = song.some(s => s.lines.some(l => !l.isMeta && l.text.trim().length > 0));

  // Resolve aiName strings from detectedLanguages to canonical langIds before
  // calling getLanguageDisplay, avoiding the LEGACY_INDEX ambiguity between
  // ui: and adapt: entries that share the same normalised aiName/label.
  const detectedDisplays = useMemo(() => (
    (detectedLanguages.length > 0 ? detectedLanguages : (songLanguage ? [songLanguage] : []))
      .filter((lang, i, arr) => arr.indexOf(lang) === i)
      .slice(0, 3)
      .map(lang => {
        const match = SUPPORTED_ADAPTATION_LANGUAGES.find(
          l => l.aiName.toLowerCase() === lang.toLowerCase(),
        );
        return getLanguageDisplay(match?.langId ?? lang);
      })
  ), [detectedLanguages, songLanguage]);

  /**
   * Fix #5 — memoized: the find() only re-runs when songLanguage changes.
   * Returns the canonical langId (e.g. "adapt:FR") for DetectLanguageButton's
   * checkmark display. Using langId instead of bare code prevents LEGACY_INDEX
   * collisions between ui: and adapt: namespaces.
   */
  const songLanguageCode = useMemo(() => {
    if (!songLanguage) return undefined;
    const match = SUPPORTED_ADAPTATION_LANGUAGES.find(
      l => l.aiName.toLowerCase() === songLanguage.toLowerCase(),
    );
    return match ? match.langId : undefined;
  }, [songLanguage]);

  /**
   * Fix #5 — memoized: the find() only re-runs when setSongLanguage identity
   * changes (stable context ref — effectively once per mount).
   * Receives lang.code (e.g. "SA") and resolves to aiName (e.g. "Sanskrit")
   * that useAiGeneration expects in its prompt.
   */
  const handleSetDefaultLanguage = useCallback((langCode: string) => {
    const match = SUPPORTED_ADAPTATION_LANGUAGES.find(
      l => l.code.toLowerCase() === langCode.toLowerCase(),
    );
    const aiName = match?.aiName ?? langCode;
    setSongLanguage(aiName);
  }, [setSongLanguage]);

  /**
   * exactOptionalPropertyTypes guard: DetectLanguageButton declares
   * defaultLanguage as `?: string`. Same rationale as above.
   */
  const defaultLanguageOptional = songLanguageCode !== undefined
    ? { defaultLanguage: songLanguageCode }
    : {};

  return (
    <InsightsBarLayout
      viewSelector={<InsightsViewModeSelector />}
      detectControl={
        <InsightsDetectLanguageButton
          detectedDisplays={detectedDisplays}
          hasLyrics={hasLyrics}
          onSetDefaultLanguage={handleSetDefaultLanguage}
          {...defaultLanguageOptional}
        />
      }
      translationControls={<InsightsTranslateGroup song={song} />}
      metronomeControl={<InsightsMetronomeButton />}
      insightsActions={<InsightsActionsControl hasLyrics={hasLyrics} detectedDisplays={detectedDisplays} />}
      mobileKpis={<MobileKpis />}
      banner={<InsightsAdaptationBanner />}
    />
  );
});

function InsightsViewModeSelector() {
  const { editMode, switchEditMode } = useInsightsBarActionsContext();
  const { isAnalyzing } = useInsightsBarStateContext();
  const { isGenerating } = useComposerContext();

  return (
    <ViewModeSelector
      editMode={editMode}
      switchEditMode={switchEditMode}
      disabled={isGenerating || isAnalyzing}
    />
  );
}

type LanguageDisplay = ReturnType<typeof getLanguageDisplay>;

interface InsightsDetectLanguageButtonProps {
  detectedDisplays: LanguageDisplay[];
  hasLyrics: boolean;
  onSetDefaultLanguage: (langCode: string) => void;
  defaultLanguage?: string;
}

function InsightsDetectLanguageButton({
  detectedDisplays,
  hasLyrics,
  onSetDefaultLanguage,
  defaultLanguage,
}: InsightsDetectLanguageButtonProps) {
  const { detectLanguage } = useInsightsBarActionsContext();
  const { isDetectingLanguage, hasApiKey } = useInsightsBarStateContext();

  const defaultLanguageOptional = defaultLanguage !== undefined
    ? { defaultLanguage }
    : {};

  return (
    <DetectLanguageButton
      detectedDisplays={detectedDisplays}
      hasLyrics={hasLyrics}
      isDetectingLanguage={isDetectingLanguage}
      onDetect={detectLanguage}
      hasApiKey={hasApiKey}
      onSetDefaultLanguage={onSetDefaultLanguage}
      {...defaultLanguageOptional}
    />
  );
}

interface InsightsTranslateGroupProps {
  song: ReturnType<typeof useSongContext>['song'];
}

function InsightsTranslateGroup({ song }: InsightsTranslateGroupProps) {
  const { setTargetLanguage, adaptSongLanguage } = useInsightsBarActionsContext();
  const { targetLanguage, isAdaptingLanguage, hasApiKey } = useInsightsBarStateContext();
  const { showTranslationFeatures } = useTranslationAdaptationContext();

  return (
    <TranslateGroup
      targetLanguage={targetLanguage}
      setTargetLanguage={setTargetLanguage}
      isAdaptingLanguage={isAdaptingLanguage}
      song={song}
      adaptSongLanguage={adaptSongLanguage}
      showTranslationFeatures={showTranslationFeatures}
      hasApiKey={hasApiKey}
    />
  );
}

function InsightsMetronomeButton() {
  return <MetronomeButton />;
}

interface InsightsActionsControlProps {
  hasLyrics: boolean;
  detectedDisplays: LanguageDisplay[];
}

function InsightsActionsControl({ hasLyrics, detectedDisplays }: InsightsActionsControlProps) {
  const {
    analyzeCurrentSong,
    setIsSimilarityModalOpen,
    onOpenSearch,
    onToggleAnalysisPanel,
  } = useInsightsBarActionsContext();
  const {
    isAnalyzing,
    webBadgeLabel,
    libraryCount,
    hasApiKey,
    isAnalysisPanelOpen,
  } = useInsightsBarStateContext();
  const { isGenerating } = useComposerContext();

  return (
    <InsightsActions
      webBadgeLabel={webBadgeLabel}
      libraryCount={libraryCount}
      isAnalyzing={isAnalyzing}
      isGenerating={isGenerating}
      hasLyrics={hasLyrics}
      detectedDisplays={detectedDisplays}
      analyzeCurrentSong={analyzeCurrentSong}
      setIsSimilarityModalOpen={setIsSimilarityModalOpen}
      hasApiKey={hasApiKey}
      onOpenSearch={onOpenSearch}
      onToggleAnalysisPanel={onToggleAnalysisPanel}
      isAnalysisPanelOpen={isAnalysisPanelOpen}
    />
  );
}

function InsightsAdaptationBanner() {
  const { adaptationProgress, adaptationResult } = useInsightsBarStateContext();
  const { showBanner, dismissBanner } = useAdaptationBannerVisibility(adaptationProgress);

  return showBanner && adaptationProgress
    ? (
        <AdaptationProgressBanner
          progress={adaptationProgress}
          result={adaptationResult ?? null}
          onDismiss={dismissBanner}
          isOverlay
        />
      )
    : null;
}
