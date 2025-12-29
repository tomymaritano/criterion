# Performance

Criterion is designed for high-throughput decision evaluation.

## Benchmarks

Tested on Apple M1 Pro, Node.js 20.x:

| Scenario | Ops/sec | Avg Latency |
|----------|---------|-------------|
| Simple (3 rules) | **~1M** | ~1 μs |
| Complex (10 rules) | **~500K** | ~2 μs |
| Many rules (50 rules) | **~800K** | ~1.3 μs |
| With explain() | **~800K** | ~1.25 μs |

### Key Findings

- **Sub-microsecond latency** for simple decisions
- **Linear scaling** with rule count (O(n) worst case)
- **Early exit** on first match keeps average case fast
- **explain() is free** - metadata is already computed

## Run Benchmarks

```bash
npm run benchmark
```

## Performance Characteristics

### Time Complexity

| Operation | Complexity |
|-----------|------------|
| Rule evaluation | O(n) worst case |
| Input validation | O(1) - Zod schema |
| Output validation | O(1) - Zod schema |
| Explain generation | O(1) - pre-computed |

### Memory

- **Zero allocations** during rule evaluation (conditions only)
- **Single result object** allocated per decision
- **No caching** - stateless by design

## Optimization Tips

### 1. Order Rules by Probability

Put the most likely matches first:

```typescript
rules: [
  // 80% of cases match here - put first
  { id: "common-case", when: (i) => i.type === "standard", ... },
  // 15% of cases
  { id: "special-case", when: (i) => i.type === "premium", ... },
  // 5% of cases
  { id: "rare-case", when: () => true, ... },
]
```

### 2. Keep Conditions Simple

```typescript
// ✅ Fast - simple comparison
when: (i, p) => i.amount > p.threshold

// ❌ Slower - complex computation
when: (i, p) => computeComplexScore(i) > p.threshold
```

Move complex computations outside:

```typescript
// Pre-compute before calling engine
const score = computeComplexScore(input);
engine.run(decision, { ...input, score }, { profile });
```

### 3. Use Profile Arrays for Lookups

```typescript
// ✅ Fast - Set lookup is O(1)
profileSchema: z.object({
  blockedCountries: z.array(z.string()),
}),
when: (i, p) => p.blockedCountries.includes(i.country)

// For very large lists, convert to Set in profile
const profile = {
  blockedCountries: new Set(["KP", "IR", "SY", ...]),
};
when: (i, p) => p.blockedCountries.has(i.country)
```

### 4. Avoid Unnecessary Validation

If you're calling the same decision in a hot loop with trusted input:

```typescript
// Normal usage - validates every call
for (const item of items) {
  engine.run(decision, item, { profile });
}

// If validation is bottleneck and input is trusted,
// validate once then skip (future feature)
```

## Comparison

How does Criterion compare to alternatives?

| Engine | Latency | Features |
|--------|---------|----------|
| Criterion | ~1 μs | Pure, explainable, typed |
| json-rules-engine | ~10 μs | JSON rules, async |
| node-rules | ~5 μs | Callbacks, mutable |
| Raw if/else | ~0.1 μs | No audit, scattered |

Criterion trades ~10x vs raw if/else for:
- Complete audit trail
- Type safety
- Testability
- Centralized logic
- Profile-driven parameterization

For most applications, **1 million ops/sec is more than enough**.

## When Performance Matters

If you're evaluating millions of decisions per second:

1. **Batch similar decisions** - amortize validation cost
2. **Profile your specific rules** - benchmark your actual decision
3. **Consider caching** - if same inputs repeat often (implement outside engine)
4. **Horizontal scaling** - Criterion is stateless, scale with workers

## Benchmark Code

The benchmarks are available at `benchmarks/run.ts`:

```bash
# Run benchmarks
npm run benchmark

# Run with specific Node flags
node --expose-gc benchmarks/run.ts
```
