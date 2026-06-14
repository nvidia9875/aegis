"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { STAGES, UNIVERSE_SIZE } from "./types";
import type { Accent, Beat, StageId } from "./types";

export type Health = "healthy" | "incident" | "healing";

export interface LogLine {
  id: number;
  beat: number;
  service: string;
  text: string;
  stage: StageId;
  accent: Accent;
}

interface PlayerState {
  beatIndex: number;
  activeStage: StageId | null;
  litStages: StageId[];
  log: LogLine[];
  health: Record<string, Health>;
  antibodies: string[];
  covered: string[];
  mttr: number[];
  resolved: number;
  pendingGate: Beat | null;
  ripple: { key: number; service: string } | null;
  finished: boolean;
}

const accentForStage = (stage: StageId): Accent =>
  STAGES.find((s) => s.id === stage)?.accent ?? "heal";

function initialState(services: string[]): PlayerState {
  return {
    beatIndex: -1,
    activeStage: null,
    litStages: [],
    log: [],
    health: Object.fromEntries(services.map((s) => [s, "healthy"])) as Record<string, Health>,
    antibodies: [],
    covered: [],
    mttr: [],
    resolved: 0,
    pendingGate: null,
    ripple: null,
    finished: false,
  };
}

let LOG_ID = 0;

export function usePlayer(beats: Beat[], serviceIds: string[]) {
  const events = useMemo(
    () => beats.flatMap((beat, bi) => beat.steps.map((step) => ({ bi, beat, step }))),
    [beats],
  );

  const [state, setState] = useState<PlayerState>(() => initialState(serviceIds));
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [cursor, setCursor] = useState(-1);
  const lastProcessed = useRef(-1);

  const reset = useCallback(() => {
    setRunning(false);
    setCursor(-1);
    lastProcessed.current = -1;
    LOG_ID = 0;
    setState(initialState(serviceIds));
  }, [serviceIds]);

  const play = useCallback(() => {
    if (state.finished) reset();
    setRunning(true);
  }, [state.finished, reset]);

  const pause = useCallback(() => setRunning(false), []);

  // process the event at the current cursor
  useEffect(() => {
    if (cursor < 0 || cursor === lastProcessed.current || cursor >= events.length) return;
    lastProcessed.current = cursor;
    const { bi, beat, step } = events[cursor];

    setState((s) => {
      const newBeat = bi !== s.beatIndex;
      const lit = newBeat ? [step.stage] : [...s.litStages, step.stage];
      const health = { ...s.health };
      const log = [
        ...s.log,
        {
          id: ++LOG_ID,
          beat: bi,
          service: beat.serviceName,
          text: step.text,
          stage: step.stage,
          accent: step.gate ? ("danger" as Accent) : accentForStage(step.stage),
        },
      ];

      if (step.stage === "detect") health[beat.serviceId] = "incident";
      if (step.stage === "act" && !step.gate) health[beat.serviceId] = "healing";
      if (step.stage === "verify") health[beat.serviceId] = "healthy";

      const antibodies =
        step.stage === "immunize" && beat.learnedAntibody
          ? [...s.antibodies, beat.learnedAntibody]
          : s.antibodies;
      const covered =
        step.stage === "immunize" && beat.coveredClass && !s.covered.includes(beat.coveredClass)
          ? [...s.covered, beat.coveredClass]
          : s.covered;
      const mttr = step.stage === "verify" ? [...s.mttr, beat.mttr] : s.mttr;
      const resolved = step.stage === "verify" ? s.resolved + 1 : s.resolved;
      const ripple =
        step.stage === "immunize" || step.stage === "recall"
          ? { key: LOG_ID, service: beat.serviceId }
          : s.ripple;

      return {
        ...s,
        beatIndex: bi,
        activeStage: step.stage,
        litStages: lit,
        log,
        health,
        antibodies,
        covered,
        mttr,
        resolved,
        ripple,
        pendingGate: step.gate ? beat : s.pendingGate,
      };
    });
  }, [cursor, events]);

  // scheduler — advance the cursor on a timer, pausing on governance gates / completion
  useEffect(() => {
    if (!running || state.pendingGate) return;
    if (cursor >= events.length - 1) {
      setRunning(false);
      setState((s) => ({ ...s, finished: true, activeStage: null }));
      return;
    }
    const id = setTimeout(() => setCursor((c) => c + 1), 1000 / speed);
    return () => clearTimeout(id);
  }, [running, cursor, speed, state.pendingGate, events.length]);

  const approve = useCallback(() => {
    setState((s) => {
      if (!s.pendingGate) return s;
      const beat = s.pendingGate;
      return {
        ...s,
        pendingGate: null,
        log: [
          ...s.log,
          {
            id: ++LOG_ID,
            beat: s.beatIndex,
            service: beat.serviceName,
            text: "✅ approved by oncall — proceeding",
            stage: "act",
            accent: "healthy",
          },
        ],
      };
    });
  }, []);

  const deny = useCallback(() => {
    setRunning(false);
    setState((s) => {
      if (!s.pendingGate) return s;
      const beat = s.pendingGate;
      const health = { ...s.health, [beat.serviceId]: "incident" as Health };
      return {
        ...s,
        pendingGate: null,
        finished: true,
        activeStage: null,
        health,
        log: [
          ...s.log,
          {
            id: ++LOG_ID,
            beat: s.beatIndex,
            service: beat.serviceName,
            text: "✋ denied — incident left open for a human",
            stage: "act",
            accent: "danger",
          },
        ],
      };
    });
  }, []);

  const currentBeat = state.beatIndex >= 0 ? beats[state.beatIndex] : null;
  const coverage = state.covered.length / UNIVERSE_SIZE;

  return {
    state,
    running,
    speed,
    setSpeed,
    play,
    pause,
    reset,
    approve,
    deny,
    currentBeat,
    coverage,
  };
}
