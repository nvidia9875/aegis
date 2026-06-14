import type { Beat, RiskTier, Severity, StageId, Step } from "./types";

const BASE = process.env.NEXT_PUBLIC_AEGIS_API || "";

interface RawAction {
  type: string;
  risk_tier: RiskTier;
  blast_radius: string;
}
interface RawReport {
  title: string;
  status: string;
  used_antibody: boolean;
  learned_antibody_id: string | null;
  pending_approval_id: string | null;
  actions: RawAction[];
  timeline: string[];
  incident: {
    service_id: string;
    incident_class: string;
    severity: Severity;
    mttr_seconds: number | null;
  } | null;
}

function lineToStage(line: string): StageId {
  const l = line.toLowerCase();
  if (l.includes("recalled antibody")) return "recall";
  if (l.includes("detected")) return "detect";
  if (l.includes("diagnosed")) return "reason";
  if (l.includes("governance") || l.includes("awaiting") || l.includes("applied") || l.includes("approved"))
    return "act";
  if (l.includes("verified")) return "verify";
  if (l.includes("immunized")) return "immunize";
  if (l.includes("reuse") || l.includes("postmortem")) return "reflect";
  return "perceive";
}

function mapReport(raw: RawReport, i: number): Beat {
  const inc = raw.incident;
  const action = raw.actions[0];
  const steps: Step[] = raw.timeline.map((text) => {
    const stage = lineToStage(text);
    return { stage, text, gate: text.toLowerCase().includes("awaiting") };
  });
  const mttr = inc?.mttr_seconds != null ? Math.max(0.3, inc.mttr_seconds) : 0;
  return {
    id: `live-${i}`,
    title: raw.title,
    serviceId: inc?.service_id ?? "service",
    serviceName: inc?.service_id ?? "service",
    incidentClass: inc?.incident_class ?? "unknown",
    severity: inc?.severity ?? "warning",
    riskTier: action?.risk_tier ?? "L1",
    action: action?.type ?? "—",
    usedAntibody: raw.used_antibody,
    learnedAntibody: raw.learned_antibody_id ?? undefined,
    coveredClass: raw.learned_antibody_id ? inc?.incident_class : undefined,
    awaitingApproval: raw.status === "awaiting_approval",
    blastRadius: action?.blast_radius,
    mttr,
    metricLabel: inc?.incident_class ?? "metric",
    metricBad: "—",
    metricGood: "ok",
    steps: steps.length ? steps : [{ stage: "detect", text: raw.title }],
  };
}

export async function fetchLiveNarrative(): Promise<Beat[] | null> {
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}/api/demo/run`, { method: "POST" });
    if (!res.ok) return null;
    const data = (await res.json()) as { beats: RawReport[] };
    return data.beats.map(mapReport);
  } catch {
    return null;
  }
}

export async function pingApi(): Promise<boolean> {
  if (!BASE) return false;
  try {
    const res = await fetch(`${BASE}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}
