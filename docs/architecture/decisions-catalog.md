# Decisions Catalog

20 real-world decisions that products make daily.
Each is a candidate for Criterion.

---

## Category: Access

Decisions about who can see or do what.

### 1. can-view-dashboard

**Question**: Can this user view this dashboard?

```typescript
input: {
  userId: string
  dashboardId: string
  userRole: "admin" | "editor" | "viewer" | "guest"
  dashboardVisibility: "public" | "team" | "private"
  isOwner: boolean
}

profile: {
  guestAccessEnabled: boolean
}

output: {
  allowed: boolean
  reason: string
}
```

**Rules**:
- Owner always allowed
- Admin always allowed
- Public dashboards allowed for all
- Team dashboards require editor+ role
- Private dashboards require owner
- Guests blocked unless guestAccessEnabled

---

### 2. can-edit-resource

**Question**: Can this user edit this resource?

```typescript
input: {
  userId: string
  resourceId: string
  userRole: "admin" | "editor" | "viewer"
  resourceStatus: "draft" | "published" | "archived"
  isOwner: boolean
}

profile: {
  allowEditPublished: boolean
  allowEditArchived: boolean
}

output: {
  allowed: boolean
  reason: string
}
```

**Rules**:
- Viewers never allowed
- Archived requires allowEditArchived + admin
- Published requires allowEditPublished + (owner OR admin)
- Draft allowed for editor+ or owner

---

### 3. can-invite-users

**Question**: Can this user invite new members to the workspace?

```typescript
input: {
  userRole: "owner" | "admin" | "member"
  currentMemberCount: number
  pendingInviteCount: number
}

profile: {
  maxMembers: number
  maxPendingInvites: number
  memberCanInvite: boolean
}

output: {
  allowed: boolean
  reason: string
  remainingSlots: number
}
```

**Rules**:
- Owner/admin always check quota
- Member requires memberCanInvite flag
- Total (current + pending) must be < maxMembers
- Pending must be < maxPendingInvites

---

### 4. can-access-feature

**Question**: Can this user access a specific feature?

```typescript
input: {
  featureId: string
  userPlan: "free" | "starter" | "pro" | "enterprise"
  isBetaTester: boolean
  accountAge: number // days
}

profile: {
  featureFlags: Record<string, {
    minPlan: "free" | "starter" | "pro" | "enterprise"
    betaOnly: boolean
    minAccountAge: number
  }>
}

output: {
  allowed: boolean
  reason: string
  upgradeRequired: "starter" | "pro" | "enterprise" | null
}
```

---

## Category: Limits

Decisions about quotas and resource constraints.

### 5. can-create-project

**Question**: Can this user create another project?

```typescript
input: {
  currentProjectCount: number
  userPlan: "free" | "starter" | "pro" | "enterprise"
}

profile: {
  limits: {
    free: number
    starter: number
    pro: number
    enterprise: number // -1 = unlimited
  }
}

output: {
  allowed: boolean
  reason: string
  currentCount: number
  maxAllowed: number
}
```

---

### 6. check-api-quota

**Question**: Can this request proceed or is quota exhausted?

```typescript
input: {
  apiCallsToday: number
  apiCallsThisMonth: number
  requestCost: number // some endpoints cost more
  userPlan: "free" | "starter" | "pro" | "enterprise"
}

profile: {
  dailyLimits: Record<string, number>
  monthlyLimits: Record<string, number>
  burstAllowed: boolean
  burstMultiplier: number
}

output: {
  allowed: boolean
  reason: string
  remainingDaily: number
  remainingMonthly: number
  retryAfter: number | null // seconds
}
```

---

### 7. can-upload-file

**Question**: Is this file upload allowed?

```typescript
input: {
  fileSize: number // bytes
  fileType: string // mime type
  currentStorageUsed: number
  userPlan: "free" | "starter" | "pro" | "enterprise"
}

profile: {
  maxFileSize: Record<string, number>
  maxStorage: Record<string, number>
  allowedTypes: string[]
  blockedTypes: string[]
}

output: {
  allowed: boolean
  reason: string
  remainingStorage: number
}
```

---

### 8. check-rate-limit

**Question**: Is this action rate-limited?

```typescript
input: {
  actionType: "login" | "password-reset" | "api-call" | "export"
  attemptsInWindow: number
  windowStart: string // ISO timestamp
  userTier: "normal" | "trusted" | "suspicious"
}

profile: {
  limits: Record<string, {
    maxAttempts: number
    windowSeconds: number
    tierMultipliers: Record<string, number>
  }>
}

output: {
  allowed: boolean
  reason: string
  retryAfter: number | null
  remainingAttempts: number
}
```

---

## Category: Pricing

Decisions about pricing, discounts, and billing.

### 9. calculate-discount

**Question**: What discount applies to this order?

```typescript
input: {
  orderTotal: number
  customerType: "new" | "returning" | "vip"
  couponCode: string | null
  itemCount: number
  isHoliday: boolean
}

profile: {
  discounts: {
    newCustomer: number
    vipDiscount: number
    bulkThreshold: number
    bulkDiscount: number
    holidayBonus: number
    maxDiscount: number
  }
  validCoupons: Record<string, number>
}

output: {
  discountPercent: number
  discountAmount: number
  appliedDiscounts: string[]
  finalTotal: number
}
```

---

### 10. check-trial-status

**Question**: What is this user's trial status?

```typescript
input: {
  trialStartDate: string | null
  currentDate: string
  hasPaymentMethod: boolean
  usagePercent: number // how much of trial features used
}

profile: {
  trialDays: number
  extendedTrialDays: number
  extendEligibilityUsageThreshold: number
}

output: {
  status: "no-trial" | "active" | "expiring-soon" | "expired" | "extended"
  daysRemaining: number
  canExtend: boolean
  reason: string
}
```

---

### 11. determine-pricing-tier

**Question**: Which pricing tier does this usage fall into?

```typescript
input: {
  monthlyActiveUsers: number
  apiCallsPerMonth: number
  storageUsedGb: number
  featureFlags: string[]
}

profile: {
  tiers: Array<{
    name: string
    maxMau: number
    maxApiCalls: number
    maxStorageGb: number
    requiredFeatures: string[]
    price: number
  }>
}

output: {
  recommendedTier: string
  price: number
  overages: Array<{ metric: string; overage: number; cost: number }>
  reason: string
}
```

---

### 12. can-use-premium-feature

**Question**: Can this user use a premium feature?

```typescript
input: {
  featureId: string
  userPlan: "free" | "starter" | "pro" | "enterprise"
  hasLegacyAccess: boolean
  trialActive: boolean
}

profile: {
  premiumFeatures: Record<string, {
    minPlan: string
    includedInTrial: boolean
    legacyGrandfathered: boolean
  }>
}

output: {
  allowed: boolean
  reason: string
  upgradeOptions: string[]
}
```

---

## Category: Risk

Decisions about fraud, security, and compliance.

### 13. assess-transaction-risk

**Question**: What is the risk level of this transaction?

```typescript
input: {
  amount: number
  currency: string
  paymentMethod: "card" | "bank" | "crypto" | "wallet"
  userAccountAge: number // days
  previousTransactions: number
  ipCountry: string
  billingCountry: string
  isNewPaymentMethod: boolean
  hourOfDay: number
}

profile: {
  highRiskThreshold: number
  mediumRiskThreshold: number
  trustedCountries: string[]
  highRiskCountries: string[]
  newAccountDays: number
  newAccountMaxAmount: number
}

output: {
  riskLevel: "low" | "medium" | "high" | "critical"
  riskScore: number
  flags: string[]
  action: "allow" | "review" | "challenge" | "block"
  reason: string
}
```

---

### 14. require-verification

**Question**: Does this action require additional verification?

```typescript
input: {
  actionType: "withdrawal" | "password-change" | "delete-account" | "large-transfer"
  amount: number | null
  lastVerificationAge: number // minutes since last 2FA
  deviceTrusted: boolean
  locationKnown: boolean
}

profile: {
  alwaysVerify: string[]
  largeTransferThreshold: number
  verificationValidMinutes: number
  trustedDeviceSkip: boolean
}

output: {
  required: boolean
  method: "2fa" | "email" | "sms" | "none"
  reason: string
}
```

---

### 15. flag-or-block

**Question**: Should this suspicious activity be flagged or blocked?

```typescript
input: {
  activityType: "login" | "api-abuse" | "content-spam" | "payment-fraud"
  severity: number // 1-100
  previousIncidents: number
  userTier: "free" | "paid" | "enterprise"
  accountValue: number // LTV or similar
}

profile: {
  blockThreshold: number
  flagThreshold: number
  repeatOffenderMultiplier: number
  enterpriseProtection: boolean
  escalationEmail: string
}

output: {
  action: "allow" | "flag" | "block" | "escalate"
  reason: string
  notifyUser: boolean
  notifyAdmin: boolean
}
```

---

### 16. compliance-check

**Question**: Does this action comply with regulations?

```typescript
input: {
  actionType: "data-export" | "account-deletion" | "marketing-email" | "data-retention"
  userRegion: "US" | "EU" | "UK" | "CA" | "AU" | "other"
  consentGiven: boolean
  consentDate: string | null
  dataCategories: string[]
}

profile: {
  gdprRegions: string[]
  ccpaRegions: string[]
  consentRequiredActions: string[]
  retentionDays: Record<string, number>
}

output: {
  compliant: boolean
  violations: string[]
  requiredActions: string[]
  reason: string
}
```

---

## Category: State

Decisions about state transitions and workflows.

### 17. can-change-status

**Question**: Can this item transition to the requested status?

```typescript
input: {
  currentStatus: "draft" | "review" | "approved" | "published" | "archived"
  requestedStatus: "draft" | "review" | "approved" | "published" | "archived"
  userRole: "author" | "reviewer" | "admin"
  hasRequiredFields: boolean
  reviewCount: number
}

profile: {
  transitions: Record<string, string[]> // allowed transitions per status
  rolePermissions: Record<string, string[]> // which roles can trigger which transitions
  minReviewsForApproval: number
}

output: {
  allowed: boolean
  reason: string
  missingRequirements: string[]
}
```

---

### 18. check-onboarding-complete

**Question**: Has this user completed onboarding?

```typescript
input: {
  emailVerified: boolean
  profileComplete: boolean
  firstProjectCreated: boolean
  tutorialViewed: boolean
  paymentMethodAdded: boolean
  teamInvited: boolean
}

profile: {
  requiredSteps: string[]
  optionalSteps: string[]
  skipForPlans: string[]
}

output: {
  complete: boolean
  progress: number // 0-100
  remainingSteps: string[]
  canSkip: boolean
}
```

---

### 19. can-publish-content

**Question**: Can this content be published?

```typescript
input: {
  contentType: "article" | "video" | "podcast" | "course"
  wordCount: number
  hasMedia: boolean
  hasThumbnail: boolean
  moderationStatus: "pending" | "approved" | "rejected" | "none"
  authorVerified: boolean
  scheduledDate: string | null
  currentDate: string
}

profile: {
  requireModeration: boolean
  minWordCount: Record<string, number>
  requireThumbnail: boolean
  requireVerifiedAuthor: boolean
  allowScheduledPublish: boolean
}

output: {
  allowed: boolean
  reason: string
  blockers: string[]
  warnings: string[]
}
```

---

### 20. determine-next-action

**Question**: What is the next action for this workflow item?

```typescript
input: {
  workflowType: "support-ticket" | "refund-request" | "account-review"
  currentStage: string
  assignee: string | null
  priority: "low" | "medium" | "high" | "critical"
  ageHours: number
  customerTier: "free" | "paid" | "enterprise"
}

profile: {
  slaHours: Record<string, Record<string, number>> // by priority and workflow
  escalationPath: Record<string, string[]>
  autoAssignRules: boolean
}

output: {
  nextAction: "wait" | "assign" | "escalate" | "auto-resolve" | "notify-customer"
  assignTo: string | null
  deadline: string
  reason: string
}
```

---

## Summary by Category

| Category | Count | Decisions |
|----------|-------|-----------|
| Access | 4 | view-dashboard, edit-resource, invite-users, access-feature |
| Limits | 4 | create-project, api-quota, upload-file, rate-limit |
| Pricing | 4 | discount, trial-status, pricing-tier, premium-feature |
| Risk | 4 | transaction-risk, verification, flag-or-block, compliance |
| State | 4 | change-status, onboarding, publish-content, next-action |

---

## Observed Patterns

Initial pattern observations (to be formalized in Nivel 3):

| Pattern | Decisions | Shape |
|---------|-----------|-------|
| **threshold** | api-quota, upload-file, transaction-risk, discount | `value > limit → action` |
| **boolean-gate** | can-view, can-edit, can-invite | `condition → allowed: boolean` |
| **tier-based** | create-project, premium-feature, pricing-tier | `plan → limits/permissions` |
| **quota** | api-quota, rate-limit, upload-file | `usage vs limit → remaining` |
| **state-machine** | change-status, onboarding, publish | `current + requested → valid?` |
| **composite** | transaction-risk, compliance, flag-or-block | multiple factors → score/action |

---

## Next Steps

1. Select 3-5 decisions to implement as reference examples
2. Formalize patterns into reusable templates
3. Document the "happy path" for each pattern
