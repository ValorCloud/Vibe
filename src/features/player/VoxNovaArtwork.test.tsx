import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { createRef } from 'react';
import { VoxNovaArtwork } from './VoxNovaArtwork';
import type { StageOverlayBindings } from './StageOverlay';

function makeOverlay(overrides: Partial<StageOverlayBindings> = {}): StageOverlayBindings {
  return {
    currentTime: 30,
    duration: 120,
    volume: 0.8,
    onTogglePlay: vi.fn(),
    onSeek: vi.fn(),
    onVolumeChange: vi.fn(),
    ...overrides,
  };
}

describe('VoxNovaArtwork', () => {
  describe('Spotify mode', () => {
    it('renders the Spotify album-art stage with track metadata', () => {
      render(
        <VoxNovaArtwork
          isSpotify
          contentWidth="500px"
          isPlaying={false}
          spotifyImageUrl="https://example.com/cover.jpg"
          spotifyTrackName="Cosmic Drift"
          spotifyArtistsLabel="The Voyagers"
        />,
      );
      expect(screen.getByText('SPOTIFY STREAM')).toBeInTheDocument();
      expect(screen.getByText('Cosmic Drift')).toBeInTheDocument();
      expect(screen.getByText('The Voyagers')).toBeInTheDocument();
      const img = screen.getByAltText('Album art for Cosmic Drift') as HTMLImageElement;
      expect(img).toBeInTheDocument();
      expect(img.src).toBe('https://example.com/cover.jpg');
    });

    it('shows STREAMING when playing and STANDBY when paused', () => {
      const { rerender } = render(
        <VoxNovaArtwork
          isSpotify
          contentWidth="500px"
          isPlaying={false}
          spotifyImageUrl="https://example.com/cover.jpg"
          spotifyTrackName="Cosmic Drift"
        />,
      );
      expect(screen.getByText('STANDBY')).toBeInTheDocument();
      rerender(
        <VoxNovaArtwork
          isSpotify
          contentWidth="500px"
          isPlaying
          spotifyImageUrl="https://example.com/cover.jpg"
          spotifyTrackName="Cosmic Drift"
        />,
      );
      expect(screen.getByText('STREAMING')).toBeInTheDocument();
    });

    it('renders nothing when the Spotify image or track name is missing', () => {
      const { container } = render(
        <VoxNovaArtwork isSpotify contentWidth="500px" isPlaying={false} spotifyTrackName="Cosmic Drift" />,
      );
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('local video mode', () => {
    it('renders the video stage with the provided source', () => {
      const videoRef = createRef<HTMLVideoElement>();
      render(
        <VoxNovaArtwork
          isSpotify={false}
          contentWidth="500px"
          isPlaying
          videoSrc="blob:video-stream"
          videoRef={videoRef}
        />,
      );
      expect(screen.getByText('VIDEO STREAM')).toBeInTheDocument();
      expect(screen.getByText('ACTIVE')).toBeInTheDocument();
      const video = screen.getByLabelText('Video player – playing') as HTMLVideoElement;
      expect(video).toBeInTheDocument();
      expect(video.getAttribute('src')).toBe('blob:video-stream');
    });

    it('renders nothing when no video source/ref is supplied', () => {
      const { container } = render(
        <VoxNovaArtwork isSpotify={false} contentWidth="500px" isPlaying={false} />,
      );
      expect(container).toBeEmptyDOMElement();
    });

    it('renders in-stage overlay controls (play/pause, ±10s, seek, volume) on the video', () => {
      const videoRef = createRef<HTMLVideoElement>();
      const overlay = makeOverlay();
      render(
        <VoxNovaArtwork
          isSpotify={false}
          contentWidth="500px"
          isPlaying
          videoSrc="blob:video-stream"
          videoRef={videoRef}
          overlay={overlay}
        />,
      );
      expect(screen.getByLabelText('Pause')).toBeInTheDocument();
      expect(screen.getByLabelText('Skip back 10 seconds')).toBeInTheDocument();
      expect(screen.getByLabelText('Skip forward 10 seconds')).toBeInTheDocument();
      expect(screen.getByLabelText('Seek')).toBeInTheDocument();
      expect(screen.getByLabelText('Volume')).toBeInTheDocument();
    });

    it('wires the overlay controls to the engine bindings', () => {
      const videoRef = createRef<HTMLVideoElement>();
      const overlay = makeOverlay();
      render(
        <VoxNovaArtwork
          isSpotify={false}
          contentWidth="500px"
          isPlaying={false}
          videoSrc="blob:video-stream"
          videoRef={videoRef}
          overlay={overlay}
        />,
      );
      fireEvent.click(screen.getByLabelText('Play'));
      expect(overlay.onTogglePlay).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByLabelText('Skip back 10 seconds'));
      expect(overlay.onSeek).toHaveBeenCalledWith(20);
      fireEvent.click(screen.getByLabelText('Skip forward 10 seconds'));
      expect(overlay.onSeek).toHaveBeenCalledWith(40);
      fireEvent.change(screen.getByLabelText('Volume'), { target: { value: '0.3' } });
      expect(overlay.onVolumeChange).toHaveBeenCalledWith(0.3);
    });
  });

  describe('local audio mode (no video)', () => {
    it('renders the randomized visual stage with overlay controls when a seed is provided', () => {
      render(
        <VoxNovaArtwork
          isSpotify={false}
          contentWidth="500px"
          isPlaying
          visualSeed="track-42"
          overlay={makeOverlay()}
        />,
      );
      expect(screen.getByText('VISUAL STREAM')).toBeInTheDocument();
      expect(screen.getByLabelText('Audio visualization – playing')).toBeInTheDocument();
      expect(screen.getByLabelText('Pause')).toBeInTheDocument();
      expect(screen.getByLabelText('Volume')).toBeInTheDocument();
    });

    it('renders nothing without a visual seed', () => {
      const { container } = render(
        <VoxNovaArtwork isSpotify={false} contentWidth="500px" isPlaying={false} overlay={makeOverlay()} />,
      );
      expect(container).toBeEmptyDOMElement();
    });
  });
});
