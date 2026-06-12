import { useState, useCallback, useRef } from 'react';
import { Section, SectionVersion } from '../types';
import { generateId } from '../utils/idUtils';

/** Hard cap on stored per-section versions to prevent unbounded memory growth. */
const MAX_SECTION_VERSIONS = 20;

/**
 * djb2 hash — fast non-cryptographic string hash.
 */
function djb2(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
    h = h >>> 0;
  }
  return h;
}

/**
 * Builds a structural fingerprint for a single section to detect changes.
 */
const fingerprintSection = (section: Section): string => {
  const linePrint = section.lines
    .map((line) => [
      line.id,
      djb2(line.text),
      line.rhymingSyllables ?? '',
      line.rhyme ?? '',
      String(line.syllables ?? 0),
      djb2(line.concept ?? ''),
      line.isMeta ? '1' : '0',
    ].join(':'))
    .join('|');

  return [
    section.id,
    djb2(section.name ?? ''),
    section.language ?? '',
    section.rhymeScheme ?? '',
    linePrint,
  ].join('::');
};

/**
 * Deep-clones a Section via JSON round-trip.
 * Returns null if the payload contains non-serialisable values.
 */
const deepCloneSection = (section: Section): Section | null => {
  try {
    return JSON.parse(JSON.stringify(section)) as Section;
  } catch {
    return null;
  }
};

interface UseSectionVersionManagerParams {
  initialVersions?: Record<string, SectionVersion[]> | undefined;
}

/**
 * Hook for managing per-section version history.
 * Each section maintains its own independent version stack.
 * Version names are auto-generated: SECTION_NAME-vXXX or SECTION_NAME-auto
 */
export function useSectionVersionManager(params: UseSectionVersionManagerParams = {}) {
  const [sectionVersions, setSectionVersions] = useState<Record<string, SectionVersion[]>>(
    () => params.initialVersions ?? {}
  );

  const sectionFingerprintsRef = useRef<Record<string, string>>({});

  /**
   * Create a new version snapshot for a section.
   * Name is auto-generated from section name + incremented version counter.
   * isAutoSave versions use the suffix "-auto" instead of "-vXXX".
   */
  const createSectionVersion = useCallback((
    section: Section,
    options?: { allowDuplicate?: boolean; isAutoSave?: boolean }
  ) => {
    const clonedSection = deepCloneSection(section);
    if (clonedSection === null) {
      console.warn('Failed to clone section for versioning:', section.id);
      return;
    }

    setSectionVersions(prev => {
      const sectionId = section.id;
      const existingVersions = prev[sectionId] || [];

      // Check for duplicate if not explicitly allowed
      if (!options?.allowDuplicate && existingVersions.length > 0) {
        const latestVersion = existingVersions[0];
        if (latestVersion) {
          const normalizedLatest = JSON.stringify(latestVersion.section);
          const normalizedNew = JSON.stringify(clonedSection);
          if (normalizedLatest === normalizedNew) {
            return prev; // Skip duplicate
          }
        }
      }

      // Auto-generate version name from section name + counter
      const baseName = (section.name || 'SECTION').replace(/\s+/g, '_').toUpperCase();

      let name: string;
      if (options?.isAutoSave) {
        name = `${baseName}-auto`;
      } else {
        // Find the highest existing vXXX number for this section
        const numbers = existingVersions
          .map(v => {
            const match = v.name.match(/-v(\d+)$/);
            // match[1] is string | undefined with noUncheckedIndexedAccess
            return match ? parseInt(match[1] ?? '', 10) : 0;
          });
        const nextNum = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
        name = `${baseName}-v${String(nextNum).padStart(3, '0')}`;
      }

      const newVersion: SectionVersion = {
        id: generateId(),
        timestamp: Date.now(),
        sectionId: section.id,
        sectionName: section.name,
        section: clonedSection,
        name,
        isAutoSave: options?.isAutoSave ?? false,
      };

      const updatedVersions = [newVersion, ...existingVersions];
      const trimmedVersions = updatedVersions.length > MAX_SECTION_VERSIONS
        ? updatedVersions.slice(0, MAX_SECTION_VERSIONS)
        : updatedVersions;

      return {
        ...prev,
        [sectionId]: trimmedVersions,
      };
    });
  }, []);

  /**
   * Get all versions for a specific section.
   */
  const getSectionVersions = useCallback((sectionId: string): SectionVersion[] => {
    return sectionVersions[sectionId] || [];
  }, [sectionVersions]);

  /**
   * Save a manual version snapshot. Name is auto-generated (SECTION-vXXX).
   */
  const saveSectionVersion = useCallback((section: Section) => {
    createSectionVersion(section, { allowDuplicate: true, isAutoSave: false });
  }, [createSectionVersion]);

  /**
   * Auto-save: create a restore point before section changes.
   * Only triggers when the fingerprint changes. Name: SECTION-auto.
   */
  const autoSaveSectionVersion = useCallback((section: Section) => {
    if (section.lines.length === 0) return;

    const currentFingerprint = fingerprintSection(section);
    const lastFingerprint = sectionFingerprintsRef.current[section.id];

    if (lastFingerprint && lastFingerprint !== currentFingerprint) {
      createSectionVersion(section, { allowDuplicate: false, isAutoSave: true });
    }

    sectionFingerprintsRef.current[section.id] = currentFingerprint;
  }, [createSectionVersion]);

  /**
   * Delete a specific version.
   */
  const deleteSectionVersion = useCallback((sectionId: string, versionId: string) => {
    setSectionVersions(prev => {
      const versions = prev[sectionId] || [];
      const filtered = versions.filter(v => v.id !== versionId);
      if (filtered.length === 0) {
        const { [sectionId]: _, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [sectionId]: filtered,
      };
    });
  }, []);

  /**
   * Clear all versions for a specific section.
   */
  const clearSectionVersions = useCallback((sectionId: string) => {
    setSectionVersions(prev => {
      const { [sectionId]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  /**
   * Get count of versions for a section.
   */
  const getSectionVersionCount = useCallback((sectionId: string): number => {
    return (sectionVersions[sectionId] || []).length;
  }, [sectionVersions]);

  return {
    sectionVersions,
    getSectionVersions,
    saveSectionVersion,
    autoSaveSectionVersion,
    deleteSectionVersion,
    clearSectionVersions,
    getSectionVersionCount,
  };
}
