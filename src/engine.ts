import { ZodError } from "zod";
import type {
  Decision,
  ProfileRegistry,
  Result,
  RuleTrace,
  RunOptions,
} from "./types.js";
import { isInlineProfile } from "./types.js";

/**
 * Criterion Engine
 *
 * Evaluates decisions against context with profile support.
 * Pure, deterministic, and explainable.
 */
export class Engine {
  /**
   * Run a decision against a context
   */
  run<TInput, TOutput, TProfile>(
    decision: Decision<TInput, TOutput, TProfile>,
    context: TInput,
    options: RunOptions<TProfile>,
    registry?: ProfileRegistry<TProfile>
  ): Result<TOutput> {
    const evaluatedAt = new Date().toISOString();
    const evaluatedRules: RuleTrace[] = [];

    // Resolve profile
    let profile: TProfile;
    let profileId: string | undefined;

    if (isInlineProfile(options)) {
      profile = options.profile;
    } else {
      profileId = options.profile;
      if (!registry) {
        return this.createErrorResult(
          "INVALID_INPUT",
          decision,
          evaluatedRules,
          evaluatedAt,
          "Profile ID provided but no registry supplied",
          profileId
        );
      }
      const resolved = registry.get(profileId);
      if (!resolved) {
        return this.createErrorResult(
          "INVALID_INPUT",
          decision,
          evaluatedRules,
          evaluatedAt,
          `Profile not found: ${profileId}`,
          profileId
        );
      }
      profile = resolved;
    }

    // Validate input
    const inputResult = decision.inputSchema.safeParse(context);
    if (!inputResult.success) {
      return this.createErrorResult(
        "INVALID_INPUT",
        decision,
        evaluatedRules,
        evaluatedAt,
        this.formatZodError(inputResult.error, "Input"),
        profileId
      );
    }

    // Validate profile
    const profileResult = decision.profileSchema.safeParse(profile);
    if (!profileResult.success) {
      return this.createErrorResult(
        "INVALID_INPUT",
        decision,
        evaluatedRules,
        evaluatedAt,
        this.formatZodError(profileResult.error, "Profile"),
        profileId
      );
    }

    const validatedInput = inputResult.data;
    const validatedProfile = profileResult.data;

    // Evaluate rules in order
    for (const rule of decision.rules) {
      let matched = false;
      let explanation: string | undefined;

      try {
        matched = rule.when(validatedInput, validatedProfile);
        if (matched) {
          explanation = rule.explain(validatedInput, validatedProfile);
        }
      } catch (error) {
        return this.createErrorResult(
          "INVALID_INPUT",
          decision,
          evaluatedRules,
          evaluatedAt,
          `Rule evaluation error in ${rule.id}: ${String(error)}`,
          profileId
        );
      }

      evaluatedRules.push({
        ruleId: rule.id,
        matched,
        explanation,
      });

      if (matched) {
        // Emit output
        let output: TOutput;
        try {
          output = rule.emit(validatedInput, validatedProfile);
        } catch (error) {
          return this.createErrorResult(
            "INVALID_OUTPUT",
            decision,
            evaluatedRules,
            evaluatedAt,
            `Rule emit error in ${rule.id}: ${String(error)}`,
            profileId
          );
        }

        // Validate output
        const outputResult = decision.outputSchema.safeParse(output);
        if (!outputResult.success) {
          return this.createErrorResult(
            "INVALID_OUTPUT",
            decision,
            evaluatedRules,
            evaluatedAt,
            this.formatZodError(outputResult.error, "Output"),
            profileId
          );
        }

        return {
          status: "OK",
          data: outputResult.data,
          meta: {
            decisionId: decision.id,
            decisionVersion: decision.version,
            profileId,
            matchedRule: rule.id,
            evaluatedRules,
            explanation: explanation ?? "",
            evaluatedAt,
          },
        };
      }
    }

    // No rule matched
    return this.createErrorResult(
      "NO_MATCH",
      decision,
      evaluatedRules,
      evaluatedAt,
      "No rule matched the given context",
      profileId
    );
  }

  /**
   * Format explanation for display (helper utility)
   */
  explain<TOutput>(result: Result<TOutput>): string {
    const { meta } = result;
    const lines: string[] = [];

    lines.push(`Decision: ${meta.decisionId} v${meta.decisionVersion}`);
    if (meta.profileId) {
      lines.push(`Profile: ${meta.profileId}`);
    }
    lines.push(`Status: ${result.status}`);

    if (result.status === "OK" && meta.matchedRule) {
      lines.push(`Matched: ${meta.matchedRule}`);
      lines.push(`Reason: ${meta.explanation}`);
    } else if (result.status !== "OK") {
      lines.push(`Error: ${meta.explanation}`);
    }

    lines.push("");
    lines.push("Evaluation trace:");
    for (const trace of meta.evaluatedRules) {
      const status = trace.matched ? "✓" : "✗";
      lines.push(`  ${status} ${trace.ruleId}`);
    }

    return lines.join("\n");
  }

  private createErrorResult<TInput, TOutput, TProfile>(
    status: "INVALID_INPUT" | "INVALID_OUTPUT" | "NO_MATCH",
    decision: Decision<TInput, TOutput, TProfile>,
    evaluatedRules: RuleTrace[],
    evaluatedAt: string,
    explanation: string,
    profileId?: string
  ): Result<TOutput> {
    return {
      status,
      data: null,
      meta: {
        decisionId: decision.id,
        decisionVersion: decision.version,
        profileId,
        evaluatedRules,
        explanation,
        evaluatedAt,
      },
    };
  }

  private formatZodError(error: ZodError, prefix: string): string {
    const issues = error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join(", ");
    return `${prefix} validation failed: ${issues}`;
  }
}

/**
 * Default engine instance
 */
export const engine = new Engine();
