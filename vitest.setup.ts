/**
 * Vitest setup file.
 *
 * Loaded for ALL tests (vitest.config.ts setupFiles). The matchers, polyfills,
 * and DOM cleanup only matter for `.test.tsx` files run under jsdom.
 *
 * Why explicit cleanup: Testing Library auto-cleanup is normally registered
 * via the `@testing-library/react` import — but with vitest projects + global
 * setup, the auto-registration order isn't guaranteed, so we register it here
 * explicitly to keep tests isolated (no DOM leakage between tests).
 *
 * Why polyfills: Radix UI primitives (Dialog, RadioGroup, Tooltip) call browser
 * APIs that jsdom doesn't implement. The minimal stubs below are enough for
 * unit-level component rendering and click interactions.
 */
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(() => {
  cleanup();
});

// jsdom polyfills for Radix UI (only applied if `window` exists, i.e. jsdom env).
if (typeof window !== 'undefined') {
  if (!('ResizeObserver' in window)) {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (window as unknown as { ResizeObserver: typeof ResizeObserverStub })
      .ResizeObserver = ResizeObserverStub;
  }

  if (!('IntersectionObserver' in window)) {
    class IntersectionObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
      readonly root = null;
      readonly rootMargin = '';
      readonly thresholds = [];
    }
    (
      window as unknown as { IntersectionObserver: typeof IntersectionObserverStub }
    ).IntersectionObserver = IntersectionObserverStub;
  }

  // Radix RadioGroup uses HTMLElement.hasPointerCapture / scrollIntoView; jsdom
  // doesn't implement them. Stubs are no-ops because we're only testing logic,
  // not pointer-capture behavior.
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
}
