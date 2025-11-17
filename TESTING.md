# Testing Guide

This document describes testing setup and practices for the Email CMS Newsletter Viewer project.

## Test Framework

- **Framework**: Vitest (Jest-compatible, optimized for Vite)
- **Component Testing**: @testing-library/react
- **User Interactions**: @testing-library/user-event
- **Browser Simulation**: jsdom

## Test Structure

```
tests/
├── unit/              # Utility and service tests
├── components/        # React component unit tests
├── integration/       # Feature/workflow integration tests
└── performance/       # Performance benchmarks
```

## Running Tests

### Development (Watch Mode)
```bash
npm test
```

### Single Run (CI/Verification)
```bash
npm test -- --run
```

### Run Specific Test File
```bash
npm test -- components/ArticleContent.test.tsx
```

### Run Tests Matching Pattern
```bash
npm test -- -t "should render"
```

### Generate Coverage Report
```bash
npm run coverage
```

### Visual Test Interface
```bash
npm test -- --ui
```

## Database Testing

### Configuration

Test database credentials are in `.env.test`:
- `VITE_SUPABASE_TEST_URL`: Test project URL
- `VITE_SUPABASE_TEST_KEY`: Test project anon key
- `VITE_TEST_MODE`: Enable test-specific behaviors

### Using Test Database in Tests

```typescript
import { createClient } from '@supabase/supabase-js'

// In your test setup
const testDbUrl = process.env.VITE_SUPABASE_TEST_URL!
const testDbKey = process.env.VITE_SUPABASE_TEST_KEY!
const supabase = createClient(testDbUrl, testDbKey)
```

### Database Cleanup

Tests should clean up after themselves:

```typescript
describe('Articles', () => {
  afterEach(async () => {
    // Clean up test data
    await supabase
      .from('articles')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
  })
})
```

## Test Categories

### Unit Tests
Test individual utility functions and services in isolation.

**Location**: `tests/unit/`

**Example**: Testing date parsing utilities, string formatters

```typescript
import { describe, it, expect } from 'vitest'
import { parseISOWeek } from '@/utils/dateUtils'

describe('parseISOWeek', () => {
  it('should parse valid ISO week format', () => {
    expect(parseISOWeek('2025-W47')).toEqual({ year: 2025, week: 47 })
  })
})
```

### Component Tests
Test React components in isolation with mocked props and dependencies.

**Location**: `tests/components/`

**Example**: Testing NavigationBar component

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { NavigationBar } from '@/components/NavigationBar'

describe('NavigationBar', () => {
  it('should render with props', () => {
    render(
      <NavigationBar
        currentPosition={1}
        totalArticles={5}
        onPrevious={() => {}}
        onNext={() => {}}
        hasNext={true}
        hasPrevious={false}
      />
    )
    expect(screen.getByText(/第 1 篇，共 5 篇/)).toBeInTheDocument()
  })
})
```

### Integration Tests
Test complete user workflows across multiple components.

**Location**: `tests/integration/`

**Example**: Testing weekly newsletter reading flow

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WeeklyReaderPage } from '@/pages/WeeklyReaderPage'
import { BrowserRouter } from 'react-router-dom'

describe('Weekly Reader Workflow', () => {
  it('should navigate between articles', async () => {
    const user = userEvent.setup()
    render(
      <BrowserRouter>
        <WeeklyReaderPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/第 1 篇/)).toBeInTheDocument()
    })

    const nextButton = screen.getByRole('button', { name: /next/i })
    await user.click(nextButton)

    expect(screen.getByText(/第 2 篇/)).toBeInTheDocument()
  })
})
```

### Performance Tests
Benchmark tests for performance-critical operations.

**Location**: `tests/performance/`

**Requirements**: All performance tests must pass before commit
- Article switching: <1000ms
- Data loading: <500ms
- Rendering: <300ms

```typescript
import { performance } from 'perf_hooks'

describe('Performance: Article Switching', () => {
  it('should switch articles in <1 second', async () => {
    const start = performance.now()
    // Perform article switching
    const end = performance.now()
    expect(end - start).toBeLessThan(1000)
  })
})
```

## Mocking Strategies

### Mocking React Router
When testing components that use React Router hooks:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ weekNumber: '2025-W47' })
  }
})
```

### Mocking Supabase Client
When testing components that fetch data:

```typescript
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: mockArticles,
        error: null
      })
    })
  }))
}))
```

### Mocking Services
```typescript
vi.mock('@/services/mockApi', () => ({
  fetchWeeklyNewsletter: vi.fn().mockResolvedValue(mockNewsletter),
  fetchArticle: vi.fn().mockResolvedValue(mockArticle)
}))
```

## Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Clarity**: Test names should clearly describe what is being tested
3. **Arrangement**: Follow AAA pattern (Arrange, Act, Assert)
4. **Cleanup**: Always clean up after tests (unmount components, clear mocks)
5. **Performance**: Keep test execution fast (<10ms per test)
6. **Avoid**: Don't test implementation details, test behavior instead

## Debugging Tests

### Run Single Test
```bash
npm test -- -t "specific test name"
```

### Enable Verbose Output
```bash
npm test -- --reporter=verbose
```

### Debug in Browser
```bash
node --inspect-brk ./node_modules/vitest/vitest.mjs --run
```

### Keep Failing Tests on Screen
```bash
npm test -- --reporter=tap
```

## Continuous Integration

All tests must pass before merging to main:

```bash
npm test -- --run
```

This runs all tests once and exits with code 0 (success) or 1 (failure).

## Common Issues

### Tests Timeout
Add timeout option to test:
```typescript
it('should fetch data', async () => {
  // test code
}, 20000) // 20 second timeout
```

### Component Not Rendering
Ensure mocks are set at module level, not inside tests:
```typescript
// ✅ Correct
vi.mock('react-router-dom', async () => { ... })

// ❌ Wrong (inside describe)
describe('MyTest', () => {
  vi.mock('react-router-dom', async () => { ... })
})
```

### Async Issues
Use `waitFor` for async operations:
```typescript
await waitFor(() => {
  expect(screen.getByText('loaded')).toBeInTheDocument()
})
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Library User Event](https://testing-library.com/docs/user-event/intro/)
