# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Email CMS Newsletter Viewer** - A modern React 18 + TypeScript application for reading and managing email newsletters organized by week. Currently in Phase 7 of development (Polish & Cross-Cutting Concerns).

- **Tech Stack**: React 18, TypeScript 5, Vite 5, Tailwind CSS 3, Vitest, React Router v6, Supabase, PostgreSQL
- **Current Branch**: `002-database-structure`
- **Implementation Status**: Phases 1-7 complete (100% - 44/44 tasks), 697 tests passing, 95%+ coverage

## Development Commands

### Essential Commands
```bash
npm run dev           # Start dev server (http://localhost:5173 with HMR)
npm test              # Run tests in watch mode
npm test -- --run     # Run tests once and exit (use for CI/verification)
npm run build         # Build for production (runs TypeScript check + Vite build)
npm run preview       # Preview production build locally
npm run lint          # ESLint check on src/ and tests/
npm run format        # Prettier format files
npm run coverage      # Test coverage report
npm test:ui           # Vitest UI (visual test interface)
```

### Useful Test Commands
```bash
npm test -- NavigationBar.test.tsx          # Run single test file
npm test -- -t "should render"              # Run tests matching pattern
npm test -- tests/components/ --run         # Run component tests once
npm test -- --ui                            # Open visual test interface
```

### Path Aliases
The project uses `@` alias for `src/` directory:
```typescript
import { NavigationBar } from '@/components/NavigationBar'  // resolves to src/components/NavigationBar
```

## Architecture

### Three-Layer Architecture
```
Pages (WeeklyReaderPage)
    ↓ (state management, interaction logic)
Components (ArticleListView, ArticleContent, NavigationBar, SideButton)
    ↓ (rendering, props-based logic)
Services & Context (mockApi, markdownService, NavigationContext)
    ↓ (data fetching, state management, transformations)
```

### Key Directories
- **src/components/** - Reusable UI components (test files: `tests/components/`)
- **src/pages/** - Page-level components and layout (test files: `tests/integration/`)
- **src/services/** - Business logic: mockApi.ts, markdownService.ts
- **src/context/** - Global state: NavigationContext.tsx (React Context API)
- **src/types/** - TypeScript type definitions (centralized in index.ts)
- **src/utils/** - Helper functions: urlUtils.ts, formatters.ts
- **src/hooks/** - Custom React hooks for data fetching
- **src/styles/** - Global styles with Tailwind CSS

### State Management
Uses **React Context API** (lightweight, no Redux needed):
```typescript
// NavigationContext provides:
- currentWeekNumber: string
- currentArticleId: string
- currentArticleOrder: number
- totalArticlesInWeek: number
- articleList: Article[]
- isLoading: boolean
```

## Testing

- When running `npm test`, and needs timeout, always use `timeout 20`

### Test Structure
- **Unit tests**: `tests/unit/` (TypeScript utilities)
- **Component tests**: `tests/components/` (React Testing Library)
- **Integration tests**: `tests/integration/` (user story workflows)
- **Performance tests**: `tests/performance/` (benchmark tests)

### Test Framework & Libraries
- **Framework**: Vitest (Jest-compatible, uses jsdom)
- **Component testing**: @testing-library/react (render, screen, fireEvent)
- **User interactions**: @testing-library/user-event (userEvent.setup())
- **Mocking**: vi.fn(), vi.mock() (Vitest built-in)

### Testing Best Practices
1. **Mocking Hooks**: When testing components using React Router hooks (useNavigate, useParams), mock the hook at module level:
   ```typescript
   vi.mock('react-router-dom', async () => {
     const actual = await vi.importActual('react-router-dom')
     return { ...actual, useNavigate: () => mockNavigate }
   })
   ```
2. **Component Setup**: Tests render components in isolation with mock props
3. **Event Testing**: Use fireEvent for keyboard events, userEvent for user interactions
4. **Cleanup**: Use beforeEach/afterEach hooks to clear mocks

## Key Components

### NavigationBar (T052 - Keyboard Navigation)
- **File**: `src/components/NavigationBar.tsx`
- **Test**: `tests/components/NavigationBar.test.tsx`
- **Features**:
  - Previous/Next buttons with disabled states
  - Position indicator ("第 X 篇，共 Y 篇")
  - Keyboard shortcuts:
    - Previous: Left Arrow, 'p', 'k'
    - Next: Right Arrow, 'n', 'j'
    - Edit: 'e' → navigates to `/editor/{weekNumber}`
  - Uses `useNavigate()` from react-router-dom
- **25 tests**: button states, keyboard navigation, event prevention

### ArticleContent
- **File**: `src/components/ArticleContent.tsx`
- **Uses**: Markdown rendering via markdownService.ts
- **Memoization**: Uses React.memo and useMemo for performance optimization

### ArticleListView & ArticleCard
- **Files**: `src/components/ArticleListView.tsx`, `src/components/ArticleCard.tsx`
- **Features**: Article list with selection, card rendering with metadata

### WeeklyReaderPage
- **File**: `src/pages/WeeklyReaderPage.tsx`
- **Role**: Main page component coordinating all UI elements and state

## Common Patterns

### Working with NavigationState
```typescript
import { NavigationState } from '@/types'

// NavigationState includes:
interface NavigationState {
  currentWeekNumber: string      // '2025-W43'
  currentArticleId: string       // article ID
  currentArticleOrder: number    // 1-based index
  totalArticlesInWeek: number
  articleList: Article[]
  isLoading: boolean
}
```

### Handling Routes
Routes are defined in `src/App.tsx`:
- `/` - Home page
- `/week/:weekNumber` - Weekly reader
- `/article/:articleId` - Article view (redirects to reader)
- `/newsletter/:weekNumber` - Newsletter reader (alternative route)
- `/editor/:weekNumber` - Article editor (edits all articles for that week)
- `/error` - Error page

### Mock Data
- **Location**: `src/services/mockApi.ts`
- **Functions**: fetchWeeklyNewsletter(), fetchArticle(), updateArticle(), deleteArticle()
- **To change sample data**: Edit mockArticles and mockNewsletters objects in mockApi.ts

## Current Development Focus (Phase 7: Polish & Cross-Cutting Concerns)

### Recently Completed Tasks (Phase 7)
- ✅ **T036-T040** - Phase 6 components (ArticleEditor, ArticleClassRestrictionEditor, ClassArticleFilter)
- ✅ **T041** - API.md documentation (1060 lines, comprehensive endpoint docs)
- ✅ **T042** - E2E test suite (18 tests covering complete workflows)
- ✅ **T043** - Data integrity tests (36 tests validating constraints)
- ✅ **T044** - README.md Phase 6-7 documentation

### Recently Completed Documentation Organization
- ✅ **Moved SETUP.md** to `specs/002-database-structure/SETUP.md`
- ✅ **Moved TESTING.md** to `specs/002-database-structure/TESTING.md`
- ✅ **Updated cross-references** in README.md and all documentation files
- ✅ **All documentation consolidated** in feature specification folder

### Phase 8+ Planned Tasks
- Database write operations (create/update week, class, family)
- Admin interfaces for content management
- Advanced filtering and search functionality
- Performance optimization at scale

## Important Notes

### Type Safety
- Project is **100% TypeScript** with strict type checking
- All component props have defined interfaces
- NavigationState and Article types are in `src/types/index.ts`
- Use `as const` for string unions where appropriate

### Performance Considerations
- ArticleContent uses React.memo and useMemo for content rendering
- SideButton is memoized for quick navigation
- Navigation changes should complete within 1 second (US3 requirement)
- Article switching: target <100ms individual switch, <300ms back-and-forth

### Code Organization Rules
- Components: One component per file in `src/components/`
- Props interfaces: Defined in component file or in `src/types/` if shared
- Tests: Mirror component structure in `tests/` directory
- Mock data: Centralized in `src/services/mockApi.ts`

### Git Workflow
- Current branch: `002-database-structure`
- Main branch: `001-newsletter-viewer`
- Commit format: `type(scope): description` (e.g., `feat: Add API endpoints` or `docs: Reorganize documentation`)
- Test verification: Run `npm test -- --run` before committing
- All commits include attribution line: `Co-Authored-By: Claude <noreply@anthropic.com>`
- PR target: Main branch `001-newsletter-viewer` when Phase 7 is complete

## Debugging

### Common Issues & Solutions

**Tests failing with useNavigate error**:
- Ensure useNavigate is mocked before component render
- Use `vi.mock('react-router-dom')` at module level, not inside tests
- Call `vi.clearAllMocks()` in beforeEach

**Type errors in tests**:
- Mock props must match the actual component's interface
- Remember to include all required props when rendering components
- Use `vi.fn()` for callback functions

**HMR not working in dev**:
- Check that dev server is running on port 5173
- Clear browser cache or do hard refresh (Cmd+Shift+R)
- Restart dev server if issues persist

## Tailwind CSS Theming

The project uses a custom Waldorf color palette defined in `tailwind.config.ts`:
```
waldorf-sage, waldorf-peach, waldorf-cream, waldorf-clay, waldorf-brown
```

Use these colors consistently across components for visual cohesion.
