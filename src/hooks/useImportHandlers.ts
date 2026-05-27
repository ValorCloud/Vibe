import { useCallback } from 'react';
import type { ChangeEvent, RefObject } from 'react';
import { logger } from '../utils/logger';

type FilePickerHandle = { getFile: () => Promise<File> };
type WindowWithOpenFilePicker = Window & {
  showOpenFilePicker?: (options: object) => Promise<FilePickerHandle[]>;
};

type UseImportHandlersParams = {
  importInputRef: RefObject<HTMLInputElement | null>;
  loadFileForAnalysis: (file: File) => Promise<{ songLanguage?: string; songTitle?: string }>;
  setIsPasteModalOpen: (v: boolean) => void;
  setPastedText: (v: string) => void;
  setSongLanguage: (v: string) => void;
  setSongTitle?: (v: string) => void;
  /** Called after a file has been successfully loaded — use to fold the left panel. */
  onComplete?: () => void;
};

export const useImportHandlers = (params: UseImportHandlersParams) => {
  const { importInputRef, loadFileForAnalysis, setSongLanguage, setSongTitle, onComplete } = params;

  const restoreImportedSongMeta = useCallback((payload: { songLanguage?: string; songTitle?: string }) => {
    const importedLanguage = payload.songLanguage?.trim() ?? '';
    if (importedLanguage) setSongLanguage(importedLanguage);
    const importedTitle = payload.songTitle?.trim() ?? '';
    if (importedTitle && setSongTitle) setSongTitle(importedTitle);
  }, [setSongLanguage, setSongTitle]);

  const handleImportInputChange = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const payload = await loadFileForAnalysis(file);
    restoreImportedSongMeta(payload);
    onComplete?.();
  }, [loadFileForAnalysis, restoreImportedSongMeta, onComplete]);

  const handleImportChooseFile = useCallback(async () => {
    const pickerWindow = window as WindowWithOpenFilePicker;
    if (pickerWindow.showOpenFilePicker) {
      try {
        const [handle] = await pickerWindow.showOpenFilePicker({
          multiple: false,
          types: [{ description: 'Lyrics files', accept: {
            'text/plain': ['.txt', '.md'], 'text/markdown': ['.md'],
            'application/json': ['.json'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'application/vnd.oasis.opendocument.text': ['.odt'],
          } }],
        });
        if (!handle) return;
        const file = await handle.getFile();
        const payload = await loadFileForAnalysis(file);
        restoreImportedSongMeta(payload);
        onComplete?.();
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          logger.error('Failed to open import file picker', error);
        }
      }
      return;
    }
    importInputRef.current?.click();
  }, [importInputRef, loadFileForAnalysis, restoreImportedSongMeta, onComplete]);

  return { handleImportInputChange, handleImportChooseFile };
};
