import React, { useLayoutEffect } from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { DragProvider, useDragActions } from '../../contexts/DragContext';
import { SongProvider, useSongContext } from '../../contexts/SongContext';
import { DragHandlersProvider, useDragHandlersContext } from '../../contexts/DragHandlersContext';
import type { Section } from '../../types';

const makeSection = (id: string, name: string, lines: Section['lines'] = []): Section => ({ id, name, lines });

function DragInitializer(
  { children, draggedItemIndex }: { children?: React.ReactNode; draggedItemIndex?: number | null }
) {
  const { setDraggedItemIndex } = useDragActions();

  useLayoutEffect(() => {
    setDraggedItemIndex(draggedItemIndex ?? null);
  }, [draggedItemIndex, setDraggedItemIndex]);

  return React.createElement(React.Fragment, null, children);
}

function SongContextInitializer(
  {
    song,
    structure,
    children,
  }: {
    song: Section[];
    structure: string[];
    children?: React.ReactNode;
  }
) {
  const {
    replaceStateWithoutHistory,
    setNewSectionName,
    setTitle,
    setTopic,
    setMood,
    setSongLanguage,
  } = useSongContext();

  useLayoutEffect(() => {
    replaceStateWithoutHistory(song, structure);
    setNewSectionName('');
    setTitle('Test Song');
    setTopic('test');
    setMood('neutral');
    setSongLanguage('');
  }, [
    replaceStateWithoutHistory,
    setMood,
    setNewSectionName,
    setSongLanguage,
    setTitle,
    setTopic,
    song,
    structure,
  ]);

  return React.createElement(React.Fragment, null, children);
}

const playAudioFeedbackRef = { current: null };

const buildHook = (
  song: Section[],
  structure: string[],
  options: { draggedItemIndex?: number | null } = {},
) => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    React.createElement(
      SongProvider,
      null,
      React.createElement(
        DragProvider,
        null,
        React.createElement(
          SongContextInitializer,
          { song, structure },
          React.createElement(
            DragHandlersProvider,
            {
              playAudioFeedbackRef,
              children: React.createElement(DragInitializer, { draggedItemIndex: options.draggedItemIndex }, children),
            },
          ),
        ),
      ),
    )
  );

  const { result } = renderHook(() => ({
    handlers: useDragHandlersContext(),
    context: useSongContext(),
  }), { wrapper });
  return { result };
};

describe('useDragHandlers', () => {
  describe('handleDrop', () => {
    it('moves a pre-chorus and chorus pair together when dragging the chorus', () => {
      const song = [
        makeSection('s1', 'Verse 1'),
        makeSection('s2', 'Pre-Chorus 1'),
        makeSection('s3', 'Chorus 1'),
        makeSection('s4', 'Verse 2'),
      ];

      const { result } = buildHook(
        song,
        song.map(section => section.name),
        { draggedItemIndex: 2 },
      );

      act(() => result.current.handlers.handleDrop(3));

      expect(result.current.context.structure).toEqual(['Verse 1', 'Verse 2', 'Pre-Chorus 1', 'Chorus 1']);
      expect(result.current.context.song.map(section => section.name)).toEqual(['Verse 1', 'Verse 2', 'Pre-Chorus 1', 'Chorus 1']);
    });

    it('moves a pre-chorus and final chorus pair together when dragging the final chorus', () => {
      const song = [
        makeSection('s1', 'Verse 1'),
        makeSection('s2', 'Pre-Chorus 3'),
        makeSection('s3', 'Final Chorus'),
        makeSection('s4', 'Outro'),
      ];

      const { result } = buildHook(
        song,
        song.map(section => section.name),
        { draggedItemIndex: 2 },
      );

      act(() => result.current.handlers.handleDrop(3));

      expect(result.current.context.structure).toEqual(['Verse 1', 'Outro', 'Pre-Chorus 3', 'Final Chorus']);
      expect(result.current.context.song.map(section => section.name)).toEqual(['Verse 1', 'Outro', 'Pre-Chorus 3', 'Final Chorus']);
    });
  });
});
