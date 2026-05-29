import { useRef, useEffect, type RefObject } from 'react';
import { Type } from '../../ui/icons';
import { useTranslation } from '../../../i18n';
import { ReadAloudButton } from '../../../features/voice/ReadAloudButton';
import { EditorModeShell } from './EditorModeShell';

interface TextModePanelProps {
  markupTextareaRef: RefObject<HTMLTextAreaElement | null>;
  markupText: string;
  setMarkupText: (value: string) => void;
  markupDirection: 'ltr' | 'rtl';
}

export function TextModePanel({
  markupTextareaRef,
  markupText,
  setMarkupText,
  markupDirection,
}: TextModePanelProps) {
  const { t } = useTranslation();
  const gutterContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ta = markupTextareaRef.current;
    if (!ta) return;
    const syncGutter = () => {
      if (gutterContentRef.current) {
        gutterContentRef.current.style.transform = `translateY(-${ta.scrollTop}px)`;
      }
    };
    syncGutter();
    ta.addEventListener('scroll', syncGutter);
    return () => ta.removeEventListener('scroll', syncGutter);
  }, [markupTextareaRef]);

  const lines = markupText.split('\n');

  return (
    <EditorModeShell
      icon={<Type className="w-4 h-4 text-[var(--accent-color)]" />}
      title={t.editor.textMode.title}
      description={t.editor.textMode.description}
      hint={t.editor.textMode.hint}
      headerActions={
        <ReadAloudButton
          id="lyrics-text"
          text={() => markupText}
          label={t.tooltips?.readLyrics ?? 'Read lyrics aloud'}
        />
      }
    >
      <div className="flex flex-row flex-1 min-h-0 overflow-hidden">
        <div
          className="flex-shrink-0 overflow-hidden bg-[var(--bg-app)] border-r border-[var(--border-color)]"
          style={{ width: '2.5rem' }}
          aria-hidden="true"
        >
          <div ref={gutterContentRef} style={{ paddingTop: '1.5rem', paddingBottom: '1.5rem', willChange: 'transform' }}>
            {lines.map((_, i) => (
              <div key={i} className="leading-7 text-right pr-2 text-[10px] tabular-nums font-mono text-zinc-500 select-none">
                {i + 1}
              </div>
            ))}
          </div>
        </div>
        <div className="relative flex-1 min-h-0 overflow-hidden">
          <textarea
            ref={markupTextareaRef as RefObject<HTMLTextAreaElement>}
            value={markupText}
            onChange={(e) => setMarkupText(e.target.value)}
            spellCheck={false}
            dir={markupDirection}
            aria-label={t.editor.textMode.title}
            placeholder={t.editor.textMode.placeholder}
            className="absolute inset-0 w-full h-full resize-none bg-[var(--bg-app)] caret-[var(--text-primary)] outline-none font-mono text-sm leading-7 text-[var(--text-primary)]"
            style={{ padding: '1.5rem' }}
          />
        </div>
      </div>
    </EditorModeShell>
  );
}
