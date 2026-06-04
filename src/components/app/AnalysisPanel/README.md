# AnalysisPanel Component Structure

This directory contains the refactored AnalysisPanel component, split into logical modules for better maintainability.

## File Structure

```
AnalysisPanel/
├── index.tsx                  # Public export
├── AnalysisPanel.tsx          # Main orchestrator component (layout + tab coordination)
├── SkeletonComponents.tsx     # Loading skeleton states for all tabs
├── MicroComponents.tsx        # Small reusable UI components
├── InsightsTab.tsx            # KPI overview tab
├── AnalysisTab.tsx            # Rhyme schema & density analysis tab
└── SimilarityTab.tsx          # Pairwise similarity tab
```

## Component Responsibilities

### AnalysisPanel.tsx (Main Component)
- **Line count**: ~180 lines (reduced from 543)
- **Responsibility**: Layout orchestration and tab coordination
- **Contains**:
  - Panel layout and animations
  - Header with close button and status indicators
  - Tab navigation
  - Tab content routing
  - Error display
  - Computation time display

### SkeletonComponents.tsx
- **Responsibility**: Loading states for all tabs
- **Contains**:
  - `SkeletonBar` - Base skeleton primitive
  - `InsightsTabSkeleton` - Mirrors InsightsTab layout
  - `AnalysisTabSkeleton` - Mirrors AnalysisTab layout
  - `SimilarityTabSkeleton` - Mirrors SimilarityTab layout

### MicroComponents.tsx
- **Responsibility**: Reusable UI elements
- **Contains**:
  - `KpiCard` - Key performance indicator display
  - `SectionInsightCard` - Section statistics card
  - `SchemaDisplay` - Rhyme schema with confidence
  - `DensityBar` - Phonological density visualization
  - `EmptyState` - Empty content placeholder
  - `rhymeTypeColor()` - Badge color mapping utility

### InsightsTab.tsx
- **Responsibility**: KPI overview display
- **Contains**: Total counts (lines, syllables, words) and per-section breakdowns

### AnalysisTab.tsx
- **Responsibility**: Phonological analysis display
- **Contains**: Schema detection, assonance/alliteration density, rhyme type badges, line-by-line metrics

### SimilarityTab.tsx
- **Responsibility**: Line similarity matrix
- **Contains**: Top 30 phonological similarity pairs with scores and text snippets

## Architecture Principles

### Pure Presentational Pattern
All components in this directory are **pure observers**:
- ✅ Receive all data via props (no store hooks)
- ✅ No business logic or calculations
- ✅ No mutations of song state
- ✅ No participation in UNDO/REDO stack
- ✅ Computation happens in Web Worker (`useLinguisticsWorker`)

### Data Flow
```
AppEditorLayout
  └─ useEditorState()
      └─ useLinguisticsWorker()
          └─ linguistics.worker.ts (heavy computation)
              └─ AnalysisResult
                  └─ AnalysisPanel (pure observer)
                      ├─ InsightsTab
                      ├─ AnalysisTab
                      └─ SimilarityTab
```

### Benefits of Refactoring
1. **Maintainability**: Each file has a single, clear responsibility
2. **Testability**: Components can be tested in isolation
3. **Reusability**: Micro-components can be reused across tabs
4. **Readability**: Main component is now ~180 lines instead of 543
5. **Code Splitting**: Better potential for lazy loading individual tabs

## Usage

Import from the directory (index.tsx handles the export):

```tsx
import { AnalysisPanel } from './components/app/AnalysisPanel';

// Use as before - the API is unchanged
<AnalysisPanel
  result={linguisticsWorker.result}
  isComputing={linguisticsWorker.isComputing}
  error={linguisticsWorker.error}
  onClose={handleCloseAnalysisPanel}
  isMobileOverlay={isMobileOrTablet}
/>
```
