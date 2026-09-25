/**
 * Application state. Genetic data never lives here: the worker holds the
 * parsed files, and the page keeps only the summaries it draws. Nothing is
 * written to storage except the colour theme.
 */
import type { AncestryResult, CompareView, DemoView, KitOverview, MatchesView } from "./protocol.js";
import type { GedcomFile, TraitCall } from "@lineage/core";

export interface State {
  you?: KitOverview;
  demo?: DemoView;
  ancestry?: AncestryResult;
  traits?: TraitCall[];
  other?: { slot: string; name: string; overview?: KitOverview };
  compare?: CompareView;
  matches?: MatchesView;
  matchesName?: string;
  gedcom?: { file: GedcomFile; name: string; text: string };
  busy?: { label: string; fraction?: number };
  error?: string;
  /** Bumped by views that need to redraw themselves after a local change. */
  tick?: number;
}

export const state: State = {};
const listeners = new Set<() => void>();

export function update(patch: Partial<State>): void {
  Object.assign(state, patch);
  for (const l of listeners) l();
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Redraw the current view (after a local change such as a revealed answer). */
export function refresh(): void {
  update({ tick: (state.tick ?? 0) + 1 });
}

/** Forget the loaded file and everything derived from it. */
export function resetYou(): void {
  update({ you: undefined, ancestry: undefined, traits: undefined, compare: undefined, other: undefined, demo: undefined, matches: undefined, matchesName: undefined, gedcom: undefined, error: undefined });
}
