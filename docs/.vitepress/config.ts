import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Criterion",
  description: "Universal decision engine for business-critical decisions",

  base: "/criterionx/",

  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/criterionx/isologo.svg" }],
  ],

  themeConfig: {
    logo: "/criterionxlogo.svg",

    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Playground", link: "/guide/playground" },
      { text: "API", link: "/api/engine" },
      { text: "Examples", link: "/examples/currency-risk" },
      { text: "Architecture", link: "/architecture/manifesto" },
      {
        text: "0.3.0",
        items: [
          { text: "Changelog", link: "/changelog" },
          { text: "@criterionx/core", link: "https://www.npmjs.com/package/@criterionx/core" },
          { text: "@criterionx/server", link: "https://www.npmjs.com/package/@criterionx/server" },
        ],
      },
    ],

    sidebar: {
      "/guide/": [
        {
          text: "Introduction",
          items: [
            { text: "What is Criterion?", link: "/guide/what-is-criterion" },
            { text: "Getting Started", link: "/guide/getting-started" },
            { text: "Playground", link: "/guide/playground" },
            { text: "Migration Guide", link: "/guide/migration" },
            { text: "Core Concepts", link: "/guide/core-concepts" },
          ],
        },
        {
          text: "Fundamentals",
          items: [
            { text: "Decisions", link: "/guide/decisions" },
            { text: "Rules", link: "/guide/rules" },
            { text: "Profiles", link: "/guide/profiles" },
            { text: "Validation", link: "/guide/validation" },
          ],
        },
        {
          text: "Advanced",
          items: [
            { text: "Profile Registry", link: "/guide/profile-registry" },
            { text: "Explainability", link: "/guide/explainability" },
            { text: "Testing", link: "/guide/testing" },
            { text: "Performance", link: "/guide/performance" },
          ],
        },
        {
          text: "Server",
          items: [
            { text: "HTTP Server", link: "/guide/server" },
          ],
        },
      ],
      "/api/": [
        {
          text: "@criterionx/core",
          items: [
            { text: "Engine", link: "/api/engine" },
            { text: "Types", link: "/api/types" },
            { text: "Helpers", link: "/api/helpers" },
          ],
        },
        {
          text: "@criterionx/server",
          items: [
            { text: "Server API", link: "/api/server" },
          ],
        },
      ],
      "/examples/": [
        {
          text: "Finance",
          items: [
            { text: "Currency Risk", link: "/examples/currency-risk" },
            { text: "Loan Approval", link: "/examples/loan-approval" },
            { text: "KYC Risk Assessment", link: "/examples/fintech-kyc" },
          ],
        },
        {
          text: "E-commerce",
          items: [
            { text: "Dynamic Pricing", link: "/examples/ecommerce-pricing" },
          ],
        },
        {
          text: "Healthcare",
          items: [
            { text: "Emergency Triage", link: "/examples/healthcare-triage" },
          ],
        },
        {
          text: "Other",
          items: [
            { text: "User Eligibility", link: "/examples/user-eligibility" },
          ],
        },
      ],
      "/architecture/": [
        {
          text: "Philosophy",
          items: [
            { text: "Manifesto", link: "/architecture/manifesto" },
            { text: "Invariants", link: "/architecture/invariants" },
            { text: "Out of Scope", link: "/architecture/out-of-scope" },
          ],
        },
        {
          text: "Design",
          items: [
            { text: "Core Concepts", link: "/architecture/core-concepts" },
            { text: "API Surface", link: "/architecture/api-surface" },
            { text: "Decision Profiles", link: "/architecture/decision-profiles" },
          ],
        },
        {
          text: "Patterns",
          items: [
            { text: "Integration Patterns", link: "/architecture/integration-patterns" },
            { text: "Anti-Patterns", link: "/architecture/anti-patterns" },
            { text: "Versioning", link: "/architecture/versioning" },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: "github", link: "https://github.com/tomymaritano/criterionx" },
    ],

    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright 2024-present Tomas Maritano",
    },

    search: {
      provider: "local",
    },

    editLink: {
      pattern: "https://github.com/tomymaritano/criterionx/edit/main/docs/:path",
      text: "Edit this page on GitHub",
    },
  },
});
