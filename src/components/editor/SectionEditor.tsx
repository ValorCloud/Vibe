import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { Section } from '../../types';
import { getSectionDotColor } from '../../utils/songUtils';
import { SectionHeader } from './SectionHeader';
import { SectionAdaptControl } from './SectionAdaptControl';
import { SectionLineList } from './SectionLineList';
import { SectionFooter } from './SectionFooter';
import { Check, Loader2 } from '../ui/icons';
import { Tooltip } from '../ui/Tooltip';
import { ReadAloudButton } from '../../features/voice/ReadAloudButton';
import { useTranslation } from '../../i18n';
import { useDragActions, useDragState } from '../../contexts/DragContext';
import { useDragHandlersContext } from '../../contexts/DragHandlersContext';
import { useComposerContext } from '../../contexts/ComposerContext';
import { useRhymeProxyContext } from '../../contexts/RhymeProxyContext';
import { useSongContext } from '../../contexts/SongContext';
import { useSongMutation } from '../../contexts/SongMutationContext';
import { isPureMetaLine } from '../../utils/metaUtils';
import { useRhymeSchemeMultiLang } from '../../hooks/useRhymeSchemeMultiLang';
import type { AdaptationLangId } from '../../i18n/constants';

interface SectionEditorProps {
  section: Section;
  sectionIndex: number;
  songLength: number;
  lineNumberOffset?: number;
  isAnalyzing: boolean;
  hasApiKey: boolean;
  isAdaptingLanguage?: boolean;
  sectionTargetLanguage?: AdaptationLangId;
  onSectionTargetLanguageChange?: (sectionId: string, lang: AdaptationLangId) => void;
  adaptSectionLanguage?: (sectionId: string, lang: AdaptationLangId) => void;
  adaptLineLanguage?: (sectionId: string, lineId: string, lang: AdaptationLangId) => void;
  adaptingLineIds?: Set<string>;
  playAudioFeedback: (type: 'click' | 'success' | 'error' | 'drag' | 'drop') => void;
  onLineBlur?: () => void;
}

export const SectionEditor = React.memo(function SectionEditor({
  section, sectionIndex, songLength,
  lineNumberOffset = 0,
  isAnalyzing, hasApiKey,
  isAdaptingLanguage = false,
  sectionTargetLanguage = 'adapt:EN' as AdaptationLangId,
  onSectionTargetLanguageChange,
  adaptSectionLanguage,
  adaptLineLanguage,
  adaptingLineIds,
  playAudioFeedback,
  onLineBlur,
}: SectionEditorProps) {
  const { t } = useTranslation();
  const { isGenerating, isRegeneratingSection, regenerateSection } = useComposerContext();
  const { handleDrop } = useDragHandlersContext();
  const { draggedItemIndex, dragOverIndex } = useDragState();
  const { setDragOverIndex } = useDragActions();
  const { isProxiedForSection } = useRhymeProxyContext();
  const { lineLanguages, rhymeScheme: globalRhymeScheme } = useSongContext();
  const { renameSectionWithRenumber, setSectionRhymeScheme } = useSongMutation();

  const sectionName: string = section.name ?? '';
  const committedRhyme: string = section.rhymeScheme || globalRhymeScheme;

  // Voice-friendly reading of this section: its name followed by the lyric
  // lines, skipping pure meta/instruction lines so only sung text is spoken.
  const sectionSpokenText = useMemo(() => {
    const body = section.lines
      .map(line => line.text ?? '')
      .filter(text => text.trim() && !isPureMetaLine(text))
      .join('. ');
    return [sectionName, body].filter(s => s.trim()).join('. ');
  }, [section.lines, sectionName]);

  const [pendingName, setPendingName] = useState<string>(sectionName);
  const [pendingRhyme, setPendingRhyme] = useState<string>(committedRhyme);
  const [pendingLang, setPendingLang] = useState<AdaptationLangId>(sectionTargetLanguage);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => { setPendingName(sectionName); }, [sectionName]);
  useEffect(() => { setPendingRhyme(committedRhyme); }, [committedRhyme]);
  useEffect(() => { setPendingLang(sectionTargetLanguage); }, [sectionTargetLanguage]);

  const isRegenSection = isRegeneratingSection(section.id);

  // Release local lock once ALL async operations for this section are done.
  // regenerateSection manages regeneratingSections (not isGenerating), so we
  // must watch isRegenSection in addition to isGenerating / isAdaptingLanguage.
  useEffect(() => {
    if (!isGenerating && !isAdaptingLanguage && !isRegenSection) {
      setIsApplying(false);
    }
  }, [isGenerating, isAdaptingLanguage, isRegenSection]);

  const hasLyrics = useMemo(
    () => section.lines.some(
      l => !(l.isMeta ?? isPureMetaLine(l.text)) && l.text.trim().length > 0,
    ),
    [section.lines],
  );

  const isDirty =
    pendingName !== sectionName ||
    pendingRhyme !== committedRhyme ||
    pendingLang !== sectionTargetLanguage;

  const langPending = pendingLang !== sectionTargetLanguage;
  const langApplyable = !langPending || (hasApiKey && hasLyrics);
  const canApply =
    isDirty &&
    !isGenerating &&
    !isAnalyzing &&
    !isAdaptingLanguage &&
    !isApplying &&
    langApplyable;

  const handleApply = useCallback(() => {
    if (!canApply) return;
    setIsApplying(true);

    const rhymeChanged = pendingRhyme !== committedRhyme;
    const nameChanged = pendingName !== sectionName;
    const langChanged = pendingLang !== sectionTargetLanguage;

    if (nameChanged) {
      renameSectionWithRenumber(section.id, pendingName);
    }

    if (rhymeChanged) {
      setSectionRhymeScheme(section.id, pendingRhyme);
    }

    // Track whether any async operation was actually dispatched
    let asyncDispatched = false;

    if (hasLyrics && (rhymeChanged || nameChanged)) {
      asyncDispatched = true;
      setTimeout(() => regenerateSection(section.id, { rhymeScheme: pendingRhyme }), 0);
    }

    if (langChanged) {
      onSectionTargetLanguageChange?.(section.id, pendingLang);
      if (adaptSectionLanguage) {
        asyncDispatched = true;
        adaptSectionLanguage(section.id, pendingLang);
      }
    }

    // No async op launched — reset immediately since no external state
    // will ever flip to trigger the cleanup useEffect.
    if (!asyncDispatched) {
      setIsApplying(false);
    }
  }, [
    canApply,
    pendingName, sectionName,
    pendingRhyme, committedRhyme,
    pendingLang, sectionTargetLanguage,
    section.id, hasLyrics,
    renameSectionWithRenumber, setSectionRhymeScheme, regenerateSection,
    onSectionTargetLanguageChange, adaptSectionLanguage,
  ]);

  const applyTooltip = !isDirty
    ? (t.editor?.applyNoChanges ?? 'No pending changes')
    : !langApplyable && !hasApiKey
      ? (t.tooltips?.aiUnavailable ?? 'AI unavailable — configure an API key')
      : !langApplyable && !hasLyrics
        ? (t.editor?.applyNoLyrics ?? 'No lyrics to adapt — add content first')
        : (t.editor?.applyPending ?? 'Apply all pending changes to this section');

  const isSectionDropTarget = dragOverIndex === sectionIndex && draggedItemIndex !== null && draggedItemIndex !== sectionIndex;

  // Bar visible whenever any async operation is in flight for this section
  const isProcessing = isGenerating || isApplying || isAdaptingLanguage || isRegenSection;

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (draggedItemIndex === null || draggedItemIndex === sectionIndex) return;
    setDragOverIndex(sectionIndex);
  }, [draggedItemIndex, sectionIndex, setDragOverIndex]);

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (dragOverIndex === sectionIndex) setDragOverIndex(null);
  }, [dragOverIndex, sectionIndex, setDragOverIndex]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    handleDrop(sectionIndex);
  }, [handleDrop, sectionIndex]);

  const isProxied = isProxiedForSection(section.id);

  // Stable digest used as a memo dep to detect per-line language changes even
  // when the lineLanguages object reference stays the same.
  const lineLanguagesDigest = section.lines.map(l => lineLanguages[l.id] ?? '').join('\x00');

  const multiLangLines = useMemo(
    () =>
      section.lines
        .filter(l => !(l.isMeta ?? isPureMetaLine(l.text)))
        .map(l => ({
          text: l.text,
          lang: lineLanguages[l.id] ?? sectionTargetLanguage,
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [section.lines, sectionTargetLanguage, lineLanguages, lineLanguagesDigest],
  );

  const schemeResult = useRhymeSchemeMultiLang(multiLangLines, isProxied, committedRhyme);

  const lineListOptional = {
    ...(adaptLineLanguage ? { adaptLineLanguage } : {}),
    ...(adaptingLineIds ? { adaptingLineIds } : {}),
    ...(onLineBlur ? { onLineBlur } : {}),
  };

  return (
    <section
      id={`section-${section.id}`}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`lcars-band w-full ${draggedItemIndex === sectionIndex ? 'opacity-50' : ''} ${isSectionDropTarget ? 'ring-2 ring-[var(--accent-color)]/60 ring-offset-2 ring-offset-transparent' : ''}`}
      style={{ overflow: 'visible' }}
    >
      <div
        className={`lcars-band-stripe ${getSectionDotColor(sectionName)}`}
        style={{ flexShrink: 0 }}
      />

      <div className="flex-1 pt-2.5 px-3.5 pb-2" style={{ minWidth: 0, width: '100%', overflow: 'visible' }}>

        <div className="mb-2 flex items-start justify-between gap-3 flex-wrap relative">
          {/* Indeterminate regeneration/adaptation progress bar — LTR sweep */}
          {isProcessing && (
            <div
              role="progressbar"
              aria-label="Processing section"
              aria-busy="true"
              className="absolute bottom-0 left-0 right-0 h-[2px] overflow-hidden rounded-full"
              style={{ background: 'oklch(from var(--lcars-cyan, #4fc3f7) l c h / 0.18)' }}
            >
              <div
                className="absolute inset-y-0 left-0 w-full h-full"
                style={{
                  background: 'linear-gradient(to right, var(--lcars-cyan, #4fc3f7) 60%, transparent 100%)',
                  animation: 'section-regen-slide 1.4s linear infinite',
                }}
              />
            </div>
          )}

          <SectionHeader
            section={section}
            sectionIndex={sectionIndex}
            songLength={songLength}
            pendingName={pendingName}
            pendingRhyme={pendingRhyme}
            onPendingNameChange={setPendingName}
            onPendingRhymeChange={setPendingRhyme}
          />

          <div className="flex items-center gap-2 flex-wrap">
            {adaptSectionLanguage && (
              <SectionAdaptControl
                sectionId={section.id}
                sectionTargetLanguage={sectionTargetLanguage}
                hasApiKey={hasApiKey}
                hasLyrics={hasLyrics}
                isGenerating={isGenerating}
                isAnalyzing={isAnalyzing}
                isAdaptingLanguage={isAdaptingLanguage}
                pendingLang={pendingLang}
                onPendingLangChange={setPendingLang}
                isDirty={isDirty}
                onApply={handleApply}
                adaptSectionLanguage={adaptSectionLanguage}
              />
            )}

            <Tooltip title={applyTooltip}>
              <button
                type="button"
                onClick={handleApply}
                disabled={!canApply}
                aria-label={applyTooltip}
                className={[
                  'flex items-center gap-1 px-2 py-0.5 rounded',
                  'text-[10px] font-semibold uppercase tracking-[0.15em]',
                  'border transition-colors duration-150',
                  canApply
                    ? 'border-[var(--lcars-cyan)]/60 text-[var(--lcars-cyan)] hover:bg-[var(--lcars-cyan)]/10 cursor-pointer'
                    : 'border-zinc-600/30 text-zinc-500 dark:text-zinc-600 cursor-not-allowed opacity-40',
                ].join(' ')}
              >
                {(isAdaptingLanguage || isApplying)
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <Check className="h-3 w-3" />}
                <span>{t.editor?.adaptApply ?? 'Apply'}</span>
              </button>
            </Tooltip>

            {sectionSpokenText.trim() && (
              <ReadAloudButton
                id={`section-${section.id}`}
                text={sectionSpokenText}
                label={t.tooltips?.readSection ?? 'Read this section aloud'}
                iconClassName="h-3.5 w-3.5"
                className="p-1"
              />
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 pl-1 pr-8 mb-1 select-none" aria-hidden="true">
          <span className="flex-shrink-0 w-6" />
          <span className="flex-shrink-0 w-3.5" />
          <span className="flex-1 min-w-0" />
          <span className="flex-shrink-0 w-16" />
          <span className="flex-shrink-0 w-[2.75rem] text-right text-[9px] font-semibold uppercase tracking-[0.15em] text-zinc-600 dark:text-zinc-400">
            {t.editor?.syllableCount ?? 'Count'}
          </span>
          <span className="flex-shrink-0 w-2" />
          <span className="flex-shrink-0 w-7 text-center text-[9px] font-semibold uppercase tracking-[0.15em] text-zinc-600 dark:text-zinc-400">
            {t.editor?.schemaHeader ?? 'Sch.'}
          </span>
        </div>

        <SectionLineList
          section={section}
          lineNumberOffset={lineNumberOffset}
          sectionTargetLanguage={sectionTargetLanguage}
          hasApiKey={hasApiKey}
          schemeResult={schemeResult}
          playAudioFeedback={playAudioFeedback}
          {...lineListOptional}
        />

        <SectionFooter
          sectionId={section.id}
          hasLyrics={hasLyrics}
          preInstructions={section.preInstructions ?? []}
          postInstructions={section.postInstructions ?? []}
          playAudioFeedback={playAudioFeedback}
          schemeResult={schemeResult}
        />
      </div>
    </section>
  );
});
