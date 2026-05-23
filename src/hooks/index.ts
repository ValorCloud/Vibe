/**
 * Root barrel — re-exports all feature barrels.
 * Prefer feature-specific imports in production code:
 *   import { useEditorState } from '@/hooks/editor';
 * Use this root barrel only in tests or one-off scripts.
 */
export * from './editor';
export * from './session';
export * from './library';
export * from './analysis';
export * from './composer';
export * from './shared';
