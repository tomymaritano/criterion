# Fintech: KYC Risk Assessment

Evaluate customer risk for Know Your Customer (KYC) compliance and onboarding decisions.

## Use Case

A fintech company needs to assess new customers for:
- Identity verification status
- Geographic risk (sanctions, high-risk jurisdictions)
- Source of funds verification
- PEP (Politically Exposed Person) status
- Transaction patterns and expected activity

## Implementation

```typescript
import { Engine, defineDecision } from "@criterionx/core";
import { z } from "zod";

const inputSchema = z.object({
  customerId: z.string().uuid(),
  country: z.string().length(2), // ISO country code
  identityVerified: z.boolean(),
  identityScore: z.number().min(0).max(100),
  isPEP: z.boolean(),
  pepLevel: z.enum(["NONE", "DOMESTIC", "FOREIGN", "INTERNATIONAL_ORG"]).optional(),
  sourceOfFundsVerified: z.boolean(),
  expectedMonthlyVolume: z.number().min(0),
  businessType: z.enum(["INDIVIDUAL", "SOLE_PROPRIETOR", "LLC", "CORPORATION"]),
  accountAge: z.number().min(0), // days
  previousFlags: z.number().min(0),
});

const outputSchema = z.object({
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "PROHIBITED"]),
  decision: z.enum(["APPROVE", "ENHANCED_DUE_DILIGENCE", "MANUAL_REVIEW", "REJECT"]),
  requiredActions: z.array(z.string()),
  flags: z.array(z.string()),
  reason: z.string(),
});

const profileSchema = z.object({
  sanctionedCountries: z.array(z.string()),
  highRiskCountries: z.array(z.string()),
  minIdentityScore: z.number(),
  highVolumeThreshold: z.number(),
  maxPreviousFlags: z.number(),
  pepRequiresEDD: z.boolean(),
});

const kycDecision = defineDecision({
  id: "kyc-risk-assessment",
  version: "1.0.0",
  inputSchema,
  outputSchema,
  profileSchema,
  rules: [
    {
      id: "sanctioned-country",
      when: (input, profile) =>
        profile.sanctionedCountries.includes(input.country),
      emit: (input) => ({
        riskLevel: "PROHIBITED",
        decision: "REJECT",
        requiredActions: [],
        flags: ["SANCTIONED_JURISDICTION"],
        reason: `Country ${input.country} is under sanctions - service prohibited`,
      }),
      explain: (input) => `Country ${input.country} in sanctioned list`,
    },
    {
      id: "identity-not-verified",
      when: (input, profile) =>
        !input.identityVerified || input.identityScore < profile.minIdentityScore,
      emit: (input, profile) => ({
        riskLevel: "HIGH",
        decision: "REJECT",
        requiredActions: [
          "Complete identity verification",
          "Submit government ID",
          "Complete liveness check",
        ],
        flags: ["IDENTITY_VERIFICATION_FAILED"],
        reason: `Identity score ${input.identityScore} below minimum ${profile.minIdentityScore}`,
      }),
      explain: (input, profile) =>
        `Identity score ${input.identityScore} < ${profile.minIdentityScore}`,
    },
    {
      id: "excessive-flags",
      when: (input, profile) => input.previousFlags > profile.maxPreviousFlags,
      emit: (input) => ({
        riskLevel: "HIGH",
        decision: "MANUAL_REVIEW",
        requiredActions: [
          "Compliance officer review required",
          "Document all previous incidents",
        ],
        flags: ["MULTIPLE_PREVIOUS_FLAGS"],
        reason: `${input.previousFlags} previous compliance flags exceed threshold`,
      }),
      explain: (input, profile) =>
        `Previous flags ${input.previousFlags} > max ${profile.maxPreviousFlags}`,
    },
    {
      id: "pep-foreign",
      when: (input, profile) =>
        profile.pepRequiresEDD &&
        input.isPEP &&
        (input.pepLevel === "FOREIGN" || input.pepLevel === "INTERNATIONAL_ORG"),
      emit: (input) => ({
        riskLevel: "HIGH",
        decision: "ENHANCED_DUE_DILIGENCE",
        requiredActions: [
          "Senior management approval required",
          "Enhanced source of funds documentation",
          "Ongoing monitoring enrollment",
          "Annual review scheduling",
        ],
        flags: ["FOREIGN_PEP"],
        reason: `Foreign PEP (${input.pepLevel}) requires enhanced due diligence`,
      }),
      explain: (input) => `PEP level: ${input.pepLevel}`,
    },
    {
      id: "pep-domestic",
      when: (input, profile) =>
        profile.pepRequiresEDD && input.isPEP && input.pepLevel === "DOMESTIC",
      emit: () => ({
        riskLevel: "MEDIUM",
        decision: "ENHANCED_DUE_DILIGENCE",
        requiredActions: [
          "Manager approval required",
          "Source of funds documentation",
          "Quarterly review scheduling",
        ],
        flags: ["DOMESTIC_PEP"],
        reason: "Domestic PEP requires enhanced due diligence",
      }),
      explain: () => "Domestic PEP status",
    },
    {
      id: "high-risk-country",
      when: (input, profile) =>
        profile.highRiskCountries.includes(input.country),
      emit: (input) => ({
        riskLevel: "MEDIUM",
        decision: "ENHANCED_DUE_DILIGENCE",
        requiredActions: [
          "Additional address verification",
          "Source of funds documentation",
          "Enhanced transaction monitoring",
        ],
        flags: ["HIGH_RISK_JURISDICTION"],
        reason: `Country ${input.country} classified as high-risk jurisdiction`,
      }),
      explain: (input) => `Country ${input.country} in high-risk list`,
    },
    {
      id: "high-volume-corporate",
      when: (input, profile) =>
        input.expectedMonthlyVolume > profile.highVolumeThreshold &&
        (input.businessType === "LLC" || input.businessType === "CORPORATION"),
      emit: (input) => ({
        riskLevel: "MEDIUM",
        decision: "ENHANCED_DUE_DILIGENCE",
        requiredActions: [
          "Beneficial ownership verification",
          "Business documentation review",
          "Source of funds for business",
        ],
        flags: ["HIGH_VOLUME_CORPORATE"],
        reason: `High-volume corporate account ($${input.expectedMonthlyVolume}/month)`,
      }),
      explain: (input, profile) =>
        `Volume $${input.expectedMonthlyVolume} > $${profile.highVolumeThreshold}`,
    },
    {
      id: "standard-approval",
      when: (input) => input.sourceOfFundsVerified,
      emit: () => ({
        riskLevel: "LOW",
        decision: "APPROVE",
        requiredActions: [],
        flags: [],
        reason: "All KYC requirements met - standard risk profile",
      }),
      explain: () => "All requirements satisfied",
    },
    {
      id: "pending-sof",
      when: () => true,
      emit: () => ({
        riskLevel: "LOW",
        decision: "APPROVE",
        requiredActions: ["Complete source of funds declaration"],
        flags: ["SOF_PENDING"],
        reason: "Approved pending source of funds verification",
      }),
      explain: () => "Default: approved with pending SOF",
    },
  ],
});
```

## Profiles

```typescript
const standardProfile = {
  sanctionedCountries: ["KP", "IR", "SY", "CU"], // North Korea, Iran, Syria, Cuba
  highRiskCountries: ["AF", "MM", "YE", "VE", "ZW"],
  minIdentityScore: 70,
  highVolumeThreshold: 50000,
  maxPreviousFlags: 2,
  pepRequiresEDD: true,
};

const strictProfile = {
  sanctionedCountries: ["KP", "IR", "SY", "CU", "BY", "RU"],
  highRiskCountries: ["AF", "MM", "YE", "VE", "ZW", "PK", "NG"],
  minIdentityScore: 85,
  highVolumeThreshold: 25000,
  maxPreviousFlags: 0,
  pepRequiresEDD: true,
};
```

## Usage

```typescript
const engine = new Engine();

// Standard customer
const standard = engine.run(
  kycDecision,
  {
    customerId: "550e8400-e29b-41d4-a716-446655440000",
    country: "US",
    identityVerified: true,
    identityScore: 92,
    isPEP: false,
    sourceOfFundsVerified: true,
    expectedMonthlyVolume: 5000,
    businessType: "INDIVIDUAL",
    accountAge: 0,
    previousFlags: 0,
  },
  { profile: standardProfile }
);

console.log(standard.data);
// {
//   riskLevel: "LOW",
//   decision: "APPROVE",
//   requiredActions: [],
//   flags: [],
//   reason: "All KYC requirements met - standard risk profile"
// }

// Foreign PEP
const pep = engine.run(
  kycDecision,
  {
    customerId: "550e8400-e29b-41d4-a716-446655440001",
    country: "GB",
    identityVerified: true,
    identityScore: 95,
    isPEP: true,
    pepLevel: "FOREIGN",
    sourceOfFundsVerified: true,
    expectedMonthlyVolume: 100000,
    businessType: "INDIVIDUAL",
    accountAge: 0,
    previousFlags: 0,
  },
  { profile: standardProfile }
);

console.log(pep.data);
// {
//   riskLevel: "HIGH",
//   decision: "ENHANCED_DUE_DILIGENCE",
//   requiredActions: [
//     "Senior management approval required",
//     "Enhanced source of funds documentation",
//     "Ongoing monitoring enrollment",
//     "Annual review scheduling"
//   ],
//   flags: ["FOREIGN_PEP"],
//   reason: "Foreign PEP (FOREIGN) requires enhanced due diligence"
// }
```

## Compliance Benefits

1. **Audit Trail** — Every decision is traceable with full reasoning
2. **Consistency** — Same rules applied uniformly across all customers
3. **Versioning** — Decision logic versions tracked for regulatory review
4. **Explainability** — Clear documentation of why decisions were made
5. **Testing** — Rules can be tested against known scenarios
