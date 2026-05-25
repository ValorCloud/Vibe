import { Section } from '../types';
import { DEFAULT_STRUCTURE } from '../constants/editor';
import { generateId } from './idUtils';

export { DEFAULT_TITLE, DEFAULT_TOPIC, DEFAULT_MOOD } from '../constants/editor';

export type VersionSnapshot = {
  song: Section[];
  structure: string[];
  title: string;
  titleOrigin: 'user' | 'ai';
  topic: string;
  mood: string;
  musicalPrompt?: string;
};

export const getDefaultLineCount = (name: string) =>
  name.toLowerCase().includes('verse') || name.toLowerCase().includes('bridge') ? 6 : 4;

export const createEmptySong = (structure: string[], defaultRhymeScheme: string): Section[] =>
  structure.map(name => ({
    id: generateId(),
    name,
    rhymeScheme: defaultRhymeScheme,
    lines: Array(getDefaultLineCount(name))
      .fill(null)
      .map(() => ({ id: generateId(), text: '', rhymingSyllables: '', rhyme: '', syllables: 0, concept: 'New line' })),
  }));

export const isPristineLine = (line: Section['lines'][number]) => (
  line.text === '' && line.rhymingSyllables === '' && line.rhyme === ''
  && line.syllables === 0 && line.concept === 'New line'
);

export const isPristineSection = (section: Section, structureName: string, defaultRhymeScheme: string) => (
  section.name === structureName
  && (section.rhymeScheme ?? defaultRhymeScheme) === defaultRhymeScheme
  && (!section.preInstructions || section.preInstructions.length === 0)
  && (!section.postInstructions || section.postInstructions.length === 0)
  && section.lines.length === getDefaultLineCount(section.name)
  && section.lines.every(isPristineLine)
);

export const isPristineDraft = (song: Section[], structure: string[], defaultRhymeScheme: string) => (
  structure.length === DEFAULT_STRUCTURE.length
  && structure.every((name, index) => name === DEFAULT_STRUCTURE[index])
  && song.length === structure.length
  && song.every((section, sectionIndex) => isPristineSection(section, structure[sectionIndex] ?? '', defaultRhymeScheme))
);
