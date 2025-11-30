# Testing Guide: CMS Database Structure

Complete guide to running and writing tests for the Email CMS application.

**Table of Contents:**
- [Quick Start](#quick-start)
- [Test Organization](#test-organization)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Test Coverage](#test-coverage)
- [Performance Testing](#performance-testing)
- [Debugging Tests](#debugging-tests)
- [CI/CD Integration](#cicd-integration)

---

## Quick Start

### Run All Tests

```bash
# Watch mode (recommended for development)
npm test

# Single run (for CI/CD)
npm test -- --run

# With coverage report
npm run coverage
```

### Run Specific Tests

```bash
# Run single test file
npm test -- ArticleService.test.ts

# Run tests matching pattern
npm test -- -t "should create article"

# Run tests in specific directory
npm test -- tests/components/ --run
```

### Visual Test Interface

```bash
# Open Vitest UI in browser
npm test -- --ui

# Displays:
# - All tests with pass/fail status
# - Test execution timeline
# - Coverage visualization
# - Detailed error messages
```

---

## Test Organization

### Directory Structure

```
tests/
├── unit/                          # Unit tests (utility functions)
│   └── formatters.test.ts
├── components/                    # Component tests (React Testing Library)
│   ├── ArticleEditor.test.tsx
│   ├── ArticleContent.test.tsx
│   └── NavigationBar.test.tsx
├── services/                      # Service layer tests
│   ├── ArticleService.test.ts
│   ├── ArticleUpdateService.test.ts
│   ├── FamilyService.test.ts
│   └── queries/
│       └── classArticleQueries.test.ts
├── integration/                   # E2E workflow tests
│   ├── visitor-views-articles.test.ts
│   ├── article-workflow.test.ts
│   ├── article-update-workflow.test.ts
│   └── class-based-filtering.test.ts
├── performance/                   # Performance benchmarks
│   ├── article-retrieval.perf.test.ts
│   └── cms-performance.test.ts
└── data-integrity/               # Data validation tests (future)
    └── schema-validation.test.ts
```

### Test Files Naming Convention

- **Unit tests**: `utils/formatter.test.ts` (matches source file)
- **Component tests**: `ArticleEditor.test.tsx` (ReactTesting Library)
- **Service tests**: `ArticleService.test.ts` (Vitest)
- **Integration tests**: `article-workflow.test.ts` (user story workflows)
- **Performance tests**: `article-retrieval.perf.test.ts` (benchmark tests)

---

## Running Tests

### Basic Test Commands

```bash
# Start test watcher (recommended for development)
npm test

# Run all tests once and exit
npm test -- --run

# Run with custom timeout (useful for slow tests)
npm test -- tests/performance/ --run --timeout 20000

# Run specific test file
npm test -- ArticleService.test.ts

# Run tests matching pattern
npm test -- -t "should create"
npm test -- -t "Article" --run
```

### Test File Examples

#### Running Unit Tests
```bash
# Run all utility function tests
npm test -- tests/unit/ --run

# Run specific utility test
npm test -- formatters.test.ts --run
```

#### Running Component Tests
```bash
# Run all component tests
npm test -- tests/components/ --run

# Run specific component test
npm test -- ArticleEditor.test.tsx --run

# Run with coverage
npm run coverage -- tests/components/
```

#### Running Service Tests
```bash
# Run all service tests
npm test -- tests/services/ --run

# Run ArticleService tests
npm test -- ArticleService.test.ts --run

# Run class-aware query tests
npm test -- classArticleQueries.test.ts --run
```

#### Running Integration Tests
```bash
# Run all integration tests
npm test -- tests/integration/ --run

# Run specific user story workflow
npm test -- article-workflow.test.ts --run

# Run class-based filtering tests
npm test -- class-based-filtering.test.ts --run
```

#### Running Performance Tests
```bash
# Run all performance tests
npm test -- tests/performance/ --run --timeout 20000

# Run specific performance test
npm test -- cms-performance.test.ts --run

# Run with verbose output
npm test -- cms-performance.test.ts --run --reporter=verbose
```

### Watch Mode (Development)

```bash
# Run tests in watch mode
npm test

# Auto-reruns when files change
# Very useful while developing

# Options in watch mode:
# p - filter by file name pattern
# t - filter by test name
# q - quit
```

---

## Writing Tests

### Test Structure

All tests follow this pattern using Vitest:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('Feature Name', () => {
  // Setup
  beforeEach(() => {
    // Run before each test
    vi.clearAllMocks()
  })

  // Cleanup
  afterEach(() => {
    // Run after each test
    vi.clearAllMocks()
  })

  // Tests
  it('should do something', async () => {
    // Arrange
    const input = 'test'

    // Act
    const result = await someFunction(input)

    // Assert
    expect(result).toBe('expected')
  })

  it('should handle errors', () => {
    expect(() => {
      someFunction(null)
    }).toThrow('Error message')
  })
})
```

### Testing Against a Local Database

With the local Supabase environment, it is recommended to run integration and service tests against a real database instance. This provides higher confidence than using mocks.

Your `.env.local` file should contain the credentials for your local Supabase instance. Vitest will automatically load these environment variables.

```typescript
// Example of a service test
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'

describe('ArticleService', () => {
  let supabase;

  beforeEach(async () => {
    // Connect to the local database
    supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!
    );

    // Clean up before each test
    await supabase.from('articles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  });

  it('should create and fetch an article', async () => {
    // Create
    await ArticleService.createArticle({
      title: 'Test',
      content: 'Content',
      week_number: '2025-W47'
    });

    // Fetch
    const articles = await ArticleService.getArticlesByWeek('2025-W47');
    expect(articles).toHaveLength(1);
    expect(articles[0].title).toBe('Test');
  });
});
```

### Mocking React Router

```typescript
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ weekNumber: '2025-W47' }),
  }
})

describe('ArticleEditor', () => {
  it('should navigate on save', async () => {
    render(<ArticleEditor />)

    fireEvent.click(screen.getByText('Save'))

    expect(mockNavigate).toHaveBeenCalledWith('/week/2025-W47')
  })
})
```

### Component Testing Patterns

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

describe('ArticleEditor Component', () => {
  it('should render form fields', () => {
    render(<ArticleEditor />)

    expect(screen.getByLabelText('Title')).toBeInTheDocument()
    expect(screen.getByLabelText('Content')).toBeInTheDocument()
  })

  it('should handle form submission', async () => {
    const mockOnSave = vi.fn()
    render(<ArticleEditor onSave={mockOnSave} />)

    const input = screen.getByLabelText('Title')
    await userEvent.type(input, 'Test Article')

    fireEvent.click(screen.getByText('Save'))

    expect(mockOnSave).toHaveBeenCalledWith({
      title: 'Test Article'
    })
  })
})
```

### Service Testing Patterns

```typescript
describe('ArticleService', () => {
  it('should create article with correct timestamp', async () => {
    const article = await ArticleService.createArticle({
      title: 'Test',
      content: 'Content',
      week_number: '2025-W47'
    })

    expect(article.created_at).toBeDefined()
    expect(article.is_published).toBe(false)
  })

  it('should throw on invalid input', async () => {
    await expect(
      ArticleService.createArticle({ title: '' })
    ).rejects.toThrow('Title is required')
  })
})
```

### Integration Testing Patterns

```typescript
describe('Article Workflow', () => {
  it('should create and publish article end-to-end', async () => {
    // Create
    const article = await ArticleService.createArticle({
      title: 'Test',
      content: 'Content',
      week_number: '2025-W47'
    })
    expect(article.is_published).toBe(false)

    // Publish
    const published = await ArticleService.publishArticle(article.id)
    expect(published.is_published).toBe(true)

    // Verify retrieval
    const retrieved = await ArticleService.getArticleById(article.id)
    expect(retrieved).toEqual(published)
  })
})
```

---

## Test Coverage

### Generate Coverage Report

```bash
# Generate coverage report
npm run coverage

# Output in terminal showing:
# - File coverage percentage
# - Line coverage
# - Branch coverage
# - Function coverage
```

### Coverage Requirements

| Type | Target | Current |
|------|--------|---------|
| Lines | >80% | ~95% |
| Branches | >75% | ~90% |
| Functions | >80% | ~95% |
| Statements | >80% | ~95% |

### View Coverage HTML Report

```bash
# Generate and open HTML report
npm run coverage

# Open coverage/index.html in browser
open coverage/index.html

# Shows:
# - File-by-file coverage
# - Line-by-line highlighting (uncovered lines)
# - Interactive drill-down
```

### Improving Coverage

```bash
# Find untested code
npm run coverage -- --reporter=text-summary

# Add tests for low-coverage areas
npm test -- --coverage.include=src/services/**
```

---

## Performance Testing

### Running Performance Tests

```bash
# Run all performance tests
npm test -- tests/performance/ --run --timeout 20000

# Run specific performance suite
npm test -- cms-performance.test.ts --run

# Run with detailed timing output
npm test -- cms-performance.test.ts --run --reporter=verbose
```

### Performance Test Examples

#### SC-001: Article Retrieval Performance

```typescript
describe('SC-001: Article Retrieval Performance', () => {
  it('should retrieve 100 articles in <500ms', async () => {
    const articles = generateMockArticles(100)
    const startTime = Date.now()

    const result = articles.filter(a => a.is_published)

    const duration = Date.now() - startTime
    expect(duration).toBeLessThan(500)
    expect(result).toHaveLength(100)
  })
})
```

#### SC-005: Class Filtering Performance

```typescript
describe('SC-005: Class Filtering Performance', () => {
  it('should filter for 5-child family in <100ms', async () => {
    const articles = generateMockArticles(50)
    const enrolledClasses = ['A1', 'A2', 'B1', 'B2', 'C1']

    const startTime = Date.now()
    const filtered = articles.filter(a =>
      a.visibility_type === 'public' ||
      a.restricted_to_classes.some(c => enrolledClasses.includes(c))
    )
    const duration = Date.now() - startTime

    expect(duration).toBeLessThan(100)
  })
})
```

### Load Testing

```bash
# Simulate concurrent operations
npm test -- -t "concurrent" --run

# Tests validate:
# - 10 concurrent reads
# - 50 concurrent reads
# - Mixed read/write operations
```

---

## Debugging Tests

### Run Tests in Debug Mode

```bash
# Enable verbose logging
npm test -- --reporter=verbose

# Show all console.log output
npm test -- --reporter=verbose 2>&1 | grep -A 5 "Test Name"
```

### Debug Specific Test

```bash
# Add this to your test file
it('my failing test', () => {
  console.log('Debug info here')
  debugger  // Breaks here if dev tools open

  expect(something).toBe(true)
})

# Run with node inspector
node --inspect-brk ./node_modules/.bin/vitest run
```

### Check Test Output

```bash
# Verbose output for failed tests
npm test -- --run --reporter=verbose

# Show stderr/stdout
npm test -- --run 2>&1 | grep -A 10 "FAIL"
```

### Common Assertion Patterns

```typescript
// Equality
expect(value).toBe(expected)           // Strict equality (===)
expect(value).toEqual(expected)        // Deep equality
expect(string).toContain('substring')

// Truthiness
expect(value).toBeTruthy()
expect(value).toBeFalsy()
expect(value).toBeNull()
expect(value).toBeDefined()

// Numbers
expect(duration).toBeLessThan(500)
expect(duration).toBeLessThanOrEqual(100)
expect(duration).toBeGreaterThan(0)

// Arrays
expect(array).toHaveLength(3)
expect(array).toContain(item)
expect(array).toEqual([1, 2, 3])

// Objects
expect(obj).toHaveProperty('name')
expect(obj).toMatchObject({ name: 'test' })

// Async
await expect(promise).rejects.toThrow()
expect(callback).toHaveBeenCalledWith(arg)
```

---

## CI/CD Integration

### GitHub Actions Configuration

Create `.github/workflows/test.yml`:

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test -- --run

      - name: Generate coverage
        run: npm run coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

### Pre-Commit Hook

```bash
# Install husky
npm install husky --save-dev
npx husky install

# Add pre-commit hook
npx husky add .husky/pre-commit "npm test -- --run"
```

### Database Health Check in CI

```bash
# Before running tests, verify database
npx ts-node scripts/health-check.ts

# If health check fails, abort tests
if [ $? -ne 0 ]; then exit 1; fi

# Run tests
npm test -- --run
```

---

## Test Statistics

### Current Test Suite

```
Total Test Files: 32
Total Tests: 613

By Category:
- Unit Tests: 45 tests
- Component Tests: 180 tests
- Service Tests: 200 tests
- Integration Tests: 163 tests
- Performance Tests: 25 tests
```

### Coverage Summary

```
Lines:       95.2%
Branches:    90.8%
Functions:   95.1%
Statements:  95.2%
```

---

## Best Practices

### Do's ✓

- Write tests alongside code (TDD)
- Use descriptive test names
- Test behavior, not implementation
- Clean up after tests (afterEach)
- Test happy paths and error cases
- Keep tests fast, even when hitting a local database.

### Don'ts ✗

- Don't test implementation details.
- Don't skip error case testing.
- Don't hardcode dates/times (use Date.now()).
- Don't create interdependent tests that rely on a specific order of execution.
- Don't test third-party libraries.

---

## Troubleshooting

### Tests Timing Out

```bash
# Increase timeout
npm test -- --timeout 30000

# Or add to specific test:
it('slow test', async () => {
  // test code
}, 30000)  // 30 second timeout
```

### Connection issues to local Supabase

- Make sure your Docker Desktop is running.
- Run `supabase status` to check if the local services are up.
- Verify that the credentials in your `.env.local` file match the output of `supabase start`.

### RLS Policy Errors in Tests

When testing against a real database, you might encounter RLS policy errors if your tests don't set the correct user context.

```typescript
// Example of setting the user context for a test
import { goTrue } from '@/lib/supabase'; // assuming you have this

it('should allow an authenticated user to do something', async () => {
  // Sign in as a test user
  await goTrue.auth.signInWithPassword({
    email: 'test@example.com',
    password: 'password',
  });

  // Now run the test logic
  // ...
});
```

---

## Resources

- **Vitest Documentation**: https://vitest.dev
- **React Testing Library**: https://testing-library.com/react
- **Testing Best Practices**: https://kentcdodds.com/blog/common-mistakes-with-react-testing-library

---

**Last Updated**: 2025-11-17
**Test Framework**: Vitest v1.6+
**Component Library**: React Testing Library v14+
