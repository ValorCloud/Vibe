import type { RefObject } from 'react';
import { Layout } from '../../ui/icons';
import { useTranslation } from '../../../i18n';
import { ReadAloudButton } from '../../../features/voice/ReadAloudButton';
import { MarkupInput } from '../MarkupInput';
import { EditorModeShell } from './EditorModeShell';

interface MarkdownModePanelProps {
  markupText: string;
  setMarkupText: (value: string) => void;
  markupTextareaRef: RefObject<HTMLTextAreaElement | null>;
  markupDirection: 'ltr' | 'rtl';
}

export function MarkdownModePanel({
  markupText,
  setMarkupText,
  markupTextareaRef,
  markupDirection,
}: MarkdownModePanelProps) {
  const { t } = useTranslation();

  return (
    <EditorModeShell
      icon={<Layout className="w-4 h-4 text-[var(--accent-color)]" />}
      title={t.editor.markupMode.title}
      description={t.editor.markupMode.description}
      hint={t.editor.markupMode.hint}
      headerActions={
        <ReadAloudButton
          id="lyrics-markdown"
          text={() => markupText}
          label={t.tooltips?.readLyrics ?? 'Read lyrics aloud'}
        />
      }
    >
      <MarkupInput
        value={markupText}
        onChange={(e) => setMarkupText(e.target.value)}
        textareaRef={markupTextareaRef}
        direction={markupDirection}
        aria-label={t.editor.markupMode.title}
        className="w-full flex-1 min-h-0 font-mono text-sm leading-7 text-[var(--text-primary)] bg-[var(--bg-app)]"
        spellCheck={false}
        showLineNumbers
      />
    </EditorModeShell>
  );
}
