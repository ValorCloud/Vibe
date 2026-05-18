import React, { useMemo } from 'react';
import { KeyboardRegular, X } from '../../ui/icons';
import {
  KEYBOARD_SHORTCUTS_METADATA,
  type KeyboardShortcutCombo,
  type KeyboardShortcutMetadata,
} from '../../../hooks/useKeyboardShortcuts';
import { useTranslation } from '../../../i18n';
import { Button } from '../../ui/Button';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORY_ORDER: KeyboardShortcutMetadata['category'][] = ['edit', 'navigation', 'file', 'ai'];

const CATEGORY_STYLES = {
  edit: {
    accent: 'var(--lcars-amber)',
    badgeSurface: 'rgba(245, 158, 11, 0.16)',
    badgeBorder: 'rgba(245, 158, 11, 0.34)',
  },
  navigation: {
    accent: 'var(--lcars-cyan)',
    badgeSurface: 'rgba(6, 182, 212, 0.16)',
    badgeBorder: 'rgba(6, 182, 212, 0.34)',
  },
  file: {
    accent: 'var(--lcars-sage)',
    badgeSurface: 'rgba(76, 175, 115, 0.16)',
    badgeBorder: 'rgba(76, 175, 115, 0.34)',
  },
  ai: {
    accent: 'var(--lcars-violet)',
    badgeSurface: 'rgba(167, 139, 250, 0.16)',
    badgeBorder: 'rgba(167, 139, 250, 0.34)',
  },
} as const;

function normalizeKeyLabel(key: string) {
  if (key === 'Escape') return 'Esc';
  return key.toUpperCase();
}

function expandComboLabels(combo: KeyboardShortcutCombo) {
  const trailing = [
    ...(combo.modifiers.includes('shift') ? ['Shift'] : []),
    ...(combo.modifiers.includes('alt') ? ['Alt'] : []),
    normalizeKeyLabel(combo.key),
  ];

  if (!combo.modifiers.includes('ctrlOrMeta')) return [trailing];
  return [
    ['Ctrl', ...trailing],
    ['⌘', ...trailing],
  ];
}

function renderCombo(
  combo: KeyboardShortcutCombo,
  accent: string,
  badgeSurface: string,
  badgeBorder: string,
) {
  const variants = expandComboLabels(combo);

  return (
    <div key={`${combo.modifiers.join('+')}:${combo.key}`} className="flex flex-wrap items-center gap-2">
      {variants.map((labels, variantIndex) => (
        <div key={`${combo.key}-${variantIndex}`} className="flex flex-wrap items-center gap-1.5">
          {variantIndex > 0 && <span className="text-[10px] text-[var(--text-secondary)]">/</span>}
          {labels.map((label, labelIndex) => (
            <React.Fragment key={`${label}-${labelIndex}`}>
              {labelIndex > 0 && <span className="text-[10px] text-[var(--text-secondary)]">+</span>}
              <span
                className="inline-flex min-h-[28px] min-w-[28px] items-center justify-center rounded-[12px_4px_12px_4px] border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{
                  color: accent,
                  backgroundColor: badgeSurface,
                  borderColor: badgeBorder,
                  boxShadow: `inset 0 -1px 0 ${badgeBorder}`,
                }}
              >
                {label}
              </span>
            </React.Fragment>
          ))}
        </div>
      ))}
    </div>
  );
}

export function KeyboardShortcutsModal({ isOpen, onClose }: Props) {
  const { t } = useTranslation();
  const actions = (t as { actions?: { close?: string } }).actions;
  const keyboardShortcuts = t.keyboardShortcuts;
  const keyboardShortcutsLegacy = keyboardShortcuts as (typeof keyboardShortcuts & { subtitle?: string }) | undefined;
  const legacyCategory = (keyboardShortcuts as { category?: { editing?: string; navigation?: string; dialogs?: string; ai?: string } } | undefined)?.category;
  const categories = keyboardShortcuts?.categories;
  const shortcutLabels = keyboardShortcuts?.shortcuts;
  const fallbackShortcuts: Record<KeyboardShortcutMetadata['id'], string> = {
    undo: 'Undo the latest change outside text inputs.',
    redo: 'Redo the latest reverted change outside text inputs.',
    dismissReset: 'Dismiss the reset confirmation dialog.',
    dismissNavigation: 'Close the settings, about, similarity, or mobile side panels.',
    dismissFileDialogs: 'Close the import, export, versions, or library dialogs.',
    dismissAiDialogs: 'Close AI prompts, API alerts, analysis, or pasted-lyrics import dialogs.',
    openSearch: 'Open the search & replace panel.',
    goToMusical: 'Jump to the Musical tab (Alt+B).',
    lyriaGenerate: 'Trigger Lyria 30-second preview generation (Alt+A).',
  };

  const categoryLabel = (category: KeyboardShortcutMetadata['category']) => {
    if (category === 'edit') {
      const legacy = legacyCategory?.editing;
      return categories?.edit ?? (legacy === 'Editing' ? 'Edit' : legacy) ?? 'Edit';
    }
    if (category === 'navigation') return categories?.navigation ?? legacyCategory?.navigation ?? 'Navigation';
    if (category === 'file') {
      const legacy = legacyCategory?.dialogs;
      return categories?.file ?? (legacy === 'Dialogs' ? 'File' : legacy) ?? 'File';
    }
    const legacy = legacyCategory?.ai;
    return categories?.ai ?? (legacy === 'AI & Musical' ? 'AI' : legacy) ?? 'AI';
  };

  const shortcutsByCategory = useMemo(() => {
    return CATEGORY_ORDER.map((category) => ({
      category,
      shortcuts: KEYBOARD_SHORTCUTS_METADATA.filter((shortcut) => shortcut.category === category),
    }));
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-[1px] animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Gradient border wrapper */}
      <div
        className="lcars-gradient-outline relative w-full sm:w-[min(880px,calc(100vw-2rem))] h-full sm:h-auto sm:max-h-[90vh] rounded-none sm:rounded-[24px_8px_24px_8px] animate-in zoom-in-95 duration-300"
        style={{
          padding: '2px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
          isolation: 'isolate',
        }}
      >
        {/* Modal panel */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label={keyboardShortcuts?.title ?? 'Keyboard Shortcuts'}
          className="relative w-full h-full flex flex-col shadow-2xl overflow-hidden dialog-surface rounded-none sm:rounded-[22px_6px_22px_6px]"
        >
          {/* Header */}
          <div
            className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between flex-shrink-0"
            style={{ background: 'var(--bg-sidebar)' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/20 flex items-center justify-center">
                <KeyboardRegular className="w-4 h-4 text-[var(--accent-color)]" />
              </div>
              <div>
                <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--text-primary)]">
                   {keyboardShortcuts?.title ?? 'Keyboard Shortcuts'}
                </h2>
                <p className="mt-0.5 text-xs uppercase tracking-[0.22em] text-[var(--accent-color)]">
                  LCARS Input Reference
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
               aria-label={keyboardShortcuts?.close ?? actions?.close ?? 'Close'}
              className="ux-interactive p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-app)] rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5">
            <p className="mb-5 text-sm leading-relaxed text-[var(--text-secondary)]">
               {keyboardShortcuts?.description ?? keyboardShortcutsLegacy?.subtitle ?? 'Memorize these shortcuts to work faster.'}
            </p>

            <div className="space-y-4">
              {shortcutsByCategory.map(({ category, shortcuts }) => {
                const styles = CATEGORY_STYLES[category];

                return (
                  <section
                    key={category}
                    className="overflow-hidden rounded-[20px_6px_20px_6px] border border-[var(--border-color)] bg-[var(--bg-app)]"
                  >
                    <div
                      className="flex items-center justify-between gap-3 border-b border-[var(--border-color)] px-4 py-3"
                      style={{
                        background: `linear-gradient(90deg, ${styles.badgeSurface} 0%, color-mix(in srgb, ${styles.accent} 10%, transparent) 100%)`,
                      }}
                    >
                      <h3 className="text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: styles.accent }}>
                         {categoryLabel(category)}
                      </h3>
                      <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                        {shortcuts.length}
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full border-collapse">
                        <thead>
                          <tr className="border-b border-[var(--border-color)] text-left">
                            <th className="px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-[var(--text-secondary)]">
                               {keyboardShortcuts?.keysColumn ?? 'Keys'}
                            </th>
                            <th className="px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-[var(--text-secondary)]">
                               {keyboardShortcuts?.actionColumn ?? 'Action'}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {shortcuts.map((shortcut) => (
                            <tr key={shortcut.id} className="border-b border-[var(--border-color)] last:border-b-0">
                              <td className="w-[260px] px-4 py-3 align-top">
                                <div className="flex flex-col gap-2">
                                  {shortcut.combos.map((combo) => renderCombo(
                                    combo,
                                    styles.accent,
                                    styles.badgeSurface,
                                    styles.badgeBorder,
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm leading-relaxed text-[var(--text-primary)]">
                                 {shortcutLabels?.[shortcut.id] ?? fallbackShortcuts[shortcut.id]}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div
            className="px-6 py-4 border-t border-[var(--border-color)] flex justify-end flex-shrink-0"
            style={{ background: 'var(--bg-sidebar)' }}
          >
            <Button onClick={onClose} variant="contained" color="primary" className="ux-interactive">
               {keyboardShortcuts?.close ?? actions?.close ?? 'Close'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
