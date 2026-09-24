/**
 * Grounded narration of a Lineage report with Claude.
 *
 * The accuracy model: the model never sees raw genotypes and never decides
 * what is true. It receives the Report's facts (each with an id, evidence,
 * source and confidence) and writes an explanation in which every sentence
 * cites the fact ids it rests on. After generation, every cited id is checked
 * against the report; any paragraph that cites a non-existent fact, or cites
 * nothing at all, is rejected and the caller is told. The output is
 * structured, so the check is mechanical rather than a matter of trust.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { Report } from "@lineage/core";

export const NarrativeSchema = z.object({
  headline: z.string().describe("One sentence stating the most important, well-supported finding."),
  sections: z.array(z.object({
    title: z.string(),
    paragraphs: z.array(z.object({
      text: z.string().describe("Plain-language explanation. State only what the cited facts support."),
      factIds: z.array(z.string()).min(1).describe("Ids of the facts this paragraph rests on."),
    })).min(1),
  })).min(1),
  questionsToVerify: z.array(z.string()).describe("Things the reader should confirm with records or additional testing before relying on them."),
  limitations: z.array(z.string()).describe("Restate the report's limitations that matter for this reader; do not invent new ones."),
});

export type Narrative = z.infer<typeof NarrativeSchema>;

export interface NarrationResult {
  narrative: Narrative;
  /** Paragraphs whose citations did not check out; if non-empty, the narrative should not be shown unedited. */
  rejectedParagraphs: Array<{ section: string; text: string; reason: string }>;
  model: string;
  usage: { inputTokens: number; outputTokens: number };
}

const SYSTEM = `You explain the results of a DNA and genealogy analysis to the person the results belong to.

You are given a JSON report. It is the only source of truth. Its "facts" array lists everything that was actually determined, each with an id, a confidence level, the evidence behind it and where applicable a literature source. Its "limitations" array lists the known caveats.

Rules:
- Every paragraph you write must cite, by id, the facts it is based on. Do not state anything that is not supported by a cited fact. If a fact has confidence "suggestive" or "unknown", say so in plain words.
- Do not add genetic, medical, historical or population claims from your own knowledge, even when you are confident they are true. If the report does not contain it, it is not in your answer. Background that helps the reader understand a term is fine as long as it makes no claim about this person.
- Never give medical advice or diagnose. Trait facts describe tendencies, not outcomes.
- Relationship predictions from shared DNA are ranges that overlap; present them as "consistent with", never as a determination.
- Write for an intelligent adult with no genetics background. Be warm, specific and honest. Prefer short paragraphs.
- Use the person's label from the report when referring to them.`;

export interface NarrateOptions {
  client?: Anthropic;
  model?: string;
  /** Called with text deltas as they stream, for progressive display. */
  onText?: (delta: string) => void;
}

export async function narrateReport(report: Report, opts: NarrateOptions = {}): Promise<NarrationResult> {
  const client = opts.client ?? new Anthropic();
  const model = opts.model ?? "claude-opus-5";
  const factIds = new Set(report.facts.map((f) => f.id));

  const stream = client.beta.messages.stream({
    model,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `Here is the report as JSON.\n\n${JSON.stringify(report, null, 2)}` }],
    output_config: { format: zodOutputFormat(NarrativeSchema), effort: "high" },
  });
  if (opts.onText) {
    for await (const ev of stream) {
      if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") opts.onText(ev.delta.text);
    }
  }
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") throw new Error("The model declined to narrate this report.");
  const text = message.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
  const narrative = NarrativeSchema.parse(JSON.parse(text));

  const rejected: NarrationResult["rejectedParagraphs"] = [];
  const cleanSections = narrative.sections.map((s) => ({
    ...s,
    paragraphs: s.paragraphs.filter((p) => {
      const bad = p.factIds.filter((id) => !factIds.has(id));
      if (bad.length) { rejected.push({ section: s.title, text: p.text, reason: `cites unknown fact id(s): ${bad.join(", ")}` }); return false; }
      return true;
    }),
  })).filter((s) => s.paragraphs.length > 0);

  return {
    narrative: { ...narrative, sections: cleanSections },
    rejectedParagraphs: rejected,
    model: message.model,
    usage: { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens },
  };
}

/** Render a narrative as Markdown with fact citations as footnote-style tags. */
export function narrativeToMarkdown(n: Narrative): string {
  const out: string[] = [`# ${n.headline}`, ""];
  for (const s of n.sections) {
    out.push(`## ${s.title}`, "");
    for (const p of s.paragraphs) out.push(`${p.text} _[${p.factIds.join(", ")}]_`, "");
  }
  if (n.questionsToVerify.length) { out.push("## Worth verifying", ""); for (const q of n.questionsToVerify) out.push(`- ${q}`); out.push(""); }
  if (n.limitations.length) { out.push("## Limitations", ""); for (const l of n.limitations) out.push(`- ${l}`); out.push(""); }
  return out.join("\n");
}
