/**
 * Minimal RFC-4180-ish delimited text reader. Handles quoted fields, embedded
 * delimiters inside quotes, and CRLF. Streams line by line so multi-hundred-
 * megabyte raw files do not need a second copy in memory.
 */

export function detectDelimiter(sample: string): "," | "\t" | ";" {
  const lines = sample.split(/\r?\n/).filter((l) => l.length > 0 && !l.startsWith("#")).slice(0, 20);
  const score = (d: string) =>
    lines.reduce((acc, l) => acc + (l.split(d).length - 1), 0);
  const tab = score("\t"), comma = score(","), semi = score(";");
  if (tab >= comma && tab >= semi) return "\t";
  if (comma >= semi) return ",";
  return ";";
}

export function splitDelimited(line: string, delim: string): string[] {
  if (!line.includes('"')) return line.split(delim);
  const out: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === delim) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

/** Iterate lines without materialising an array of all lines. */
export function* iterateLines(text: string): Generator<string> {
  let start = 0;
  while (start < text.length) {
    let end = text.indexOf("\n", start);
    if (end === -1) end = text.length;
    let line = text.slice(start, end);
    if (line.endsWith("\r")) line = line.slice(0, -1);
    yield line;
    start = end + 1;
  }
}

/** Find the column index whose header matches any of the aliases (case-insensitive). */
export function findColumn(header: string[], aliases: string[]): number {
  const norm = header.map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ""));
  for (const a of aliases) {
    const i = norm.indexOf(a.toLowerCase().replace(/[^a-z0-9]/g, ""));
    if (i !== -1) return i;
  }
  return -1;
}
