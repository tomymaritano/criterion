import { z, ZodSchema } from "zod";

/**
 * Result status codes
 */
export type ResultStatus =
  | "OK"
  | "NO_MATCH"
  | "INVALID_INPUT"
  | "INVALID_OUTPUT";

/**
 * Trace entry for rule evaluation
 */
export interface RuleTrace {
  ruleId: string;
  matched: boolean;
  explanation?: string;
}

/**
 * Result metadata
 */
export interface ResultMeta {
  decisionId: string;
  decisionVersion: string;
  profileId?: string;
  matchedRule?: string;
  evaluatedRules: RuleTrace[];
  explanation: string;
  evaluatedAt: string;
}

/**
 * Decision result
 */
export interface Result<TOutput = unknown> {
  status: ResultStatus;
  data: TOutput | null;
  meta: ResultMeta;
}

/**
 * Rule definition
 */
export interface Rule<TContext, TProfile, TOutput> {
  id: string;
  when: (context: TContext, profile: TProfile) => boolean;
  emit: (context: TContext, profile: TProfile) => TOutput;
  explain: (context: TContext, profile: TProfile) => string;
}

/**
 * Decision metadata
 */
export interface DecisionMeta {
  owner?: string;
  tags?: string[];
  tier?: string;
  description?: string;
}

/**
 * Decision definition
 */
export interface Decision<
  TInput = unknown,
  TOutput = unknown,
  TProfile = unknown
> {
  id: string;
  version: string;
  inputSchema: ZodSchema<TInput>;
  outputSchema: ZodSchema<TOutput>;
  profileSchema: ZodSchema<TProfile>;
  rules: Rule<TInput, TProfile, TOutput>[];
  meta?: DecisionMeta;
}

/**
 * Profile registry interface
 */
export interface ProfileRegistry<TProfile = unknown> {
  get(id: string): TProfile | undefined;
  register(id: string, profile: TProfile): void;
  has(id: string): boolean;
}

/**
 * Engine run options
 */
export type RunOptions<TProfile> =
  | { profile: string }      // Profile ID (requires registry)
  | { profile: TProfile };   // Inline profile object

/**
 * Helper to check if profile is inline or ID
 */
export function isInlineProfile<TProfile>(
  options: RunOptions<TProfile>
): options is { profile: TProfile } {
  return typeof options.profile !== "string";
}

/**
 * Create a simple in-memory profile registry
 */
export function createProfileRegistry<TProfile>(): ProfileRegistry<TProfile> {
  const profiles = new Map<string, TProfile>();

  return {
    get(id: string): TProfile | undefined {
      return profiles.get(id);
    },
    register(id: string, profile: TProfile): void {
      profiles.set(id, profile);
    },
    has(id: string): boolean {
      return profiles.has(id);
    },
  };
}

/**
 * Define a decision with type inference
 */
export function defineDecision<TInput, TOutput, TProfile>(
  definition: Decision<TInput, TOutput, TProfile>
): Decision<TInput, TOutput, TProfile> {
  return definition;
}

/**
 * Create a rule with type inference
 */
export function createRule<TContext, TProfile, TOutput>(
  rule: Rule<TContext, TProfile, TOutput>
): Rule<TContext, TProfile, TOutput> {
  return rule;
}
