import { useState, useEffect, useRef } from 'react';
import { z } from 'zod';
import type { Section } from '../../types';
import { AI_MODEL_NAME, generateContentWithRetry, safeJsonParse, handleApiError } from '../../utils/aiUtils';
import { getSongText } from '../../utils/songUtils';
import { withAbort, isAbortError } from '../../utils/withAbort';
import {
  DEFAULT_LONG_FIELD_MAX_LENGTH,
  UNTRUSTED_INPUT_PREAMBLE,
  sanitizeForPrompt,
  wrapUntrusted,
} from '../../utils/promptSanitization';
import { checkRhythmicCoherence, type CoherenceResult } from '../../lib/rhythmicCoherence';

const MusicalAnalysisSchema = z.object({
  genre: z.string().optional(),
  tempo: z.string().optional(),
  instrumentation: z.string().optional(),
  rhythm: z.string().optional(),
  narrative: z.string().optional(),
});
type MusicalAnalysis = z.infer<typeof MusicalAnalysisSchema>;

type UseMusicalPromptParams = {
  song: Section[];
  title: string;
  topic: string;
  mood: string;
  genre: string;
  tempo: number;
  durationSeconds?: number;
  timeSignature?: [number, number];
  instrumentation: string;
  rhythm: string;
  narrative: string;
  songLanguage?: string;
  setMusicalPrompt: (value: string) => void;
  setGenre: (value: string) => void;
  setTempo: (value: number) => void;
  setInstrumentation: (value: string) => void;
  setRhythm: (value: string) => void;
  setNarrative: (value: string) => void;
};

/** Returns the 2 first sections + the last one (if distinct), avoiding duplicates. */
function getLyricsSnippet(song: Section[]): Section[] {
  if (song.length <= 2) return song;
  // song.length >= 3 here — last element is guaranteed to exist
  const last = song[song.length - 1] as Section;
  const head = song.slice(0, 2);
  // avoid duplicate if song has exactly 3 sections (last === head[2] already excluded)
  return [...head, last];
}

/**
 * Coerce a numeric language input (e.g. tempo BPM) into a clean integer
 * string. We sanitise the *string form* of numeric inputs so a downstream
 * malicious caller cannot smuggle markup through a non-finite or absurdly
 * large value.
 */
function sanitizeBpm(tempo: number): string {
  if (!Number.isFinite(tempo)) return '120';
  const clamped = Math.max(20, Math.min(300, Math.round(tempo)));
  return String(clamped);
}

export const useMusicalPrompt = ({
  song,
  title,
  topic,
  mood,
  genre,
  tempo,
  durationSeconds = 180,
  timeSignature = [4, 4],
  instrumentation,
  rhythm,
  narrative,
  songLanguage = '',
  setMusicalPrompt,
  setGenre,
  setTempo,
  setInstrumentation,
  setRhythm,
  setNarrative,
}: UseMusicalPromptParams) => {
  const [isGeneratingMusicalPrompt, setIsGeneratingMusicalPrompt] = useState(false);
  const [isAnalyzingLyrics, setIsAnalyzingLyrics] = useState(false);
  const [coherenceResult, setCoherenceResult] = useState<CoherenceResult | null>(null);
  const promptAbortRef = useRef<AbortController | null>(null);
  const analysisAbortRef = useRef<AbortController | null>(null);

  useEffect(() => () => {
    promptAbortRef.current?.abort();
    analysisAbortRef.current?.abort();
  }, []);

  const generateMusicalPrompt = async () => {
    // Allow generation when any musical context is available:
    // title, topic, lyrics, genre, instrumentation, or mood.
    // The previous guard `if (!title && !topic) return` was too strict —
    // it silently blocked generation for users who set genre/instrumentation
    // without filling title or topic first.
    const hasLyrics = song.some(s => s.lines.some(l => l.text.trim() !== ''));
    const hasContext = !!(title || topic || mood || genre || instrumentation || hasLyrics);
    if (!hasContext) return;

    setIsGeneratingMusicalPrompt(true);
    // Capture our own signal so we can later check whether *this* invocation
    // is still the latest one in the ref. This replaces the previous mutable
    // `wasAborted` boolean (an ad-hoc, untyped status flag whose semantics
    // were ambiguous between "superseded by newer run" and "aborted on
    // unmount") with a single, well-typed equality check on the controller.
    let mySignal: AbortSignal | null = null;

    // Sanitise every user-controlled field before interpolation. Wrap each
    // one in an explicit `<<<FIELD>>>` fence so the model can be instructed
    // to treat the contents strictly as data — never as instructions.
    const safeTitle           = sanitizeForPrompt(title);
    const safeTopic           = sanitizeForPrompt(topic);
    const safeMood            = sanitizeForPrompt(mood);
    const safeGenre           = sanitizeForPrompt(genre);
    const safeRhythm          = sanitizeForPrompt(rhythm);
    const safeInstrumentation = sanitizeForPrompt(instrumentation);
    const safeNarrative       = sanitizeForPrompt(narrative);
    const safeLang            = sanitizeForPrompt(songLanguage || 'English', { maxLength: 64 });
    const culturalStyleInstruction = songLanguage.trim()
      ? `Treat ${safeLang} as a cultural style lens so the generated prompt favors idiomatic references, vocal phrasing, and genre cues that feel authentic to that language (for example, French chanson, Korean pop, or Brazilian funk when relevant).`
      : '';

    try {
      await withAbort(promptAbortRef, async (nextSignal) => {
        mySignal = nextSignal;
        const lyricsSnippet = sanitizeForPrompt(getSongText(getLyricsSnippet(song)), {
          maxLength: DEFAULT_LONG_FIELD_MAX_LENGTH,
          preserveLineBreaks: true,
        });
        const response = await generateContentWithRetry({
          model: AI_MODEL_NAME,
          contents: `${UNTRUSTED_INPUT_PREAMBLE}

Generate a structured musical production prompt for an AI music generator (like Suno or Udio).
${wrapUntrusted('SONG_TITLE', safeTitle)}
${wrapUntrusted('TOPIC_THEME', safeTopic)}
${wrapUntrusted('MOOD', safeMood)}
${wrapUntrusted('GENRE', safeGenre)}
${wrapUntrusted('TEMPO_BPM', sanitizeBpm(tempo))}
${wrapUntrusted('RHYTHM_GROOVE', safeRhythm)}
${wrapUntrusted('INSTRUMENTATION', safeInstrumentation)}
${wrapUntrusted('NARRATIVE_VIBE', safeNarrative)}
${wrapUntrusted('SONG_LANGUAGE', safeLang)}
${culturalStyleInstruction}
${wrapUntrusted('LYRICS', lyricsSnippet)}

Return a concise prompt (<= 900 characters) using this exact labeled, line-by-line format:
STYLE: [style/genre lane and sonic fingerprint]
LANGUAGE/CULTURAL LENS: [song language and the culturally coherent stylistic scene it should evoke]
MOOD: [emotional tone + energy level]
VOCALS: [lead style, gender/texture, harmonies/ad-libs]
INSTRUMENTATION: [key instruments/sound sources + treatment]
RHYTHM/GROOVE: [rhythmic feel, swing, percussion details]
STRUCTURE: [arrangement arc and section highlights]
MIX/SPACE: [space/reverb, width, tonal balance, mix notes]
REFERENCES: [2-3 artist or song anchors to emulate]
DELIVERY: [what to ask the model to prioritize/output]
Make the STYLE, LANGUAGE/CULTURAL LENS, and REFERENCES lines culturally coherent with the song language when it is specified.
Keep the response in English (required by music AI tools) and avoid markdown or extra commentary outside of these labeled lines.`,
          signal: nextSignal,
        });

        if (nextSignal.aborted) return;
        const promptText = response.text || '';
        setMusicalPrompt(promptText);

        // Rhythmic coherence check — surface a dialog when score < 70
        const fullLyrics = getSongText(song);
        if (fullLyrics.trim() && promptText.trim()) {
          if (nextSignal.aborted) return;
          const coherence = checkRhythmicCoherence(fullLyrics, {
            bpm: tempo,
            durationSeconds,
            timeSignature,
            language: songLanguage,
          });
          if (nextSignal.aborted) return;
          setCoherenceResult(coherence.needsReview ? coherence : null);
        }
      });
    } catch (error) {
      if (isAbortError(error)) return;
      handleApiError(error, 'Error generating musical prompt.');
    } finally {
      // Always release the spinner — *unless* a newer invocation has already
      // taken ownership of `promptAbortRef`. This fixes the race where an
      // aborted run would leave `isGeneratingMusicalPrompt` stuck at `true`.
      if (!mySignal || promptAbortRef.current?.signal === mySignal) {
        setIsGeneratingMusicalPrompt(false);
        // Also clear the ref so we don't hold on to a finished controller.
        if (mySignal && promptAbortRef.current?.signal === mySignal) {
          promptAbortRef.current = null;
        }
      }
    }
  };

  const analyzeLyricsForMusic = async () => {
    if (song.length === 0 && !topic && !mood) return;
    setIsAnalyzingLyrics(true);
    let mySignal: AbortSignal | null = null;

    const safeTitle = sanitizeForPrompt(title);
    const safeTopic = sanitizeForPrompt(topic);
    const safeMood  = sanitizeForPrompt(mood);
    const safeLang  = sanitizeForPrompt(songLanguage || 'English', { maxLength: 64 });
    const culturalStyleInstruction = songLanguage.trim()
      ? `Use ${safeLang} as a cultural context clue so the suggested genre, instrumentation, rhythm, and narrative feel native to that language's musical traditions when appropriate.`
      : '';

    try {
      await withAbort(analysisAbortRef, async (nextSignal) => {
        mySignal = nextSignal;
        const lyricsText = sanitizeForPrompt(getSongText(song), {
          maxLength: DEFAULT_LONG_FIELD_MAX_LENGTH,
          preserveLineBreaks: true,
        });
        const response = await generateContentWithRetry({
          model: AI_MODEL_NAME,
          contents: `${UNTRUSTED_INPUT_PREAMBLE}

Analyze these song lyrics and metadata to suggest detailed musical production parameters for an AI music generator.

${wrapUntrusted('SONG_TITLE', safeTitle || '(untitled)')}
${wrapUntrusted('TOPIC_THEME', safeTopic || '(not specified)')}
${wrapUntrusted('MOOD', safeMood || '(not specified)')}
${wrapUntrusted('SONG_LANGUAGE', safeLang)}
${culturalStyleInstruction}
${wrapUntrusted('LYRICS', lyricsText || '(no lyrics yet)')}

Based on this, provide JSON with exactly these keys:
{
  "genre": "(string) specific genre/style (e.g. Cinematic Pop, Dark Trap, Indie Folk)",
  "tempo": "(string) BPM as a number string (e.g. 95)",
  "instrumentation": "(string) key instruments and sounds (e.g. Warm piano, ambient pads, sparse percussion, distant strings)",
  "rhythm": "(string) rhythmic character (e.g. Slow half-time groove with sparse hi-hats)",
  "narrative": "(string) sonic story arc and vibe (e.g. Starts intimate and raw, builds to an anthemic climax)"
}
Return only valid JSON, no markdown, no explanations.`,
          config: { responseMimeType: 'application/json' },
          signal: nextSignal,
        });

        if (nextSignal.aborted) return;
        const parsed = safeJsonParse<MusicalAnalysis>(response.text || '{}', {}, MusicalAnalysisSchema);
        if (parsed.genre) setGenre(parsed.genre);
        if (parsed.tempo) setTempo(parseInt(parsed.tempo, 10) || 120);
        if (parsed.instrumentation) setInstrumentation(parsed.instrumentation);
        if (parsed.rhythm) setRhythm(parsed.rhythm);
        if (parsed.narrative) setNarrative(parsed.narrative);
      });
    } catch (error) {
      if (isAbortError(error)) return;
      handleApiError(error, 'Error analyzing lyrics for music suggestions.');
    } finally {
      if (!mySignal || analysisAbortRef.current?.signal === mySignal) {
        setIsAnalyzingLyrics(false);
        if (mySignal && analysisAbortRef.current?.signal === mySignal) {
          analysisAbortRef.current = null;
        }
      }
    }
  };

  return {
    isGeneratingMusicalPrompt,
    isAnalyzingLyrics,
    generateMusicalPrompt,
    analyzeLyricsForMusic,
    coherenceResult,
    dismissCoherenceResult: () => setCoherenceResult(null),
  };
};
