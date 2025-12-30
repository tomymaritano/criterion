# @criterionx/react

React hooks for seamless integration with Criterion decision engine.

## Installation

```bash
npm install @criterionx/react @criterionx/core
```

## Quick Start

```tsx
import { CriterionProvider, useDecision } from '@criterionx/react';
import { eligibilityDecision } from './decisions';

function App() {
  return (
    <CriterionProvider
      decisions={[eligibilityDecision]}
      profiles={{
        eligibility: { minAge: 18, minScore: 650 }
      }}
    >
      <EligibilityChecker />
    </CriterionProvider>
  );
}

function EligibilityChecker() {
  const { result, isEvaluating, evaluate } = useDecision('eligibility');

  const handleCheck = () => {
    evaluate({ age: 25, creditScore: 720 });
  };

  return (
    <div>
      <button onClick={handleCheck} disabled={isEvaluating}>
        Check Eligibility
      </button>
      {result && (
        <p>Result: {result.data?.eligible ? 'Approved' : 'Denied'}</p>
      )}
    </div>
  );
}
```

## API Reference

### CriterionProvider

Context provider that initializes the decision engine.

```tsx
interface CriterionProviderProps {
  children: React.ReactNode;
  decisions: Decision[];
  profiles?: Record<string, unknown>;
  engine?: Engine;
}
```

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `decisions` | `Decision[]` | Array of decisions to register |
| `profiles` | `Record<string, unknown>` | Profile data keyed by decision ID |
| `engine` | `Engine` | Optional custom engine instance |
| `children` | `ReactNode` | Child components |

### useDecision

Hook for evaluating decisions.

```tsx
function useDecision<TInput, TOutput>(
  decisionId: string
): UseDecisionReturn<TInput, TOutput>
```

#### Return Value

```tsx
interface UseDecisionReturn<TInput, TOutput> {
  // Current result (null if not evaluated)
  result: Result<TOutput> | null;

  // Loading state
  isEvaluating: boolean;

  // Error from last evaluation
  error: Error | null;

  // Evaluate the decision with input
  evaluate: (input: TInput) => void;

  // Reset state
  reset: () => void;
}
```

#### Example

```tsx
function PricingCalculator() {
  const { result, isEvaluating, error, evaluate, reset } = useDecision('pricing');

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      evaluate({ quantity: 10, customerType: 'premium' });
    }}>
      {/* form fields */}
      <button type="submit" disabled={isEvaluating}>
        Calculate Price
      </button>
      <button type="button" onClick={reset}>
        Reset
      </button>
      {result?.data && (
        <div>Total: ${result.data.total}</div>
      )}
    </form>
  );
}
```

### useCriterion

Low-level hook to access the Criterion context directly.

```tsx
function useCriterion(): CriterionContextValue
```

#### Return Value

```tsx
interface CriterionContextValue {
  engine: Engine;
  decisions: Map<string, Decision>;
  profiles: Map<string, unknown>;
}
```

### useEngine

Hook to access the engine instance.

```tsx
const engine = useEngine();
```

### useProfileRegistry

Hook to access the profile registry.

```tsx
const registry = useProfileRegistry();
```

## Patterns

### Conditional Rendering

```tsx
function FeatureGate({ feature, children }) {
  const { result, evaluate } = useDecision('feature-flags');

  useEffect(() => {
    evaluate({ feature, userId: currentUser.id });
  }, [feature]);

  if (!result?.data?.enabled) {
    return null;
  }

  return children;
}
```

### Form Validation

```tsx
function RegistrationForm() {
  const { result, evaluate } = useDecision('registration-eligibility');
  const [formData, setFormData] = useState({});

  // Re-evaluate on form changes
  useEffect(() => {
    if (formData.age && formData.country) {
      evaluate(formData);
    }
  }, [formData]);

  const canSubmit = result?.data?.eligible === true;

  return (
    <form>
      {/* form fields */}
      <button disabled={!canSubmit}>Register</button>
      {result?.data?.reason && (
        <p className="hint">{result.data.reason}</p>
      )}
    </form>
  );
}
```

### Multiple Decisions

```tsx
function Dashboard() {
  const pricing = useDecision('pricing');
  const eligibility = useDecision('eligibility');
  const riskLevel = useDecision('risk-assessment');

  // Each hook manages its own state independently
}
```

## TypeScript Support

Full TypeScript support with generics:

```tsx
interface PricingInput {
  quantity: number;
  customerType: 'regular' | 'premium';
}

interface PricingOutput {
  unitPrice: number;
  total: number;
  discount: number;
}

function PricingComponent() {
  const { result, evaluate } = useDecision<PricingInput, PricingOutput>('pricing');

  // result.data is typed as PricingOutput | undefined
  // evaluate expects PricingInput
}
```
