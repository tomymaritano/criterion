import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { defineDecision } from "@criterionx/core";
import { createServer } from "./index.js";
import { InMemoryRateLimitStore, createRateLimitMiddleware } from "./rate-limit.js";
import type { RateLimitStore } from "./types.js";

// Test decision
const testDecision = defineDecision({
  id: "rate-limit-test",
  version: "1.0.0",
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ result: z.string() }),
  profileSchema: z.object({ threshold: z.number() }),
  rules: [
    {
      id: "above",
      when: (input, profile) => input.value > profile.threshold,
      emit: () => ({ result: "ABOVE" }),
      explain: () => "Value above threshold",
    },
    {
      id: "default",
      when: () => true,
      emit: () => ({ result: "BELOW" }),
      explain: () => "Default",
    },
  ],
});

describe("InMemoryRateLimitStore", () => {
  it("should increment count for new keys", async () => {
    const store = new InMemoryRateLimitStore(60000);
    const info = await store.increment("test-key");

    expect(info.count).toBe(1);
    expect(info.resetTime).toBeGreaterThan(Date.now());
  });

  it("should increment count for existing keys", async () => {
    const store = new InMemoryRateLimitStore(60000);

    await store.increment("test-key");
    await store.increment("test-key");
    const info = await store.increment("test-key");

    expect(info.count).toBe(3);
  });

  it("should reset count after window expires", async () => {
    const store = new InMemoryRateLimitStore(100); // 100ms window

    await store.increment("test-key");
    await store.increment("test-key");

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, 150));

    const info = await store.increment("test-key");
    expect(info.count).toBe(1);
  });

  it("should reset key on demand", async () => {
    const store = new InMemoryRateLimitStore(60000);

    await store.increment("test-key");
    await store.increment("test-key");
    await store.reset("test-key");

    const info = await store.increment("test-key");
    expect(info.count).toBe(1);
  });
});

describe("rate limiting middleware", () => {
  it("should not rate limit when disabled", async () => {
    const server = createServer({
      decisions: [testDecision],
      profiles: { "rate-limit-test": { threshold: 10 } },
      rateLimit: { enabled: false, max: 1 },
    });

    // Make multiple requests - should all succeed
    for (let i = 0; i < 5; i++) {
      const response = await server.handler.request(
        new Request("http://localhost/decisions/rate-limit-test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: { value: 50 } }),
        })
      );
      expect(response.status).toBe(200);
    }
  });

  it("should allow requests under limit", async () => {
    const server = createServer({
      decisions: [testDecision],
      profiles: { "rate-limit-test": { threshold: 10 } },
      rateLimit: { enabled: true, max: 5, windowMs: 60000 },
    });

    for (let i = 0; i < 5; i++) {
      const response = await server.handler.request(
        new Request("http://localhost/decisions/rate-limit-test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: { value: 50 } }),
        })
      );
      expect(response.status).toBe(200);
    }
  });

  it("should block requests over limit with 429", async () => {
    const server = createServer({
      decisions: [testDecision],
      profiles: { "rate-limit-test": { threshold: 10 } },
      rateLimit: { enabled: true, max: 2, windowMs: 60000 },
    });

    // First two requests should succeed
    for (let i = 0; i < 2; i++) {
      const response = await server.handler.request(
        new Request("http://localhost/decisions/rate-limit-test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: { value: 50 } }),
        })
      );
      expect(response.status).toBe(200);
    }

    // Third request should be blocked
    const response = await server.handler.request(
      new Request("http://localhost/decisions/rate-limit-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: { value: 50 } }),
      })
    );

    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.error.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(body.retryAfter).toBeGreaterThan(0);
  });

  it("should set rate limit headers", async () => {
    const server = createServer({
      decisions: [testDecision],
      profiles: { "rate-limit-test": { threshold: 10 } },
      rateLimit: { enabled: true, max: 10, windowMs: 60000 },
    });

    const response = await server.handler.request(
      new Request("http://localhost/decisions/rate-limit-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: { value: 50 } }),
      })
    );

    expect(response.headers.get("X-RateLimit-Limit")).toBe("10");
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("9");
    expect(response.headers.get("X-RateLimit-Reset")).toBeDefined();
  });

  it("should skip health endpoint by default", async () => {
    const server = createServer({
      decisions: [testDecision],
      profiles: { "rate-limit-test": { threshold: 10 } },
      rateLimit: { enabled: true, max: 1, windowMs: 60000 },
    });

    // Exhaust the limit
    await server.handler.request(
      new Request("http://localhost/decisions/rate-limit-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: { value: 50 } }),
      })
    );

    // Health should still work (skipped from rate limiting)
    const healthResponse = await server.handler.request(
      new Request("http://localhost/health")
    );

    expect(healthResponse.status).toBe(200);
  });

  it("should use custom key generator", async () => {
    const server = createServer({
      decisions: [testDecision],
      profiles: { "rate-limit-test": { threshold: 10 } },
      rateLimit: {
        enabled: true,
        max: 2,
        windowMs: 60000,
        keyGenerator: (c) => c.req.header("x-api-key") ?? "anonymous",
      },
    });

    // Requests with different API keys should have separate limits
    for (let i = 0; i < 2; i++) {
      const response = await server.handler.request(
        new Request("http://localhost/decisions/rate-limit-test", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": "key-1",
          },
          body: JSON.stringify({ input: { value: 50 } }),
        })
      );
      expect(response.status).toBe(200);
    }

    // key-1 is exhausted
    const blockedResponse = await server.handler.request(
      new Request("http://localhost/decisions/rate-limit-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "key-1",
        },
        body: JSON.stringify({ input: { value: 50 } }),
      })
    );
    expect(blockedResponse.status).toBe(429);

    // key-2 should still work
    const allowedResponse = await server.handler.request(
      new Request("http://localhost/decisions/rate-limit-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "key-2",
        },
        body: JSON.stringify({ input: { value: 50 } }),
      })
    );
    expect(allowedResponse.status).toBe(200);
  });

  it("should use custom skip function", async () => {
    const server = createServer({
      decisions: [testDecision],
      profiles: { "rate-limit-test": { threshold: 10 } },
      rateLimit: {
        enabled: true,
        max: 1,
        windowMs: 60000,
        skip: (c) => c.req.path === "/decisions",
      },
    });

    // Exhaust limit
    await server.handler.request(
      new Request("http://localhost/decisions/rate-limit-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: { value: 50 } }),
      })
    );

    // /decisions list endpoint should be skipped
    const listResponse = await server.handler.request(
      new Request("http://localhost/decisions")
    );

    expect(listResponse.status).toBe(200);
  });

  it("should use custom store", async () => {
    const customStore: RateLimitStore = {
      increment: vi.fn().mockResolvedValue({ count: 999, resetTime: Date.now() + 60000 }),
      reset: vi.fn().mockResolvedValue(undefined),
    };

    const server = createServer({
      decisions: [testDecision],
      profiles: { "rate-limit-test": { threshold: 10 } },
      rateLimit: {
        enabled: true,
        max: 100,
        windowMs: 60000,
        store: customStore,
      },
    });

    const response = await server.handler.request(
      new Request("http://localhost/decisions/rate-limit-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: { value: 50 } }),
      })
    );

    expect(customStore.increment).toHaveBeenCalled();
    // count 999 > max 100, so should be blocked
    expect(response.status).toBe(429);
  });

  it("should set Retry-After header when blocked", async () => {
    const server = createServer({
      decisions: [testDecision],
      profiles: { "rate-limit-test": { threshold: 10 } },
      rateLimit: { enabled: true, max: 1, windowMs: 60000 },
    });

    // Exhaust limit
    await server.handler.request(
      new Request("http://localhost/decisions/rate-limit-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: { value: 50 } }),
      })
    );

    // Get blocked response
    const response = await server.handler.request(
      new Request("http://localhost/decisions/rate-limit-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: { value: 50 } }),
      })
    );

    expect(response.status).toBe(429);
    const retryAfter = response.headers.get("Retry-After");
    expect(retryAfter).toBeDefined();
    expect(parseInt(retryAfter!)).toBeGreaterThan(0);
  });
});
