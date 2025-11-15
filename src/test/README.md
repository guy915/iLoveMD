# Test Directory

This directory contains test setup and utilities for the iLoveLLM test suite.

## Files

### setup.ts

Global test setup file that runs before each test file. Configures:

- **Testing Library**: Imports `@testing-library/jest-dom` for DOM matchers
- **Cleanup**: Auto-cleanup React components after each test
- **Browser API Mocks**:
  - `localStorage` - In-memory mock with full Storage API
  - `sessionStorage` - In-memory mock with full Storage API
  - `URL.createObjectURL()` - Returns mock URL string
  - `URL.revokeObjectURL()` - No-op mock
  - `window.matchMedia()` - Mock for media query testing

## Writing Tests

### Test File Location

Place test files next to the code they test:

```
src/
  lib/
    utils/
      formatUtils.ts
      formatUtils.test.ts  ← Test file here
```

### Test File Naming

- Unit tests: `*.test.ts` or `*.spec.ts`
- Component tests: `*.test.tsx` or `*.spec.tsx`

### Example Test

```typescript
import { describe, it, expect } from 'vitest'
import { myFunction } from './myModule'

describe('myFunction', () => {
  it('should do something', () => {
    expect(myFunction('input')).toBe('expected output')
  })
})
```

### Component Testing

```typescript
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import MyComponent from './MyComponent'

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })
})
```

## Running Tests

```bash
# Watch mode (recommended for development)
npm test

# Interactive UI (visual test runner)
npm run test:ui

# Single run (CI mode)
npm run test:run

# With coverage report
npm run test:coverage
```

## Coverage Reports

Coverage reports are generated in the `coverage/` directory:

- `coverage/index.html` - Interactive HTML report
- `coverage/lcov.info` - LCOV format for CI tools
- `coverage/coverage-summary.json` - JSON summary

Open `coverage/index.html` in a browser to view detailed coverage by file.

## Mocking

### Mocking Modules

```typescript
import { vi } from 'vitest'

vi.mock('./myModule', () => ({
  myFunction: vi.fn(() => 'mocked result')
}))
```

### Mocking Fetch (API calls)

Use MSW (Mock Service Worker) for complex API mocking:

```typescript
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

const server = setupServer(
  http.get('/api/data', () => {
    return HttpResponse.json({ data: 'mocked' })
  })
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

### Mocking localStorage

localStorage is already mocked globally in `setup.ts`. It's reset before each test:

```typescript
// Works out of the box
localStorage.setItem('key', 'value')
expect(localStorage.getItem('key')).toBe('value')
```

## Best Practices

1. **Test behavior, not implementation** - Focus on what the code does, not how
2. **Keep tests isolated** - Each test should be independent
3. **Use descriptive test names** - Explain what is being tested
4. **Arrange-Act-Assert** - Structure tests clearly
5. **Mock external dependencies** - Don't make real API calls
6. **Test edge cases** - Null, undefined, empty arrays, errors
7. **Maintain coverage** - Aim for 70%+ overall, 80%+ for utilities

## Debugging Tests

### Run specific test file

```bash
npm test -- formatUtils.test.ts
```

### Run tests matching pattern

```bash
npm test -- -t "should format file size"
```

### Enable verbose output

```bash
npm test -- --reporter=verbose
```

### Debug in VS Code

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Vitest Tests",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "test:run"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library Docs](https://testing-library.com/docs/react-testing-library/intro/)
- [MSW Documentation](https://mswjs.io/)
- [jest-dom Matchers](https://github.com/testing-library/jest-dom)
