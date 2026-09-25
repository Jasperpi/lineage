/**
 * Raw data files usually arrive compressed: 23andMe and AncestryDNA hand out
 * .zip archives, and people gzip large files. This opens either, or plain
 * text, using the platform's DecompressionStream (browsers since 2023, Node
 * 18+), so no third-party code touches the genotypes.
 */
export interface OpenedText { text: string; compressed?: "zip" | "gzip"; entry?: string }

async function inflate(bytes: Uint8Array, format: "gzip" | "deflate-raw"): Promise<Uint8Array> {
  const stream = new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function openRawText(bytes: Uint8Array): Promise<OpenedText> {
  const dec = new TextDecoder();
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) return { text: dec.decode(await inflate(bytes, "gzip")), compressed: "gzip" };
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    const { name, data } = await largestTextEntry(bytes);
    return { text: dec.decode(data), compressed: "zip", entry: name };
  }
  return { text: dec.decode(bytes) };
}

/** Read a zip's central directory and inflate its largest .txt/.csv/.tsv entry. */
export async function largestTextEntry(buf: Uint8Array): Promise<{ name: string; data: Uint8Array }> {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("This zip archive is damaged (no central directory).");
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const entries: Array<{ name: string; method: number; compSize: number; size: number; local: number }> = [];
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), compSize = dv.getUint32(p + 20, true), size = dv.getUint32(p + 24, true);
    const nLen = dv.getUint16(p + 28, true), xLen = dv.getUint16(p + 30, true), cLen = dv.getUint16(p + 32, true), local = dv.getUint32(p + 42, true);
    entries.push({ name: new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nLen)), method, compSize, size, local });
    p += 46 + nLen + xLen + cLen;
  }
  const e = entries.filter((x) => /\.(txt|csv|tsv)$/i.test(x.name) && !x.name.startsWith("__MACOSX")).sort((a, b) => b.size - a.size)[0];
  if (!e) throw new Error("No .txt or .csv file inside this zip archive.");
  const start = e.local + 30 + dv.getUint16(e.local + 26, true) + dv.getUint16(e.local + 28, true);
  const data = buf.subarray(start, start + e.compSize);
  if (e.method === 0) return { name: e.name, data };
  if (e.method === 8) return { name: e.name, data: await inflate(data, "deflate-raw") };
  throw new Error(`Unsupported zip compression method ${e.method}.`);
}
