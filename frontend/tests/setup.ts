import { vi } from 'vitest'

// Real Vue, real content. The only thing stubbed is what jsdom lacks.
Object.defineProperty(window, 'open', { writable: true, value: vi.fn() })
Object.defineProperty(window, 'scrollTo', { writable: true, value: vi.fn() })
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
})
