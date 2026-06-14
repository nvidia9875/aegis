export type StageId =
  | "detect"
  | "perceive"
  | "recall"
  | "reason"
  | "act"
  | "verify"
  | "reflect"
  | "immunize";

export type Severity = "info" | "warning" | "critical";
export type RiskTier = "L0" | "L1" | "L2";
export type Accent = "heal" | "evolve" | "warn" | "danger" | "healthy";

export interface StageMeta {
  id: StageId;
  label: string;
  accent: Accent;
}

export const STAGES: StageMeta[] = [
  { id: "detect", label: "Detect", accent: "heal" },
  { id: "perceive", label: "Perceive", accent: "heal" },
  { id: "recall", label: "Recall", accent: "evolve" },
  { id: "reason", label: "Reason", accent: "evolve" },
  { id: "act", label: "Act", accent: "warn" },
  { id: "verify", label: "Verify", accent: "healthy" },
  { id: "reflect", label: "Reflect", accent: "evolve" },
  { id: "immunize", label: "Immunize", accent: "heal" },
];

export interface Step {
  stage: StageId;
  text: string;
  gate?: boolean; // opens the governance modal
}

export interface Beat {
  id: string;
  title: string;
  serviceId: string;
  serviceName: string;
  incidentClass: string;
  severity: Severity;
  riskTier: RiskTier;
  action: string;
  usedAntibody: boolean;
  learnedAntibody?: string;
  coveredClass?: string; // failure class this beat immunizes the fleet against
  mttr: number; // seconds (display)
  metricLabel: string;
  metricBad: string;
  metricGood: string;
  awaitingApproval?: boolean;
  blastRadius?: string;
  evidence?: string[];
  steps: Step[];
}

export interface ServiceNode {
  id: string;
  name: string;
  caps: string[];
}

export const UNIVERSE_SIZE = 5; // failure-class universe for coverage %
