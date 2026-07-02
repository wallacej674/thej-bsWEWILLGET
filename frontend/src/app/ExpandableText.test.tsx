import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ExpandableText } from "./App";

describe("ExpandableText", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("remeasures overflow when responsive layout changes its height", () => {
    let measuredHeight = 100;
    let resizeCallback: ResizeObserverCallback | undefined;
    const observer = {
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    };
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(
      () => measuredHeight,
    );
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          resizeCallback = callback;
        }

        observe = observer.observe;
        unobserve = observer.unobserve;
        disconnect = observer.disconnect;
      },
    );

    render(
      <ExpandableText text="A description whose wrapping changes with the viewport width." />,
    );
    expect(
      screen.queryByRole("button", { name: "Read more" }),
    ).not.toBeInTheDocument();

    measuredHeight = 240;
    act(() => {
      resizeCallback?.([], observer as unknown as ResizeObserver);
    });

    expect(screen.getByRole("button", { name: "Read more" })).toBeVisible();
  });
});
