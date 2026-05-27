import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { Section } from '../../types';
import { AI_MODEL_NAME, getAi, safeJsonParse, handleApiError } from '../../utils/aiUtils';
import { cleanSectionName } from '../../utils/songUtils';
import { generateId } from '../../utils/idUtils';
import { mapSongWithPreservedIds, mergeAiSectionIntoCurrent, syncLinkedChorusSections } from '../../utils/songMergeUtils';
import { makeSongUpdater } from '../hookUtils';
import { withAbort, isAbortError } from '../../utils/withAbort';
import { withRetry } from '../../utils/withRetry';
import { buildRhymeConstrainedPrompt } from '../../utils/promptUtils';
import { resolveUiLanguageName } from '../../utils/uiLangUtils';
import {
  UNTRUSTED_INPUT_PREAMBLE,
  fence,
  fenceLong,
  sanitizeForPrompt,
} from '../../utils/promptSanitization';
import { logger } from '../../utils/logger';
import {
  SongResponseSchema,
  type SongResponse,
  alignGeneratedSongToStructure,
  flagMetaLines,
  buildExclusiveLanguageInstruction,
  META_INSTRUCTION_HINT,
  RHYME_ENFORCEMENT_RULES,
  GENERATION_SCHEMA,
} from './useAiGeneration.parsers';


type UseAiGenerationParams = {
  song: Section[];
  structure: string[];
  topic: string;
  mood: string;
  rhymeScheme: string;
  targetSyllables: number;
  title: string;
  songLanguage: string;
  uiLanguage: string;
  updateState: (
    recipe: (current: { song: Section[]; structure: string[] }) => { song: Section[]; structure: string[] },
  ) => void;
  updateSongWithHistory: (newSong: Section[]) => void;
  updateSongAndStructureWithHistory: (newSong: Section[], newStructure: string[]) => void;
  requestAutoTitleGeneration: () => void;
  setSelectedLineId: (id: string | null) => void;
};

export const useAiGeneration = ({
  song,
  structure,
  topic,
  mood,
  rhymeScheme,
  targetSyllables,
  title,
  songLanguage,
  uiLanguage,
  updateState,
  updateSongWithHistory,
  updateSongAndStructureWithHistory,
  requestAutoTitleGeneration,
  setSelectedLineId,
}: UseAiGenerationParams) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [regeneratingSections, setRegeneratingSections] = useState<Set<string>>(new Set());
  const resolvedUiLanguage = resolveUiLanguageName(uiLanguage);

  // Always-fresh refs — readable inside any useCallback without stale closure risk
  const latestSongRef = useRef(song);
  const latestTargetSyllablesRef = useRef(targetSyllables);
  const latestRhymeSchemeRef = useRef(rhymeScheme);
  const latestTitleRef = useRef(title);
  const latestTopicRef = useRef(topic);
  const latestMoodRef = useRef(mood);
  const latestSongLanguageRef = useRef(songLanguage);
  const latestResolvedUiLanguageRef = useRef(resolvedUiLanguage);

  useEffect(() => { latestSongRef.current = song; }, [song]);
  useEffect(() => { latestTargetSyllablesRef.current = targetSyllables; }, [targetSyllables]);
  useEffect(() => { latestRhymeSchemeRef.current = rhymeScheme; }, [rhymeScheme]);
  useEffect(() => { latestTitleRef.current = title; }, [title]);
  useEffect(() => { latestTopicRef.current = topic; }, [topic]);
  useEffect(() => { latestMoodRef.current = mood; }, [mood]);
  useEffect(() => { latestSongLanguageRef.current = songLanguage; }, [songLanguage]);
  useEffect(() => { latestResolvedUiLanguageRef.current = resolvedUiLanguage; }, [resolvedUiLanguage]);

  const generateAbortRef = useRef<AbortController | null>(null);
  const regenAbortRefs = useRef<Map<string, AbortController>>(new Map());

  useEffect(() => {
    const genRef = generateAbortRef;
    const regenRefs = regenAbortRefs;
    return () => {
      genRef.current?.abort();
      regenRefs.current.forEach(ctrl => ctrl.abort());
      regenRefs.current.clear();
    };
  }, []);

  const isRegeneratingSection = useCallback(
    (sectionId: string) => regeneratingSections.has(sectionId),
    [regeneratingSections],
  );

  const updateSong = useMemo(() => makeSongUpdater(updateState), [updateState]);

  const generateSong = useCallback(async () => {
    setIsGenerating(true);
    try {
      await withAbort(generateAbortRef, async (signal) => {
        const lang = sanitizeForPrompt(latestSongLanguageRef.current || 'English', { maxLength: 64 });
        const exclusiveLanguageInstruction = buildExclusiveLanguageInstruction(latestSongLanguageRef.current);
        const safeStructure = structure.map(s => sanitizeForPrompt(s, { maxLength: 64 })).join(', ');
        const safeRhymeScheme = sanitizeForPrompt(latestRhymeSchemeRef.current, { maxLength: 64 });
        const safeUiLang = sanitizeForPrompt(latestResolvedUiLanguageRef.current, { maxLength: 64 });
        const prompt =
`${UNTRUSTED_INPUT_PREAMBLE}

Write a song based on the following untrusted user-supplied brief:
${fence('TOPIC', latestTopicRef.current)}
${fence('MOOD', latestMoodRef.current)}
Default Rhyme Scheme: ${safeRhymeScheme}
Target Syllables per line: ${latestTargetSyllablesRef.current}
Structure: ${safeStructure}

IMPORTANT: Write ALL lyrics in ${lang}. You MUST follow the provided structure EXACTLY.
${exclusiveLanguageInstruction ? `${exclusiveLanguageInstruction}\n` : ''}Generate exactly the sections listed in the Structure field, in that specific order.

${RHYME_ENFORCEMENT_RULES}

${META_INSTRUCTION_HINT}

Line counts for sections:
- Intro: 4 lines
- Verse: 6 lines
- Chorus: 4 lines
- Bridge: 6 lines
- Outro: 4 lines

For each section, provide a rhyme scheme (e.g., AABB, ABAB, ABCB, AAAA, AAABBB, AABBCC, ABABAB, ABCABC, AABCCB, or FREE).
For each line, provide the lyric text (in ${lang}), the rhyming syllables, the rhyme identifier, the exact syllable count, and a short core concept (in ${safeUiLang}).`;

        const response = await withRetry(() =>
          getAi().models.generateContent({
            model: AI_MODEL_NAME,
            contents: prompt,
            config: { responseMimeType: 'application/json', responseSchema: GENERATION_SCHEMA },
            signal,
          })
        );

        const currentRhymeScheme = latestRhymeSchemeRef.current;
        const data = safeJsonParse<SongResponse>(response.text || '[]', [], SongResponseSchema);
        const songWithIds = data.map((section) => ({
          ...section,
          name: cleanSectionName(section.name),
          id: generateId(),
          rhymeScheme: section.rhymeScheme || currentRhymeScheme,
          lines: flagMetaLines(section.lines).map((line) => ({ ...line, id: generateId() })),
        }));
        const orderedSong = syncLinkedChorusSections(
          alignGeneratedSongToStructure(songWithIds, structure, currentRhymeScheme),
        );
        updateSongAndStructureWithHistory(orderedSong, structure);
        requestAutoTitleGeneration();
        setSelectedLineId(null);
      });
    } catch (error: unknown) {
      if (isAbortError(error)) return;
      handleApiError(error, 'Failed to generate song. Please try again.');
    } finally {
      if (!generateAbortRef.current?.signal.aborted) setIsGenerating(false);
    }
  }, [
    structure,
    updateSongAndStructureWithHistory, requestAutoTitleGeneration, setSelectedLineId,
  ]);

  const regenerateSection = useCallback(async (sectionId: string, overrides?: { rhymeScheme?: string }) => {
    const currentSong = latestSongRef.current;
    const sectionToRegenerate = currentSong.find(s => s.id === sectionId);
    if (!sectionToRegenerate) return;

    // Override wins > section-level scheme > global scheme (all read from latest refs)
    const effectiveRhymeScheme =
      overrides?.rhymeScheme ??
      sectionToRegenerate.rhymeScheme ??
      latestRhymeSchemeRef.current;

    setRegeneratingSections(prev => new Set(prev).add(sectionId));

    const ctrl = new AbortController();
    regenAbortRefs.current.get(sectionId)?.abort();
    regenAbortRefs.current.set(sectionId, ctrl);

    try {
      const sectionIndex = currentSong.findIndex(s => s.id === sectionId);
      const prevSection = sectionIndex > 0 ? currentSong[sectionIndex - 1] : null;
      const nextSection = sectionIndex < currentSong.length - 1 ? currentSong[sectionIndex + 1] : null;

      let lineCountPrompt = '';
      const lowerName = sectionToRegenerate.name.toLowerCase();
      if (lowerName.includes('intro')) lineCountPrompt = 'The section should have exactly 4 lines.';
      else if (lowerName.includes('verse')) lineCountPrompt = 'The section should have exactly 6 lines.';
      else if (lowerName.includes('chorus')) lineCountPrompt = 'The section should have exactly 4 lines.';
      else if (lowerName.includes('bridge')) lineCountPrompt = 'The section should have exactly 6 lines.';
      else if (lowerName.includes('outro')) lineCountPrompt = 'The section should have exactly 4 lines.';

      const songStructure = currentSong.map(s => sanitizeForPrompt(s.name, { maxLength: 64 })).join(' → ');
      const lang = sanitizeForPrompt(latestSongLanguageRef.current || 'English', { maxLength: 64 });
      const safeUiLang = sanitizeForPrompt(latestResolvedUiLanguageRef.current, { maxLength: 64 });
      const exclusiveLanguageInstruction = buildExclusiveLanguageInstruction(latestSongLanguageRef.current);
      const formatSectionLyrics = (sec: Section) => sec.lines.map(l => l.text).filter(Boolean).join('\n');

      const prevContext = prevSection
        ? `\n${fenceLong(`PREVIOUS_SECTION_${sanitizeForPrompt(prevSection.name, { maxLength: 32 })}`, formatSectionLyrics(prevSection))}`
        : '';
      const nextContext = nextSection
        ? `\n${fenceLong(`NEXT_SECTION_${sanitizeForPrompt(nextSection.name, { maxLength: 32 })}`, formatSectionLyrics(nextSection))}`
        : '';

      const creativeDirectives = [
        ...(sectionToRegenerate.preInstructions || []),
        ...(sectionToRegenerate.postInstructions || []),
      ];
      const directivesPrompt = creativeDirectives.length > 0
        ? `\nCreative directives:\n${creativeDirectives.map((d, i) => `- ${fence(`DIRECTIVE_${i + 1}`, d, { maxLength: 200 })}`).join('\n')}`
        : '';

      const langCode = sectionToRegenerate.language || latestSongLanguageRef.current;
      const hasRhymedLines = sectionToRegenerate.lines.some(line =>
        line.rhyme && line.rhyme !== '' && line.rhyme !== 'FREE' && !line.isMeta,
      );
      let ipaConstraints = '';
      if (langCode && hasRhymedLines) {
        try {
          const enrichedPrompt = await buildRhymeConstrainedPrompt(
            sectionToRegenerate.lines,
            langCode,
            effectiveRhymeScheme,
          );
          if (enrichedPrompt.includes('PHONEMIC RHYME CONSTRAINTS:')) {
            ipaConstraints = '\n\n' + enrichedPrompt.substring(
              enrichedPrompt.indexOf('PHONEMIC RHYME CONSTRAINTS:'),
            );
          }
        } catch (err) {
          logger.debug('Failed to build IPA-enhanced prompt, continuing without:', err);
        }
      }

      const sectionPayload: Section = {
        ...sectionToRegenerate,
        rhymeScheme: effectiveRhymeScheme,
      };

      const prompt =
`${UNTRUSTED_INPUT_PREAMBLE}

Rewrite the following section of a song.
${fence('TITLE', latestTitleRef.current, { maxLength: 200 })}
${fence('TOPIC', latestTopicRef.current)}
${fence('MOOD', latestMoodRef.current)}
Target Syllables per line: ${latestTargetSyllablesRef.current}
Section Name: ${sanitizeForPrompt(sectionPayload.name, { maxLength: 64 })}
Rhyme Scheme: ${sanitizeForPrompt(effectiveRhymeScheme, { maxLength: 64 })}
${lineCountPrompt}
Song structure: ${songStructure}
${prevContext}${nextContext}${directivesPrompt}

${RHYME_ENFORCEMENT_RULES}${ipaConstraints}

${META_INSTRUCTION_HINT}

IMPORTANT: Write ALL lyrics in ${lang}. Concepts may be written in ${safeUiLang}.
${exclusiveLanguageInstruction ? `${exclusiveLanguageInstruction}\n` : ''}

${fenceLong('CURRENT_SECTION', JSON.stringify([sectionPayload], null, 2))}

Provide a new creative version of this section that fits seamlessly with the surrounding sections.
Return the updated section in the exact same JSON structure (as an array with one section).`;

      const response = await withRetry(() =>
        getAi().models.generateContent({
          model: AI_MODEL_NAME,
          contents: prompt,
          config: { responseMimeType: 'application/json', responseSchema: GENERATION_SCHEMA },
          signal: ctrl.signal,
        }),
      );

      if (ctrl.signal.aborted) return;

      const data = safeJsonParse<SongResponse>(response.text || '[]', [], SongResponseSchema);
      const firstSection = data[0];
      if (firstSection) {
        const patchedSection = {
          ...firstSection,
          rhymeScheme: firstSection.rhymeScheme || effectiveRhymeScheme,
          lines: flagMetaLines(firstSection.lines ?? []),
        };
        updateSong(currentSongState =>
          syncLinkedChorusSections(currentSongState.map(section =>
            section.id !== sectionId ? section : mergeAiSectionIntoCurrent(section, patchedSection),
          ), sectionId),
        );
      }
    } catch (error: unknown) {
      if (isAbortError(error)) return;
      handleApiError(error, 'Failed to regenerate section. Please try again.');
    } finally {
      if (!ctrl.signal.aborted) {
        setRegeneratingSections(prev => {
          const next = new Set(prev);
          next.delete(sectionId);
          return next;
        });
      }
      regenAbortRefs.current.delete(sectionId);
    }
  }, [updateSong]);

  const quantizeSyllables = useCallback(async (sectionId?: string) => {
    const currentSong = latestSongRef.current;
    const currentTargetSyllables = latestTargetSyllablesRef.current;
    if (currentSong.length === 0) return;
    setIsGenerating(true);
    const lang = sanitizeForPrompt(latestSongLanguageRef.current || 'English', { maxLength: 64 });
    const exclusiveLanguageInstruction = buildExclusiveLanguageInstruction(latestSongLanguageRef.current);

    try {
      await withAbort(generateAbortRef, async (signal) => {
        let prompt = '';
        if (sectionId) {
          const sectionToQuantize = currentSong.find(s => s.id === sectionId);
          if (!sectionToQuantize) return;
          const syllables = sectionToQuantize.targetSyllables ?? currentTargetSyllables;
          prompt =
`${UNTRUSTED_INPUT_PREAMBLE}

Rewrite the following section of a song so that EVERY line has EXACTLY ${syllables} syllables.
Maintain the original meaning, rhyme scheme, and section structure.
Write ALL lyrics in ${lang}.
${exclusiveLanguageInstruction ? `${exclusiveLanguageInstruction}\n` : ''}Preserve any meta-instruction lines (e.g. [Guitar solo]) verbatim — they are NOT counted toward syllable targets.

${RHYME_ENFORCEMENT_RULES}

${fenceLong('CURRENT_SECTION', JSON.stringify([sectionToQuantize], null, 2))}

Return the updated section in the exact same JSON structure (as an array with one section).`;
        } else {
          prompt =
`${UNTRUSTED_INPUT_PREAMBLE}

Rewrite the following song so that EVERY line has EXACTLY the number of syllables specified by its
section's targetSyllables (or ${currentTargetSyllables} if not specified).
Maintain the original meaning, rhyme scheme (respecting section-level schemes if specified), and section structure.
Write ALL lyrics in ${lang}.
${exclusiveLanguageInstruction ? `${exclusiveLanguageInstruction}\n` : ''}Preserve any meta-instruction lines (e.g. [Guitar solo]) verbatim — they are NOT counted toward syllable targets.

${RHYME_ENFORCEMENT_RULES}

${fenceLong('CURRENT_SONG', JSON.stringify(currentSong, null, 2))}

Return the updated song in the exact same JSON structure.`;
        }

        const response = await withRetry(() =>
          getAi().models.generateContent({
            model: AI_MODEL_NAME,
            contents: prompt,
            config: { responseMimeType: 'application/json', responseSchema: GENERATION_SCHEMA },
            signal,
          }),
        );

        const data = safeJsonParse<SongResponse>(response.text || '[]', [], SongResponseSchema);

        if (sectionId) {
          const firstSection = data[0];
          if (firstSection) {
            const patchedSection = { ...firstSection, lines: flagMetaLines(firstSection.lines ?? []) };
            updateSong(currentSongState =>
              syncLinkedChorusSections(currentSongState.map(section =>
                section.id !== sectionId ? section : mergeAiSectionIntoCurrent(section, patchedSection),
              ), sectionId),
            );
          }
        } else {
          const updatedSong = mapSongWithPreservedIds(data, currentSong);
          const reflagged = updatedSong.map(sec => ({ ...sec, lines: flagMetaLines(sec.lines) }));
          updateSongWithHistory(syncLinkedChorusSections(reflagged));
        }
      });
    } catch (error: unknown) {
      if (isAbortError(error)) return;
      handleApiError(error, 'Failed to quantize syllables. Please try again.');
    } finally {
      if (!generateAbortRef.current?.signal.aborted) setIsGenerating(false);
    }
  }, [updateSong, updateSongWithHistory]);

  return {
    isGenerating,
    isRegeneratingSection,
    generateSong,
    regenerateSection,
    quantizeSyllables,
  };
};
