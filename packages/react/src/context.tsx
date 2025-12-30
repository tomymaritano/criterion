import { createContext, useContext, useMemo } from "react";
import { Engine, type ProfileRegistry } from "@criterionx/core";
import type { CriterionContextValue, CriterionProviderProps } from "./types.js";

/**
 * Default engine instance (singleton)
 */
const defaultEngine = new Engine();

/**
 * React Context for Criterion
 */
export const CriterionContext = createContext<CriterionContextValue>({
  engine: defaultEngine,
});

/**
 * Provider component for Criterion context
 *
 * Provides an Engine instance and optional ProfileRegistry to all child components.
 * If no engine is provided, a default singleton instance is used.
 *
 * @example
 * ```tsx
 * import { CriterionProvider } from "@criterionx/react";
 * import { createProfileRegistry } from "@criterionx/core";
 *
 * const registry = createProfileRegistry();
 * registry.register("default", { threshold: 100 });
 *
 * function App() {
 *   return (
 *     <CriterionProvider registry={registry}>
 *       <MyComponent />
 *     </CriterionProvider>
 *   );
 * }
 * ```
 */
export function CriterionProvider({
  children,
  engine,
  registry,
}: CriterionProviderProps): React.ReactElement {
  const value = useMemo<CriterionContextValue>(
    () => ({
      engine: engine ?? defaultEngine,
      registry,
    }),
    [engine, registry]
  );

  return <CriterionContext.Provider value={value}>{children}</CriterionContext.Provider>;
}

/**
 * Hook to access the Criterion context
 *
 * Returns the engine and optional registry from the nearest CriterionProvider.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { engine, registry } = useCriterion();
 *   // Use engine directly if needed
 * }
 * ```
 */
export function useCriterion(): CriterionContextValue {
  return useContext(CriterionContext);
}

/**
 * Hook to access the Engine instance
 *
 * Shorthand for accessing just the engine from context.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const engine = useEngine();
 *   const result = engine.run(decision, input, { profile });
 * }
 * ```
 */
export function useEngine(): Engine {
  const { engine } = useContext(CriterionContext);
  return engine;
}

/**
 * Hook to access the ProfileRegistry
 *
 * Returns the registry from context, or undefined if not provided.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const registry = useProfileRegistry();
 *   if (registry) {
 *     const profile = registry.get("default");
 *   }
 * }
 * ```
 */
export function useProfileRegistry<TProfile>(): ProfileRegistry<TProfile> | undefined {
  const { registry } = useContext(CriterionContext);
  return registry as ProfileRegistry<TProfile> | undefined;
}
