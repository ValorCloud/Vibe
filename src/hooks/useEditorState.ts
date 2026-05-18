/**
 * useEditorState
 * Aggregates all context reads and derived state for AppEditorLayout.
 * Consumers receive a single stable object — no context calls needed in the layout.
 */
import { useCallback, useEffect } from 'react';
import { useAppStateContext } from '../contexts/AppStateContext';
import { useComposerContext } from '../contexts/ComposerContext';
import { useSongContext } from '../contexts/SongContext';
import { useAnalysisContext } from '../contexts/AnalysisContext';
import { useSimilarityContext } from '../contexts/SimilarityContext';
import { useMarkupEditor } from './useMarkupEditor';
import { useDerivedAppState } from './useDerivedAppState';
import { useLinguisticsWorker } from './useLinguisticsWorker';
import { useSpellCheck } from './composer/useSpellCheck';
import { useEditorPanelState } from './useEditorPanelState';

export function useEditorState() {
  // ── Song ────────────────────────────────────────────────────────────────
  const songCtx = useSongContext();

  // ── Composer ────────────────────────────────────────────────────────────
  const composerCtx = useComposerContext();

  // ── App state ───────────────────────────────────────────────────────────
  const { appState } = useAppStateContext();
  const { hasApiKey, editMode, markupText, markupTextareaRef, setEditMode, setMarkupText } = appState;

  // ── Analysis ────────────────────────────────────────────────────────────
  const analysisCtx = useAnalysisContext();

  // ── Similarity ──────────────────────────────────────────────────────────
  const { index: webSimilarityIndex, resetIndex: resetWebSimilarityIndex } = useSimilarityContext();

  // ── Markup editor ───────────────────────────────────────────────────────
  const { switchEditMode, scrollToSection: scrollToSectionFn } = useMarkupEditor({
    editMode,
    markupText,
    markupTextareaRef,
    setEditMode,
    setMarkupText,
    updateSongAndStructureWithHistory: songCtx.updateSongAndStructureWithHistory,
  });

  // ── Derived flags ───────────────────────────────────────────────────────
  const { hasRealLyricContent, webBadgeLabel } = useDerivedAppState({
    editMode,
    markupText,
    webSimilarityIndex,
  });

  // ── Off-thread phonological analysis (Web Worker) ───────────────────────
  const linguisticsWorker = useLinguisticsWorker(songCtx.song, songCtx.songLanguage);

  // ── Spell-check ─────────────────────────────────────────────────────────
  const spellCheck = useSpellCheck({
    song: songCtx.song,
    songLanguage: songCtx.songLanguage,
    hasApiKey,
    selectedLineId: composerCtx.selectedLineId,
    updateState: songCtx.updateState,
  });

  // Trigger spell-check automatically when a line is selected
  useEffect(() => {
    if (composerCtx.selectedLineId && hasApiKey) {
      spellCheck.checkSpelling(composerCtx.selectedLineId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composerCtx.selectedLineId, hasApiKey]);

  // ── Derived panel visibility — single source of truth via useEditorPanelState
  const { isSuggestionsOpen } = useEditorPanelState();

  return {
    // Song
    song: songCtx.song,
    structure: songCtx.structure,
    rhymeScheme: songCtx.rhymeScheme,
    title: songCtx.title,
    setTitle: songCtx.setTitle,
    setTitleOrigin: songCtx.setTitleOrigin,
    titleOrigin: songCtx.titleOrigin,
    topic: songCtx.topic,
    setTopic: songCtx.setTopic,
    mood: songCtx.mood,
    setMood: songCtx.setMood,
    setRhymeScheme: songCtx.setRhymeScheme,
    targetSyllables: songCtx.targetSyllables,
    setTargetSyllables: songCtx.setTargetSyllables,
    updateSongAndStructureWithHistory: songCtx.updateSongAndStructureWithHistory,
    updateState: songCtx.updateState,
    replaceStateWithoutHistory: songCtx.replaceStateWithoutHistory,
    navigateWithHistory: songCtx.navigateWithHistory,
    clearHistory: songCtx.clearHistory,
    songLanguage: songCtx.songLanguage,
    setSongLanguage: songCtx.setSongLanguage,
    // Composer
    selectedLineId: composerCtx.selectedLineId,
    setSelectedLineId: composerCtx.setSelectedLineId,
    suggestions: composerCtx.suggestions,
    isSuggesting: composerCtx.isSuggesting,
    generateSong: composerCtx.generateSong,
    generateSuggestions: composerCtx.generateSuggestions,
    applySuggestion: composerCtx.applySuggestion,
    clearSelection: composerCtx.clearSelection,
    // App state (flat — only what JSX consumes)
    appState,
    hasApiKey,
    editMode,
    markupText,
    markupTextareaRef,
    // Analysis
    canPasteLyrics: analysisCtx.canPasteLyrics,
    pastedText: analysisCtx.pastedText,
    setPastedText: analysisCtx.setPastedText,
    isAnalyzing: analysisCtx.isAnalyzing,
    isAdaptingLanguage: analysisCtx.isAdaptingLanguage,
    isDetectingLanguage: analysisCtx.isDetectingLanguage,
    targetLanguage: analysisCtx.targetLanguage,
    setTargetLanguage: analysisCtx.setTargetLanguage,
    sectionTargetLanguages: analysisCtx.sectionTargetLanguages,
    setSectionTargetLanguages: analysisCtx.setSectionTargetLanguages,
    adaptSongLanguage: analysisCtx.adaptSongLanguage,
    detectLanguage: analysisCtx.detectLanguage,
    analyzeCurrentSong: analysisCtx.analyzeCurrentSong,
    adaptationProgress: analysisCtx.adaptationProgress,
    adaptationResult: analysisCtx.adaptationResult,
    // Similarity
    webSimilarityIndex,
    resetWebSimilarityIndex,
    // Markup
    switchEditMode,
    scrollToSectionFn,
    // Derived
    hasRealLyricContent,
    webBadgeLabel,
    isSuggestionsOpen,
    // Linguistics
    linguisticsWorker,
    // Spell-check
    spellCheck,
  };
}
