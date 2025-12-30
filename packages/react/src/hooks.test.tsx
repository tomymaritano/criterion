import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { defineDecision, Engine, createProfileRegistry } from "@criterionx/core";
import { z } from "zod";
import { useDecision, CriterionProvider, useEngine, useProfileRegistry, useCriterion } from "./index.js";
import type { ReactNode } from "react";

// Test decision
const testDecision = defineDecision({
  id: "test-decision",
  version: "1.0.0",
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ result: z.string() }),
  profileSchema: z.object({ threshold: z.number() }),
  rules: [
    {
      id: "above",
      when: (input, profile) => input.value > profile.threshold,
      emit: () => ({ result: "ABOVE" }),
      explain: () => "Value is above threshold",
    },
    {
      id: "below",
      when: () => true,
      emit: () => ({ result: "BELOW" }),
      explain: () => "Default: below threshold",
    },
  ],
});

// Wrapper component for tests
function createWrapper(props?: { engine?: Engine; registry?: ReturnType<typeof createProfileRegistry> }) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <CriterionProvider engine={props?.engine} registry={props?.registry}>
        {children}
      </CriterionProvider>
    );
  };
}

describe("useDecision", () => {
  it("should return initial state", () => {
    const { result } = renderHook(() => useDecision(testDecision), {
      wrapper: createWrapper(),
    });

    expect(result.current.result).toBeNull();
    expect(result.current.isEvaluating).toBe(false);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.evaluate).toBe("function");
    expect(typeof result.current.reset).toBe("function");
  });

  it("should evaluate decision with inline profile", () => {
    const { result } = renderHook(() => useDecision(testDecision), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.evaluate({ value: 50 }, { profile: { threshold: 10 } });
    });

    expect(result.current.result).not.toBeNull();
    expect(result.current.result?.status).toBe("OK");
    expect(result.current.result?.data?.result).toBe("ABOVE");
    expect(result.current.isEvaluating).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should handle evaluation returning BELOW", () => {
    const { result } = renderHook(() => useDecision(testDecision), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.evaluate({ value: 5 }, { profile: { threshold: 10 } });
    });

    expect(result.current.result?.status).toBe("OK");
    expect(result.current.result?.data?.result).toBe("BELOW");
  });

  it("should reset state", () => {
    const { result } = renderHook(() => useDecision(testDecision), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.evaluate({ value: 50 }, { profile: { threshold: 10 } });
    });

    expect(result.current.result).not.toBeNull();

    act(() => {
      result.current.reset();
    });

    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isEvaluating).toBe(false);
  });

  it("should work with profile registry", () => {
    const registry = createProfileRegistry<{ threshold: number }>();
    registry.register("default", { threshold: 25 });

    const { result } = renderHook(() => useDecision(testDecision), {
      wrapper: createWrapper({ registry }),
    });

    act(() => {
      result.current.evaluate({ value: 50 }, { profile: "default" });
    });

    expect(result.current.result?.status).toBe("OK");
    expect(result.current.result?.data?.result).toBe("ABOVE");
  });

  it("should use custom engine from options", () => {
    const customEngine = new Engine();
    const { result } = renderHook(
      () => useDecision(testDecision, { engine: customEngine }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.evaluate({ value: 50 }, { profile: { threshold: 10 } });
    });

    expect(result.current.result?.status).toBe("OK");
  });
});

describe("useEngine", () => {
  it("should return default engine", () => {
    const { result } = renderHook(() => useEngine(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBeInstanceOf(Engine);
  });

  it("should return custom engine from provider", () => {
    const customEngine = new Engine();
    const { result } = renderHook(() => useEngine(), {
      wrapper: createWrapper({ engine: customEngine }),
    });

    expect(result.current).toBe(customEngine);
  });
});

describe("useProfileRegistry", () => {
  it("should return undefined when no registry provided", () => {
    const { result } = renderHook(() => useProfileRegistry(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBeUndefined();
  });

  it("should return registry from provider", () => {
    const registry = createProfileRegistry();
    const { result } = renderHook(() => useProfileRegistry(), {
      wrapper: createWrapper({ registry }),
    });

    expect(result.current).toBe(registry);
  });
});

describe("useCriterion", () => {
  it("should return context value", () => {
    const { result } = renderHook(() => useCriterion(), {
      wrapper: createWrapper(),
    });

    expect(result.current.engine).toBeInstanceOf(Engine);
    expect(result.current.registry).toBeUndefined();
  });

  it("should return custom engine and registry", () => {
    const customEngine = new Engine();
    const registry = createProfileRegistry();

    const { result } = renderHook(() => useCriterion(), {
      wrapper: createWrapper({ engine: customEngine, registry }),
    });

    expect(result.current.engine).toBe(customEngine);
    expect(result.current.registry).toBe(registry);
  });
});
