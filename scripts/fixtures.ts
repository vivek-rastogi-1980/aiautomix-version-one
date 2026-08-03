import type { BusinessValidatorReport } from "@/features/ai/schemas/business-validator";
import type { BusinessIdeaInput } from "@/lib/validations/business-idea";

/**
 * Shared fixtures for the platform smoke tests.
 *
 * One sample input and one sample report, used by the engine, report and PDF
 * tests alike — so the three suites can never disagree about what a valid
 * workflow run looks like (CODING-STANDARDS: no duplicated logic).
 */

export const VALID_IDEA_INPUT: BusinessIdeaInput = {
  businessName: "Acme Invoicing",
  ideaDescription:
    "A lightweight invoicing tool for small service businesses that automates reminders, reconciles payments, and files compliant e-invoices without an accountant.",
  industry: "Fintech",
  country: "India",
  targetAudience: "Owners of service businesses with 5-50 staff",
  businessModel: "saas",
  estimatedBudget: 25000,
  currentStage: "idea",
  timeline: "6 months",
  competitors: "Zoho Invoice, FreshBooks",
  additionalNotes: "",
  projectId: "",
};

export const VALID_REPORT: BusinessValidatorReport = {
  overallScore: 74,
  recommendation: "go",
  summary:
    "A focused invoicing automation product for SMBs with a clear wedge and a credible path to early revenue.",
  problemStatement: "Manual invoicing wastes hours every week for small teams.",
  targetMarket: "SMBs with 5-50 employees across India and South-East Asia.",
  customerPersona: "Operations lead at a 20-person professional services firm.",
  marketOpportunity:
    "E-invoicing mandates and broader digitisation are pulling SMBs onto software right now.",
  scoreBreakdown: {
    marketDemand: 80,
    problemSeverity: 75,
    revenuePotential: 70,
    competition: 55,
    feasibility: 82,
    innovation: 60,
    risk: 65,
  },
  swot: {
    strengths: [
      "Clear wedge",
      "Low switching cost",
      "Founder domain expertise",
    ],
    weaknesses: ["No brand yet", "Single acquisition channel", "Thin team"],
    opportunities: [
      "E-invoicing mandates",
      "Accountant partnerships",
      "Regional expansion",
    ],
    threats: ["Incumbent bundling", "Price pressure", "Regulatory change"],
  },
  revenueModels: [
    {
      name: "Per-seat subscription",
      description: "Monthly fee per active user, billed annually.",
      potential: "high",
    },
    {
      name: "Transaction fee",
      description: "Basis points on each processed invoice.",
      potential: "medium",
    },
  ],
  risks: [
    {
      title: "Incumbent bundling",
      description: "Accounting suites could ship this capability for free.",
      severity: "high",
      mitigation: "Win on workflow depth and integrations before they react.",
    },
    {
      title: "Slow SMB sales cycles",
      description:
        "Small teams defer software purchases under budget pressure.",
      severity: "medium",
      mitigation: "Offer a self-serve tier with immediate time savings.",
    },
  ],
  recommendations: [
    {
      title: "Interview 20 SMB owners",
      description: "Validate willingness to pay before building further.",
      priority: "high",
    },
    {
      title: "Ship a narrow MVP",
      description: "One vertical, one workflow, end to end.",
      priority: "medium",
    },
  ],
  nextSteps: [
    {
      title: "Customer discovery",
      description: "Run 20 structured interviews with target buyers.",
      timeframe: "Week 1-2",
    },
    {
      title: "Prototype",
      description: "Build a clickable flow covering the core loop.",
      timeframe: "Week 3-4",
    },
  ],
};

/** Metadata a stored report would carry, for renderer and PDF tests. */
export const REPORT_SOURCE = {
  title: "Acme Invoicing",
  report: VALID_REPORT,
  createdAt: "2026-08-02T10:00:00.000Z",
  model: "gpt-4o-mini",
  promptVersion: "v1",
  durationMs: 4200,
  tokens: 3100,
} as const;
