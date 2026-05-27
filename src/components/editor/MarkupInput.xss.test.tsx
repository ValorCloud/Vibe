/**
 * XSS regression tests for MarkupInput's syntax-highlighted mirror.
 *
 * The mirror layer uses `dangerouslySetInnerHTML` to render highlighted
 * markup. Any user-provided text must be HTML-escaped to prevent injection
 * (e.g. `<script>`, `<img onerror>`).
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useRef } from 'react';
import { MarkupInput } from './MarkupInput';

function Harness({ value }: { value: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <MarkupInput
      value={value}
      onChange={() => {}}
      textareaRef={ref}
      aria-label="markup-input"
    />
  );
}

describe('MarkupInput XSS protection', () => {
  it('escapes <script> tags injected through the value prop', () => {
    const payload = '<script>window.__xss=1</script>';
    const { container } = render(<Harness value={payload} />);
    // No real <script> element must be present in the DOM.
    expect(container.querySelector('script')).toBeNull();
    // The literal characters should appear escaped in the mirror.
    const mirror = container.querySelector('.markup-mirror');
    expect(mirror?.innerHTML).toContain('&lt;script&gt;');
    expect(mirror?.innerHTML).not.toContain('<script>');
  });

  it('escapes attribute-style payloads like <img onerror=...>', () => {
    const payload = '<img src=x onerror="window.__xss=1">';
    const { container } = render(<Harness value={payload} />);
    expect(container.querySelector('img')).toBeNull();
    const mirror = container.querySelector('.markup-mirror');
    expect(mirror?.innerHTML).toContain('&lt;img');
    expect(mirror?.innerHTML).not.toContain('<img');
  });

  it('escapes payloads injected inside section-header brackets', () => {
    const payload = '[<script>alert(1)</script>]\nline 1';
    const { container } = render(<Harness value={payload} />);
    expect(container.querySelector('script')).toBeNull();
    const mirror = container.querySelector('.markup-mirror');
    expect(mirror?.innerHTML).toContain('&lt;script&gt;');
  });

  it('still renders the editor textarea with the raw value', () => {
    const payload = '<script>alert(1)</script>';
    render(<Harness value={payload} />);
    const textarea = screen.getByLabelText('markup-input') as HTMLTextAreaElement;
    expect(textarea.value).toBe(payload);
  });
});
