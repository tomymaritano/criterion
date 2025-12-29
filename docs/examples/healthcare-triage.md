# Healthcare: Emergency Triage

Classify patient urgency in emergency departments using standardized triage protocols.

## Use Case

An emergency department needs to prioritize patients based on:
- Vital signs (heart rate, blood pressure, temperature, oxygen saturation)
- Pain level
- Symptoms and chief complaint
- Age and risk factors

## Implementation

```typescript
import { Engine, defineDecision } from "@criterionx/core";
import { z } from "zod";

const inputSchema = z.object({
  heartRate: z.number().min(0).max(300),
  systolicBP: z.number().min(0).max(300),
  diastolicBP: z.number().min(0).max(200),
  temperature: z.number().min(30).max(45), // Celsius
  oxygenSaturation: z.number().min(0).max(100),
  painLevel: z.number().min(0).max(10),
  age: z.number().min(0).max(150),
  chiefComplaint: z.string(),
  symptoms: z.array(z.string()),
  isPregnant: z.boolean(),
  hasChestPain: z.boolean(),
  hasDifficultyBreathing: z.boolean(),
});

const outputSchema = z.object({
  triageLevel: z.enum(["IMMEDIATE", "EMERGENT", "URGENT", "LESS_URGENT", "NON_URGENT"]),
  code: z.enum(["RED", "ORANGE", "YELLOW", "GREEN", "BLUE"]),
  maxWaitMinutes: z.number(),
  alerts: z.array(z.string()),
  reason: z.string(),
});

const profileSchema = z.object({
  criticalHeartRateLow: z.number(),
  criticalHeartRateHigh: z.number(),
  criticalSystolicLow: z.number(),
  criticalSystolicHigh: z.number(),
  criticalO2Sat: z.number(),
  highFeverThreshold: z.number(),
  pediatricAgeThreshold: z.number(),
  geriatricAgeThreshold: z.number(),
});

const triageDecision = defineDecision({
  id: "emergency-triage",
  version: "1.0.0",
  inputSchema,
  outputSchema,
  profileSchema,
  rules: [
    {
      id: "immediate-life-threat",
      when: (input, profile) =>
        input.oxygenSaturation < profile.criticalO2Sat ||
        input.systolicBP < profile.criticalSystolicLow ||
        input.heartRate < profile.criticalHeartRateLow ||
        input.heartRate > profile.criticalHeartRateHigh,
      emit: (input) => {
        const alerts: string[] = [];
        if (input.oxygenSaturation < 90) alerts.push("Critical hypoxia");
        if (input.systolicBP < 90) alerts.push("Hypotension/shock");
        if (input.heartRate < 40) alerts.push("Severe bradycardia");
        if (input.heartRate > 150) alerts.push("Severe tachycardia");
        return {
          triageLevel: "IMMEDIATE",
          code: "RED",
          maxWaitMinutes: 0,
          alerts,
          reason: "Life-threatening vital signs - immediate intervention required",
        };
      },
      explain: (input) =>
        `Critical vitals: HR=${input.heartRate}, BP=${input.systolicBP}/${input.diastolicBP}, O2=${input.oxygenSaturation}%`,
    },
    {
      id: "emergent-cardiac",
      when: (input) => input.hasChestPain && input.age > 40,
      emit: (input) => ({
        triageLevel: "EMERGENT",
        code: "ORANGE",
        maxWaitMinutes: 10,
        alerts: ["Possible cardiac event", "ECG required"],
        reason: "Chest pain in patient over 40 - rule out MI",
      }),
      explain: (input) => `Chest pain, age ${input.age} > 40`,
    },
    {
      id: "emergent-respiratory",
      when: (input, profile) =>
        input.hasDifficultyBreathing &&
        input.oxygenSaturation < 94,
      emit: () => ({
        triageLevel: "EMERGENT",
        code: "ORANGE",
        maxWaitMinutes: 10,
        alerts: ["Respiratory distress", "Oxygen supplementation needed"],
        reason: "Breathing difficulty with low oxygen saturation",
      }),
      explain: (input) =>
        `Respiratory distress with O2 sat ${input.oxygenSaturation}%`,
    },
    {
      id: "emergent-pregnant",
      when: (input) =>
        input.isPregnant &&
        (input.hasChestPain || input.hasDifficultyBreathing || input.painLevel >= 8),
      emit: () => ({
        triageLevel: "EMERGENT",
        code: "ORANGE",
        maxWaitMinutes: 10,
        alerts: ["High-risk pregnancy", "OB consultation recommended"],
        reason: "Pregnant patient with concerning symptoms",
      }),
      explain: () => "Pregnant with severe symptoms",
    },
    {
      id: "urgent-high-fever",
      when: (input, profile) =>
        input.temperature >= profile.highFeverThreshold,
      emit: (input, profile) => {
        const alerts: string[] = ["High fever"];
        if (input.age < profile.pediatricAgeThreshold) {
          alerts.push("Pediatric patient - monitor closely");
        }
        if (input.age > profile.geriatricAgeThreshold) {
          alerts.push("Geriatric patient - infection risk");
        }
        return {
          triageLevel: "URGENT",
          code: "YELLOW",
          maxWaitMinutes: 30,
          alerts,
          reason: `High fever (${input.temperature}°C) requiring evaluation`,
        };
      },
      explain: (input) => `Temperature ${input.temperature}°C exceeds threshold`,
    },
    {
      id: "urgent-severe-pain",
      when: (input) => input.painLevel >= 7,
      emit: (input) => ({
        triageLevel: "URGENT",
        code: "YELLOW",
        maxWaitMinutes: 30,
        alerts: ["Severe pain management needed"],
        reason: `Severe pain level ${input.painLevel}/10`,
      }),
      explain: (input) => `Pain level ${input.painLevel}/10 >= 7`,
    },
    {
      id: "less-urgent",
      when: (input) => input.painLevel >= 4 || input.symptoms.length > 2,
      emit: (input) => ({
        triageLevel: "LESS_URGENT",
        code: "GREEN",
        maxWaitMinutes: 60,
        alerts: [],
        reason: "Moderate symptoms requiring evaluation",
      }),
      explain: (input) =>
        `Pain ${input.painLevel}/10 or ${input.symptoms.length} symptoms`,
    },
    {
      id: "non-urgent-default",
      when: () => true,
      emit: () => ({
        triageLevel: "NON_URGENT",
        code: "BLUE",
        maxWaitMinutes: 120,
        alerts: [],
        reason: "Minor complaint - standard evaluation queue",
      }),
      explain: () => "No urgent criteria met",
    },
  ],
});
```

## Profiles

```typescript
const standardProfile = {
  criticalHeartRateLow: 40,
  criticalHeartRateHigh: 150,
  criticalSystolicLow: 90,
  criticalSystolicHigh: 200,
  criticalO2Sat: 90,
  highFeverThreshold: 39.0,
  pediatricAgeThreshold: 12,
  geriatricAgeThreshold: 65,
};

const pediatricProfile = {
  criticalHeartRateLow: 60,
  criticalHeartRateHigh: 180, // Higher normal range for children
  criticalSystolicLow: 70,
  criticalSystolicHigh: 140,
  criticalO2Sat: 92, // Stricter for children
  highFeverThreshold: 38.5,
  pediatricAgeThreshold: 18,
  geriatricAgeThreshold: 65,
};
```

## Usage

```typescript
const engine = new Engine();

// Critical patient
const critical = engine.run(
  triageDecision,
  {
    heartRate: 38,
    systolicBP: 85,
    diastolicBP: 50,
    temperature: 36.5,
    oxygenSaturation: 88,
    painLevel: 6,
    age: 72,
    chiefComplaint: "Weakness and dizziness",
    symptoms: ["fatigue", "confusion"],
    isPregnant: false,
    hasChestPain: false,
    hasDifficultyBreathing: true,
  },
  { profile: standardProfile }
);

console.log(critical.data);
// {
//   triageLevel: "IMMEDIATE",
//   code: "RED",
//   maxWaitMinutes: 0,
//   alerts: ["Critical hypoxia", "Hypotension/shock", "Severe bradycardia"],
//   reason: "Life-threatening vital signs - immediate intervention required"
// }

// Stable patient with moderate pain
const stable = engine.run(
  triageDecision,
  {
    heartRate: 82,
    systolicBP: 125,
    diastolicBP: 78,
    temperature: 37.2,
    oxygenSaturation: 98,
    painLevel: 5,
    age: 35,
    chiefComplaint: "Ankle injury",
    symptoms: ["swelling", "bruising"],
    isPregnant: false,
    hasChestPain: false,
    hasDifficultyBreathing: false,
  },
  { profile: standardProfile }
);

console.log(stable.data);
// {
//   triageLevel: "LESS_URGENT",
//   code: "GREEN",
//   maxWaitMinutes: 60,
//   alerts: [],
//   reason: "Moderate symptoms requiring evaluation"
// }
```

## Audit Trail

Every triage decision is fully traceable:

```typescript
console.log(engine.explain(critical));
// Decision: emergency-triage v1.0.0
// Status: OK
// Matched: immediate-life-threat
// Reason: Critical vitals: HR=38, BP=85/50, O2=88%
//
// Evaluation trace:
//   ✓ immediate-life-threat
```

This audit trail is essential for:
- Medical record documentation
- Quality assurance review
- Legal compliance
- Training and improvement
