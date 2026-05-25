import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../../../i18n';
import { ExportModal } from './ExportModal';

describe('ExportModal', () => {
  it('exports the selected format before closing', () => {
    const onClose = vi.fn();
    const onExport = vi.fn();
    const onOpenLibrary = vi.fn();

    render(
      <LanguageProvider>
        <ExportModal
          isOpen
          onClose={onClose}
          onOpenLibrary={onOpenLibrary}
          onExport={onExport}
        />
      </LanguageProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Library' }));
    fireEvent.click(screen.getByRole('button', { name: 'DOCX .docx' }));
    fireEvent.click(screen.getByRole('button', { name: /save file/i }));

    expect(onOpenLibrary).toHaveBeenCalledTimes(1);
    expect(onExport).toHaveBeenCalledWith('docx');
    expect(onClose).toHaveBeenCalled();
  });

  it('shows LRC and PDF format options', () => {
    render(
      <LanguageProvider>
        <ExportModal
          isOpen
          onClose={vi.fn()}
          onOpenLibrary={vi.fn()}
          onExport={vi.fn()}
        />
      </LanguageProvider>,
    );

    expect(screen.getByRole('button', { name: /LRC .lrc/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /PDF .pdf/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Project JSON .vibe.json/i })).toBeInTheDocument();
  });

  it('exports LRC format when selected', () => {
    const onExport = vi.fn();
    const onClose = vi.fn();

    render(
      <LanguageProvider>
        <ExportModal
          isOpen
          onClose={onClose}
          onOpenLibrary={vi.fn()}
          onExport={onExport}
        />
      </LanguageProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /LRC .lrc/i }));
    fireEvent.click(screen.getByRole('button', { name: /save file/i }));

    expect(onExport).toHaveBeenCalledWith('lrc');
    expect(onClose).toHaveBeenCalled();
  });

  it('exports PDF format when selected', () => {
    const onExport = vi.fn();
    const onClose = vi.fn();

    render(
      <LanguageProvider>
        <ExportModal
          isOpen
          onClose={onClose}
          onOpenLibrary={vi.fn()}
          onExport={onExport}
        />
      </LanguageProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /PDF .pdf/i }));
    fireEvent.click(screen.getByRole('button', { name: /save file/i }));

    expect(onExport).toHaveBeenCalledWith('pdf');
    expect(onClose).toHaveBeenCalled();
  });

  it('shows share link section when getShareUrl is provided', () => {
    render(
      <LanguageProvider>
        <ExportModal
          isOpen
          onClose={vi.fn()}
          onOpenLibrary={vi.fn()}
          onExport={vi.fn()}
          getShareUrl={() => 'https://example.com/#share=abc'}
        />
      </LanguageProvider>,
    );

    expect(screen.getByRole('button', { name: /copy link/i })).toBeInTheDocument();
  });

  it('does not show share link section when getShareUrl is not provided', () => {
    render(
      <LanguageProvider>
        <ExportModal
          isOpen
          onClose={vi.fn()}
          onOpenLibrary={vi.fn()}
          onExport={vi.fn()}
        />
      </LanguageProvider>,
    );

    expect(screen.queryByRole('button', { name: /copy link/i })).not.toBeInTheDocument();
  });
});
