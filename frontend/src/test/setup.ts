import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

// jsdom logs "Not implemented" for scrollTo, which motion calls when it
// measures height: "auto" animations. Nothing in tests needs real scrolling.
window.scrollTo = (() => undefined) as typeof window.scrollTo;

// jsdom has no IntersectionObserver, which motion's in-view animations use.
// Report every observed element as visible so entrance animations complete.
if (!("IntersectionObserver" in globalThis)) {
  class VisibleIntersectionObserver {
    readonly root = null;
    readonly rootMargin = "0px";
    readonly thresholds = [0];

    constructor(private readonly callback: IntersectionObserverCallback) {}

    observe(target: Element) {
      const rect = target.getBoundingClientRect();
      this.callback(
        [
          {
            target,
            isIntersecting: true,
            intersectionRatio: 1,
            boundingClientRect: rect,
            intersectionRect: rect,
            rootBounds: null,
            time: 0,
          },
        ],
        this as unknown as IntersectionObserver,
      );
    }

    unobserve() {}

    disconnect() {}

    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }

  globalThis.IntersectionObserver =
    VisibleIntersectionObserver as unknown as typeof IntersectionObserver;
}
