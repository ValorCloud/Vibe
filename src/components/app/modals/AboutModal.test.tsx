import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LanguageProvider } from '../../../i18n';
import { AboutModal } from './AboutModal';
import { APP_VERSION_LABEL } from '../../../version';

describe('AboutModal', () => {
  it('shows the donation sponsor link and preserves all social links in the about dialog', () => {
    const { container } = render(
      <LanguageProvider>
        <AboutModal isOpen onClose={() => {}} />
      </LanguageProvider>,
    );

    const expectedHrefs = [
      'https://github.com/EmmanuelKerhoz/Vibe',
      'https://github.com/sponsors/EmmanuelKerhoz',
      'https://www.youtube.com/@voxnova42',
      'https://open.spotify.com/artist/6VfhDlWsBW0qk0a8x7UbOM',
      'https://www.linkedin.com/in/emmanuelkerhoz/',
      'https://network.landr.com/users/emmanueldk',
      'https://music.amazon.com/artists/B0DKW3BNL7/emmanuel-kerhoz',
      'https://music.apple.com/artist/emmanuel-kerhoz/1776965137',
    ];
    const renderedHrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    const donationLink = screen.getByText('Donation (Github Sponsor)').closest('a');

    expect(donationLink?.getAttribute('href')).toBe('https://github.com/sponsors/EmmanuelKerhoz');
    expect(renderedHrefs).toEqual(expect.arrayContaining(expectedHrefs));
    expect(renderedHrefs).toHaveLength(expectedHrefs.length);
    expect(container.querySelector('.lcars-gradient-outline')).toBeTruthy();
  });

  it('shows the beta-prefixed app version in the dialog header', () => {
    render(
      <LanguageProvider>
        <AboutModal isOpen onClose={() => {}} />
      </LanguageProvider>,
    );

    expect(screen.getByText(APP_VERSION_LABEL, { exact: false })).toBeTruthy();
  });

  it('wraps each swept about item in an explicit content layer', () => {
    const { container } = render(
      <LanguageProvider>
        <AboutModal isOpen onClose={() => {}} />
      </LanguageProvider>,
    );

    const sweepItems = container.querySelectorAll('.about-sweep-item');
    const contentLayers = container.querySelectorAll('.about-sweep-item > .about-sweep-content');

    expect(contentLayers).toHaveLength(sweepItems.length);
  });
});
