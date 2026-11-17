import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { StatusChoice } from './StatusChoice';

afterEach(cleanup);

it('keeps an open menu across callback changes and selects with the current callback', async () => {
  const user = userEvent.setup();
  const previousSelect = vi.fn();
  const currentSelect = vi.fn();
  const options = [{ value: '50', label: '50%' }, { value: '100', label: '100%' }];
  const { rerender } = render(
    <StatusChoice label="Zoom" value="100" options={options} onSelect={previousSelect}>100%</StatusChoice>,
  );

  const trigger = screen.getByRole('button', { name: 'Zoom' });
  await user.click(trigger);
  expect(trigger).toHaveAttribute('aria-expanded', 'true');

  rerender(<StatusChoice label="Zoom" value="100" options={options} onSelect={currentSelect}>100%</StatusChoice>);
  expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await user.click(screen.getByRole('button', { name: '50%' }));
  expect(previousSelect).not.toHaveBeenCalled();
  expect(currentSelect).toHaveBeenCalledExactlyOnceWith('50');
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  expect(trigger).toHaveFocus();
});
