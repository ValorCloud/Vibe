import { useCallback, useEffect, useRef } from 'react';
import { isAnchoredEndSection, isAnchoredStartSection } from '../constants/sections';
import { useSectionManager } from './useSectionManager';
import { buildPrintHtml, buildShareUrl, createSongExport, type ExportFormat } from '../utils/exportUtils';
import { extractImportPayloadFromDocx, extractImportPayloadFromOdt, extractImportPayloadFromText } from '../utils/libraryUtils';
import { useSongContext } from '../contexts/SongContext';

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
    topic,
    mood,
    songLanguage,
    updateSongAndStructureWithHistory,
  } = useSongContext();
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

    const { blob, filename } = createSongExport({ song, title, topic, mood, songLanguage, format });
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
  }, [song, title, topic, mood, songLanguage]);

  const loadFileForAnalysis = useCallback(async (file: File): Promise<{ songLanguage?: string; songTitle?: string }> => {
    let payload: { text: string; songLanguage: string; songTitle?: string } = { text: '', songLanguage: '' };
    if (file.name.endsWith('.docx')) {
      payload = await extractImportPayloadFromDocx(file);
    } else if (file.name.endsWith('.odt')) {
      payload = await extractImportPayloadFromOdt(file);
    } else {
      payload = extractImportPayloadFromText(await file.text());
    }
    if (payload.text) openPasteModalWithText(payload.text);
    return {
      ...(payload.songLanguage ? { songLanguage: payload.songLanguage } : {}),
      ...(payload.songTitle !== undefined ? { songTitle: payload.songTitle } : {}),
    };
  }, [openPasteModalWithText]);

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
