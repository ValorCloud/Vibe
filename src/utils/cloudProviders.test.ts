import { describe, expect, it } from 'vitest';
import { cloudTrackTitle, detectCloudProvider, isCloudVideoUrl, normalizeCloudUrl } from './cloudProviders';

describe('cloudProviders', () => {
  it('normalizes share links to direct download links by provider', () => {
    expect(normalizeCloudUrl('https://www.dropbox.com/s/a1b2/song.mp3?dl=0', 'dropbox')).toContain('dl=1');
    expect(normalizeCloudUrl('https://app.box.com/s/example', 'box')).toContain('download=1');
    expect(normalizeCloudUrl('https://onedrive.live.com/?cid=abc&id=123', 'onedrive')).toContain('download=1');
    expect(normalizeCloudUrl('https://tenant-my.sharepoint.com/:u:/g/personal/me/file', 'onedrive-business')).toContain('download=1');
    expect(normalizeCloudUrl('https://drive.google.com/file/d/1AbCdEfGhIjKl/view?usp=sharing', 'google-drive')).toBe(
      'https://drive.google.com/uc?export=download&id=1AbCdEfGhIjKl',
    );
  });

  it('detects cloud providers from URL host', () => {
    expect(detectCloudProvider('https://1drv.ms/u/s!abc')).toBe('onedrive');
    expect(detectCloudProvider('https://tenant-my.sharepoint.com/personal/user')).toBe('onedrive-business');
    expect(detectCloudProvider('https://dropbox.com/s/abc/test.mp3')).toBe('dropbox');
    expect(detectCloudProvider('https://app.box.com/s/example')).toBe('box');
    expect(detectCloudProvider('https://drive.google.com/file/d/abc/view')).toBe('google-drive');
    expect(detectCloudProvider('https://cdn.example.com/media.wav')).toBe('direct-url');
  });

  it('flags video URLs and derives a stable fallback title', () => {
    expect(isCloudVideoUrl('https://cdn.example.com/video.mkv')).toBe(true);
    expect(isCloudVideoUrl('https://cdn.example.com/audio.flac')).toBe(false);
    expect(cloudTrackTitle('https://cdn.example.com/folder/My%20Track.mp3')).toBe('My Track');
  });
});
