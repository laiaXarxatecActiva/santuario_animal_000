import { vi } from 'vitest';

/**
 * jsdom no implementa IntersectionObserver. Este sustituto avisa de que todo
 * lo observado está a la vista en cuanto se observa.
 */
export function stubIntersectionObserverVisible() {
  class Visible {
    constructor(private readonly callback: IntersectionObserverCallback) {}
    observe(target: Element) {
      this.callback(
        [{ isIntersecting: true, target } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      );
    }
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal('IntersectionObserver', Visible);
}
