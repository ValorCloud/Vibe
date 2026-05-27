/**
 * Feature: Analysis
 * Barrel export — imports from this path are equivalent to direct imports.
 * Note: src/hooks/analysis/ sub-dir already exists — hooks inside it
 * are re-exported here for unified access.
 */
export { useSongAnalysis } from '../useSongAnalysis';
export { useSimilarityEngine } from '../useSimilarityEngine';
export { useLinguisticsWorker } from '../useLinguisticsWorker';
export { usePhoneticTranscription } from '../usePhoneticTranscription';
export { useRhymeSuggestions } from '../useRhymeSuggestions';
export { useRhymeSchemeMultiLang } from '../useRhymeSchemeMultiLang';
export { useAnalysisCounter } from '../useAnalysisCounter';
export { useAppKpis } from '../useAppKpis';
// Sub-folder hooks
export { usePasteImport } from './usePasteImport';
export { useBackgroundThemeAnalysis } from './useBackgroundThemeAnalysis';
export { useLanguageAdapter } from './useLanguageAdapter';
