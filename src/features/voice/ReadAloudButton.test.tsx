import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { LanguageProvider } from '../../i18n';
import { ReadAloudButton } from './ReadAloudButton';
import type { TextToSpeechApi } from './useTextToSpeech';

function makeController(overrides: Partial<TextToSpeechApi> = {}): TextToSpeechApi {
  return {
    isSupported: true,
    speakingId: null,
    speak: vi.fn(),
    stop: vi.fn(),
    ...overrides,
  };
}

function renderButton(props: React.ComponentProps<typeof ReadAloudButton>) {
  return render(
    <LanguageProvider>
      <ReadAloudButton {...props} />
    </LanguageProvider>,
  );
}

describe('ReadAloudButton', () => {
  it('renders nothing when speech is unsupported', () => {
    const controller = makeController({ isSupported: false });
    const { container } = renderButton({ text: 'hello', controller });
    expect(container.firstChild).toBeNull();
  });

  it('speaks the resolved text with its id on click', () => {
    const controller = makeController();
    renderButton({ text: () => 'computed lyrics', id: 'sec-1', controller });
    screen.getByRole('button').click();
    expect(controller.speak).toHaveBeenCalledWith('computed lyrics', 'sec-1');
  });

  it('reflects the speaking state via aria-pressed', () => {
    const controller = makeController({ speakingId: 'sec-1' });
    renderButton({ text: 'hello', id: 'sec-1', controller });
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });
});
