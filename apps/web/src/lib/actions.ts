/** Things the user does that span views: opening a file, opening the demo, going somewhere. */
import { parseGedcom } from "@lineage/core";
import { call } from "./engine.js";
import { state, update, resetYou } from "./store.js";

export function go(route: string): void {
  if (location.hash !== `#/${route}`) location.hash = `#/${route}`;
  else window.dispatchEvent(new HashChangeEvent("hashchange"));
}

const busy = (label: string, fraction?: number) => update({ busy: { label, fraction } });

export async function openFile(file: File): Promise<boolean> {
  resetYou();
  busy("Reading the file", 0.02);
  try {
    const overview = await call("loadFile", { slot: "you", file, name: file.name }, (stage, f) => busy(stage, f));
    update({ you: overview, busy: undefined, error: undefined });
    return true;
  } catch (e) {
    update({ busy: undefined, error: (e as Error).message });
    return false;
  }
}

export async function openDemo(): Promise<boolean> {
  resetYou();
  busy("Loading reference data", 0.05);
  try {
    const demo = await call("loadDemo", {}, (stage, f) => busy(stage, f));
    const file = parseGedcom(demo.gedcom);
    update({ demo, you: demo.overview, gedcom: { file, name: "Demo family tree", text: demo.gedcom }, busy: undefined, error: undefined });
    return true;
  } catch (e) {
    update({ busy: undefined, error: (e as Error).message });
    return false;
  }
}

export async function ensureAncestry(): Promise<void> {
  if (!state.you || state.ancestry) return;
  busy("Loading the reference panel", 0.05);
  try {
    const ancestry = await call("ancestry", { slot: "you" }, (stage, f) => busy(stage, f));
    update({ ancestry, busy: undefined });
  } catch (e) {
    update({ busy: undefined, error: (e as Error).message });
  }
}

export async function ensureTraits(): Promise<void> {
  if (!state.you || state.traits) return;
  const traits = await call("traits", { slot: "you" });
  update({ traits });
}
