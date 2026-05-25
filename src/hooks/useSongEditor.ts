import { useCallback, useEffect, useRef } from 'react';
import { isAnchoredEndSection, isAnchoredStartSection } from '../constants/sections';
import { useSectionManager } from './useSectionManager';
import { buildPrintHtml, buildShareUrl, createSongExport, type ExportFormat } from '../utils/exportUtils';
import { extractImportPayloadFromDocx, extractImportPayloadFromOdt, extractImportPayloadFromText } from '../utils/libraryUtils';
import { useSongContext } from '../contexts/SongContext';
import { useOptionalVersionContext } from '../contexts/VersionContext';
import { SessionSchema } from '../schemas/sessionSchema';
import { normalizeLoadedSection } from '../utils/songUtils';
import type { SongVersion } from '../types';

type SaveFilePickerOptions = {
  suggestedName: string;
  startIn?: 'downloads';
  types?: Array<{ description: string; accept: Record<string, string[]> }>;
};

type SaveFilePickerHandle = {
  createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>;
};

type WindowWithSaveFilePicker = Window & {
  showSaveFilePicker?: (options: SaveFilePickerOptions) => Promise<SaveFilePickerHandle>;
};

type UseSongEditorParams = {
  openPasteModalWithText: (text: string) => void;
};

export const useSongEditor = ({
  openPasteModalWithText,
}: UseSongEditorParams) => {
  const {
    song,
    title,
    titleOrigin,
    topic,
    mood,
    songLanguage,
    genre,
    tempo,
    instrumentation,
    rhythm,
    narrative,
    musicalPrompt,
    updateSongAndStructureWithHistory,
    setTitle,
    setTitleOrigin,
    setTopic,
    setMood,
    setSongLanguage,
    setGenre,
    setTempo,
    setInstrumentation,
    setRhythm,
    setNarrative,
    setMusicalPrompt,
  } = useSongContext();
  const versionContext = useOptionalVersionContext();
  const { removeStructureItem, addStructureItem, normalizeStructure } = useSectionManager();

  // ── File operations ────────────────────────────────────────────────────────
  const exportSong = useCallback(async (format: ExportFormat) => {
    if (song.length === 0) return;

    // PDF: open a styled print window — the browser handles PDF generation
    if (format === 'pdf') {
      const html = buildPrintHtml({ song, title, topic, mood, songLanguage });
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;
      printWindow.document.write(html);
      printWindow.document.close();
      return;
    }

    const { blob, filename } = createSongExport({
      song,
      title,
      titleOrigin,
      topic,
      mood,
      songLanguage,
      genre,
      tempo,
      instrumentation,
      rhythm,
      narrative,
      musicalPrompt,
      versions: versionContext?.versions ?? [],
      format,
    });
    const saveWithPicker = async () => {
      const filePicker = (window as WindowWithSaveFilePicker).showSaveFilePicker;
      if (!filePicker) return false;
      try {
        const extension = filename.split('.').pop() ?? format;
        const handle = await filePicker({
          suggestedName: filename,
          startIn: 'downloads',
          types: [{ description: `${extension.toUpperCase()} file`, accept: { [blob.type || 'application/octet-stream']: [`.${extension}`] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return true;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return true;
        return false;
      }
    };
    const saved = await saveWithPicker();
    if (saved) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [song, title, topic, mood, songLanguage, genre, tempo, instrumentation, rhythm, narrative, musicalPrompt, versionContext?.versions]);

  const loadFileForAnalysis = useCallback(async (file: File): Promise<{ songLanguage?: string; songTitle?: string }> => {
    let payload: { text: string; songLanguage: string; songTitle?: string } = { text: '', songLanguage: '' };
    if (file.name.endsWith('.docx')) {
      payload = await extractImportPayloadFromDocx(file);
    } else if (file.name.endsWith('.odt')) {
      payload = await extractImportPayloadFromOdt(file);
    } else if (file.name.endsWith('.json')) {
      const text = await file.text();
      try {
        const parsed = JSON.parse(text) as unknown;
        const result = SessionSchema.safeParse(parsed);
        if (result.success && result.data.song?.length) {
          const importedSong = result.data.song.map(section => normalizeLoadedSection(section));
          const importedStructure = result.data.structure?.length
            ? result.data.structure
            : importedSong.map(section => section.name);
          updateSongAndStructureWithHistory(importedSong, importedStructure);
          setTitle(result.data.title ?? 'Untitled Song');
          setTitleOrigin(result.data.titleOrigin ?? titleOrigin);
          setTopic(result.data.topic ?? '');
          setMood(result.data.mood ?? '');
          if (result.data.songLanguage) setSongLanguage(result.data.songLanguage);
          setGenre(result.data.genre ?? '');
          setTempo(Number(result.data.tempo) || 120);
          setInstrumentation(result.data.instrumentation ?? '');
          setRhythm(result.data.rhythm ?? '');
          setNarrative(result.data.narrative ?? '');
          setMusicalPrompt(result.data.musicalPrompt ?? '');
          const importedVersions = Array.isArray((parsed as { versions?: unknown }).versions)
            ? (parsed as { versions: SongVersion[] }).versions
            : [];
          versionContext?.replaceVersions(importedVersions);
          return {
            ...(result.data.songLanguage ? { songLanguage: result.data.songLanguage } : {}),
            ...(result.data.title ? { songTitle: result.data.title } : {}),
          };
        }
      } catch {
        // Fall through and expose the raw JSON as text for analysis.
      }
      payload = { text, songLanguage: '' };
    } else {
      payload = extractImportPayloadFromText(await file.text());
    }
    if (payload.text) openPasteModalWithText(payload.text);
    return {
      ...(payload.songLanguage ? { songLanguage: payload.songLanguage } : {}),
      ...(payload.songTitle !== undefined ? { songTitle: payload.songTitle } : {}),
    };
  }, [
    openPasteModalWithText,
    setGenre,
    setInstrumentation,
    setMood,
    setMusicalPrompt,
    setNarrative,
    setRhythm,
    setSongLanguage,
    setTempo,
    setTitle,
    setTitleOrigin,
    setTopic,
    titleOrigin,
    updateSongAndStructureWithHistory,
    versionContext,
  ]);

  const introOutroSortedRef = useRef<string | null>(null);
  useEffect(() => {
    if (song.length === 0) return;
    const introIdx = song.findIndex(s => isAnchoredStartSection(s.name));
    const outroIdx = song.findIndex(s => isAnchoredEndSection(s.name));
    if (introIdx <= 0 && (outroIdx === -1 || outroIdx === song.length - 1)) return;
    const others = song.filter(s => !isAnchoredStartSection(s.name) && !isAnchoredEndSection(s.name));
    const sorted = [...(introIdx !== -1 ? [song[introIdx]!] : []), ...others, ...(outroIdx !== -1 ? [song[outroIdx]!] : [])];
    const key = JSON.stringify(sorted.map(s => s.id));
    if (key === introOutroSortedRef.current) return;
    introOutroSortedRef.current = key;
    updateSongAndStructureWithHistory(sorted, sorted.map(s => s.name));
  }, [song, updateSongAndStructureWithHistory]);

  const getShareUrl = useCallback(
    () => buildShareUrl({ song, title, topic, mood, songLanguage }),
    [song, title, topic, mood, songLanguage],
  );

  return {
    removeStructureItem,
    addStructureItem,
    normalizeStructure,
    exportSong,
    loadFileForAnalysis,
    getShareUrl,
  };
};
