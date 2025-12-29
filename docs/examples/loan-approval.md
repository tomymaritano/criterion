# Loan Approval

Automated loan approval decisions based on applicant criteria.

## Use Case

A lending platform needs to approve or reject loan applications:
- **Approved** — Applicant meets all criteria
- **Manual Review** — Edge cases requiring human review
- **Rejected** — Applicant fails key criteria

## Implementation

```typescript
import { Engine, defineDecision } from "@criterionx/core";
import { z } from "zod";

const inputSchema = z.object({
  applicantAge: z.number().min(18),
  annualIncome: z.number().min(0),
  creditScore: z.number().min(300).max(850),
  requestedAmount: z.number().positive(),
  employmentYears: z.number().min(0),
  existingDebt: z.number().min(0),
});

const outputSchema = z.object({
  decision: z.enum(["APPROVED", "MANUAL_REVIEW", "REJECTED"]),
  maxApprovedAmount: z.number().nullable(),
  interestRate: z.number().nullable(),
  reason: z.string(),
});

const profileSchema = z.object({
  minCreditScore: z.number(),
  minIncome: z.number(),
  maxDebtToIncomeRatio: z.number(),
  minEmploymentYears: z.number(),
  baseInterestRate: z.number(),
});

const loanDecision = defineDecision({
  id: "loan-approval",
  version: "1.0.0",
  inputSchema,
  outputSchema,
  profileSchema,
  rules: [
    {
      id: "reject-low-credit",
      when: (input, profile) => input.creditScore < profile.minCreditScore,
      emit: () => ({
        decision: "REJECTED",
        maxApprovedAmount: null,
        interestRate: null,
        reason: "Credit score below minimum requirement",
      }),
      explain: (input, profile) =>
        `Credit score ${input.creditScore} < minimum ${profile.minCreditScore}`,
    },
    {
      id: "reject-high-dti",
      when: (input, profile) => {
        const dti = input.existingDebt / input.annualIncome;
        return dti > profile.maxDebtToIncomeRatio;
      },
      emit: (input) => ({
        decision: "REJECTED",
        maxApprovedAmount: null,
        interestRate: null,
        reason: "Debt-to-income ratio too high",
      }),
      explain: (input, profile) => {
        const dti = (input.existingDebt / input.annualIncome * 100).toFixed(1);
        return `DTI ${dti}% > max ${profile.maxDebtToIncomeRatio * 100}%`;
      },
    },
    {
      id: "manual-review-new-employment",
      when: (input, profile) =>
        input.employmentYears < profile.minEmploymentYears &&
        input.creditScore >= profile.minCreditScore,
      emit: () => ({
        decision: "MANUAL_REVIEW",
        maxApprovedAmount: null,
        interestRate: null,
        reason: "Short employment history requires manual review",
      }),
      explain: (input, profile) =>
        `Employment ${input.employmentYears} years < ${profile.minEmploymentYears} required`,
    },
    {
      id: "approve",
      when: () => true,
      emit: (input, profile) => {
        const creditFactor = (input.creditScore - 600) / 250;
        const rate = profile.baseInterestRate - (creditFactor * 0.03);
        const maxAmount = Math.min(
          input.requestedAmount,
          input.annualIncome * 0.4
        );
        return {
          decision: "APPROVED",
          maxApprovedAmount: maxAmount,
          interestRate: Math.max(rate, 0.04),
          reason: "All criteria met",
        };
      },
      explain: (input) =>
        `Approved: score ${input.creditScore}, income $${input.annualIncome}`,
    },
  ],
});
```

## Profiles

```typescript
const standardProfile = {
  minCreditScore: 650,
  minIncome: 30000,
  maxDebtToIncomeRatio: 0.43,
  minEmploymentYears: 2,
  baseInterestRate: 0.12,
};

const primeProfile = {
  minCreditScore: 720,
  minIncome: 50000,
  maxDebtToIncomeRatio: 0.36,
  minEmploymentYears: 3,
  baseInterestRate: 0.08,
};
```

## Usage

```typescript
const engine = new Engine();

const application = {
  applicantAge: 32,
  annualIncome: 75000,
  creditScore: 740,
  requestedAmount: 25000,
  employmentYears: 5,
  existingDebt: 15000,
};

const result = engine.run(loanDecision, application, { profile: standardProfile });

console.log(result.data);
// {
//   decision: "APPROVED",
//   maxApprovedAmount: 25000,
//   interestRate: 0.0832,
//   reason: "All criteria met"
// }
```
