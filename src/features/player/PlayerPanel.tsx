/**
 * PlayerPanel
 * LCARS audio player — integrates into the app's AppEditorZone
 * as the third tab (activeTab === 'player').
 *
 * Layout mirrors the VoxNova LCARS design:
 *   Left sidebar  — VOX header / library tabs / track list / scan controls
 *   Right main    — USS topbar / readouts / title / transport / visualizer
 *
 * No Three.js. No WarpField. Pure player.
 */
import React, { useRef } from 'react';
import { Globe, Database, Upload, SkipBack, SkipForward, Play, Pause } from 'lucide-react';
import { usePlayerState } from './usePlayerState';
import { FrequencyVisualizer } from './FrequencyVisualizer';

export function PlayerPanel() {
  const {
    library, selectedTrack, isPlaying, libraryTab, scanType, scanPattern,
    filteredTracks,
    audioRef, fileInputRef, folderInputRef,
    getAudioUrl, togglePlay, handleNext, handlePrevious,
    handleTrackSelect, purgeCloudMemory, updateMemo,
    handleFileChange, handleFolderScan,
    setLibraryTab, setScanType, setScanPattern, setIsPlaying,
  } = usePlayerState();

  return (
    <div
      className="flex-1 flex overflow-hidden min-h-0"
      style={{
        fontFamily: 'var(--fontFamilyBase, monospace)',
        color: '#99ccff',
        background: 'var(--bg-app, #0a0a0a)',
      }}
    >
      {/* ── Left sidebar ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1 w-[220px] shrink-0 p-2 border-r border-[#99ccff]/10">

        {/* VOX header pill */}
        <div className="h-20 bg-[#cc9966] rounded-tl-[40px] rounded-br-lg p-4 flex flex-col justify-end">
          <div className="text-black font-black text-xl tracking-tighter leading-none">VOX</div>
          <div className="text-black/60 text-[9px] font-bold tracking-widest uppercase">NV-42 CORE</div>
        </div>

        {/* Cloud / Local tabs */}
        <button
          onClick={() => { setLibraryTab('cloud'); }}
          className={`h-10 flex items-center justify-between px-4 font-bold text-[10px] uppercase transition-all ${
            libraryTab === 'cloud'
              ? 'bg-[#9999ff] text-black'
              : 'bg-[#333366] text-[#9999ff] hover:bg-[#444488]'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>Cloud</span>
        </button>
        <button
          onClick={() => { setLibraryTab('local'); }}
          className={`h-10 flex items-center justify-between px-4 font-bold text-[10px] uppercase transition-all ${
            libraryTab === 'local'
              ? 'bg-[#ff9900] text-black'
              : 'bg-[#663300] text-[#ff9900] hover:bg-[#884400]'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Local</span>
        </button>

        {/* Purge (cloud only) */}
        {libraryTab === 'cloud' && (
          <button
            onClick={purgeCloudMemory}
            className="h-8 mx-1 bg-[#cc6666] text-black font-bold text-[9px] uppercase rounded hover:brightness-125 transition-all"
          >
            Purge
          </button>
        )}

        {/* Track list */}
        <div className="flex-1 overflow-y-auto py-2 space-y-1 pr-1 border-y border-white/5">
          {libraryTab === 'local' && !library.some(t => t.source === 'local' && t.linked) && (
            <div className="px-4 py-2 text-[8px] text-[#cc6666] uppercase animate-pulse leading-tight">
              Handshake Required
            </div>
          )}
          {filteredTracks.map(track => {
            const offline = !track.linked;
            return (
              <button
                key={track.id + (track.fileName ?? '')}
                onClick={() => handleTrackSelect(track)}
                className={`w-full px-4 py-2 text-[9px] font-bold uppercase truncate text-right transition-all border-r-4 ${
                  selectedTrack.id === track.id
                    ? 'bg-[#99ccff] text-black border-white'
                    : 'bg-white/5 text-[#99ccff]/60 border-transparent hover:bg-white/10'
                } ${offline ? 'opacity-30 italic cursor-not-allowed' : ''}`}
              >
                {offline && '⊘ '}{track.title}
              </button>
            );
          })}
        </div>

        {/* Scan protocol (local tab) */}
        {libraryTab === 'local' && (
          <div className="bg-[#1a1a1a] p-2 border-l-4 border-[#ff9900] space-y-2">
            <span className="text-[7px] text-[#ff9900] font-bold uppercase tracking-widest px-1">Audio Protocol</span>
            <div className="flex gap-1">
              {(['wav', 'mp3', 'all'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setScanType(type)}
                  className={`flex-1 text-[7px] font-bold uppercase py-1 border ${
                    scanType === type
                      ? 'bg-[#ff9900] text-black border-[#ff9900]'
                      : 'text-[#ff9900] border-[#ff9900]/30 hover:bg-[#ff9900]/10'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
            <span className="text-[7px] text-[#ff9900] font-bold uppercase tracking-widest px-1">Pattern Match</span>
            <input
              type="text"
              value={scanPattern}
              onChange={e => setScanPattern(e.target.value)}
              className="bg-black border border-[#ff9900]/30 px-2 py-1 text-[8px] text-[#ff9900] uppercase focus:outline-none focus:border-[#ff9900] font-mono w-full"
              placeholder="Search…"
            />
          </div>
        )}

        {/* Uplink / Scan sector */}
        <div className="grid grid-cols-2 gap-1 mt-auto">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="h-12 bg-[#ffcc99] flex items-center justify-between px-3 text-black font-bold text-[9px] uppercase hover:brightness-125 transition-all"
          >
            <Upload className="w-3 h-3" />
            <span>Uplink</span>
          </button>
          <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileChange} />

          <button
            onClick={() => folderInputRef.current?.click()}
            className="h-12 bg-[#ff9900] flex items-center justify-between px-3 text-black font-bold text-[9px] uppercase hover:brightness-125 transition-all"
          >
            <Database className="w-3 h-3" />
            <span>Scan Sector</span>
          </button>
          <input
            ref={folderInputRef}
            type="file"
            className="hidden"
            onChange={handleFolderScan}
            {...{ directory: '', webkitdirectory: '' } as React.InputHTMLAttributes<HTMLInputElement>}
          />
        </div>
      </div>

      {/* ── Right main panel ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* USS topbar */}
        <div className="flex gap-2 p-2">
          <div className="h-10 w-20 bg-[#9999cc] rounded-tr-lg" />
          <div className="h-10 flex-1 bg-[#ffcc99] rounded-tr-[40px] rounded-bl-lg flex items-center justify-between px-6 text-black font-bold tracking-[0.2em] text-[10px] uppercase">
            <span>USS VOX NOVA // REGISTRY 7AE45D57</span>
            <div className="flex gap-4 items-center">
              <div className="flex gap-1 items-center">
                <div className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-green-500 animate-ping' : 'bg-red-500'}`} />
                <span className="text-[8px]">{isPlaying ? 'WARP_ACTIVE' : 'IMPULSE_ONLY'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Readouts */}
        <div className="grid grid-cols-3 gap-4 px-6 py-2">
          <div className="space-y-1">
            <div className="text-[8px] font-bold text-[#cc9966] uppercase tracking-widest">Structural Integrity</div>
            <div className="h-1 bg-[#332211] rounded-full overflow-hidden">
              <div className="h-full bg-[#cc9966] w-[94%]" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[8px] font-bold text-[#9999ff] uppercase tracking-widest">Neural Buffer</div>
            <div className="h-1 bg-[#111133] rounded-full overflow-hidden">
              <div className="h-full bg-[#9999ff] w-[42%]" />
            </div>
          </div>
          <div className="space-y-1 text-right">
            <div className="text-[8px] font-bold text-[#cc6666] uppercase tracking-widest">Sector Time</div>
            <div className="text-lg font-mono text-[#cc6666] leading-none">0214.7</div>
          </div>
        </div>

        {/* Center display */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 space-y-6">
          {/* Title block */}
          <div className="text-center space-y-2">
            <div className="text-[10px] font-bold tracking-[0.6em] text-blue-400/60 uppercase">
              Comms_Encryption: Level 5
            </div>
            <h2 className="text-5xl font-bold tracking-tighter text-white drop-shadow-[0_0_15px_rgba(153,204,255,0.2)] line-clamp-2">
              {selectedTrack.title}
            </h2>
            <div className="h-1 w-24 bg-[#ff9900] mx-auto mt-4" />
          </div>

          {/* Local memo */}
          {selectedTrack.source === 'local' && (
            <div className="w-full max-w-md space-y-1">
              <div className="text-[8px] font-bold text-[#cc9966] uppercase tracking-widest px-4">Local Memo Log</div>
              <textarea
                value={selectedTrack.memo}
                onChange={e => updateMemo(e.target.value)}
                placeholder="Enter mission notes…"
                className="w-full bg-[#1a1a1a] border border-[#cc9966]/30 rounded p-3 text-[#cc9966] text-[11px] font-mono focus:outline-none focus:border-[#cc9966] min-h-[60px] resize-none"
              />
            </div>
          )}

          {/* Audio element (hidden) */}
          <audio
            ref={audioRef}
            src={getAudioUrl(selectedTrack)}
            crossOrigin="anonymous"
            onEnded={() => setIsPlaying(false)}
          />

          {/* Transport controls */}
          <div className="flex items-center gap-10">
            <button
              onClick={handlePrevious}
              className="w-12 h-12 rounded bg-[#333] hover:bg-[#444] flex items-center justify-center text-[#ffcc99] transition-all active:scale-90"
              aria-label="Previous track"
            >
              <SkipBack className="w-6 h-6 fill-current" />
            </button>

            <button
              onClick={togglePlay}
              className="w-28 h-28 bg-[#cc9966] rounded-full flex items-center justify-center hover:bg-[#ffcc99] transition-all shadow-[0_0_50px_rgba(204,153,102,0.2)] active:scale-95"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying
                ? <Pause className="w-12 h-12 text-black fill-current" />
                : <Play  className="w-12 h-12 text-black fill-current translate-x-1" />}
            </button>

            <button
              onClick={handleNext}
              className="w-12 h-12 rounded bg-[#333] hover:bg-[#444] flex items-center justify-center text-[#ffcc99] transition-all active:scale-90"
              aria-label="Next track"
            >
              <SkipForward className="w-6 h-6 fill-current" />
            </button>
          </div>

          {/* Frequency visualizer */}
          <div className="w-full max-w-2xl px-4">
            <FrequencyVisualizer isPlaying={isPlaying} audioRef={audioRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
