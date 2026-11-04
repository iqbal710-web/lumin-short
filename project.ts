import { allNodesOn, defaultAdjustments, type Adjustments, type NodeState } from "./types";

export type MediaItem = {
  id: string;
  name: string;
  url: string;
  thumb: string;
  w: number;
  h: number;
  bytes: number;
  origin: "sample" | "import";
  adjustments: Adjustments;
  nodes: NodeState;
};

let seq = 0;
export const uid = (p = "m") => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("decode failed"));
    img.src = url;
  });
}

export function makeThumb(img: HTMLImageElement, max = 190): string {
  const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.naturalWidth * s));
  c.height = Math.max(1, Math.round(img.naturalHeight * s));
  const g = c.getContext("2d")!;
  g.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.72);
}

export async function mediaFromUrl(
  url: string,
  name: string,
  origin: MediaItem["origin"],
  bytes = 0,
): Promise<MediaItem> {
  const img = await loadImage(url);
  return {
    id: uid(),
    name,
    url,
    thumb: makeThumb(img),
    w: img.naturalWidth,
    h: img.naturalHeight,
    bytes: bytes || Math.round((url.length * 3) / 4),
    origin,
    adjustments: defaultAdjustments(),
    nodes: allNodesOn(),
  };
}

export async function mediaFromFile(file: File): Promise<MediaItem> {
  const url = URL.createObjectURL(file);
  try {
    return await mediaFromUrl(url, file.name.replace(/\.[^.]+$/, ""), "import", file.size);
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

export function formatBytes(n: number) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/* ---------------- project persistence ---------------- */

export type ProjectFile = {
  app: "lumen-grade";
  version: 1;
  saved: string;
  clips: { name: string; adjustments: Adjustments; nodes: NodeState }[];
  active: number;
};

export function serialize(items: MediaItem[], activeId: string): ProjectFile {
  return {
    app: "lumen-grade",
    version: 1,
    saved: new Date().toISOString(),
    active: Math.max(0, items.findIndex((i) => i.id === activeId)),
    clips: items.map((i) => ({ name: i.name, adjustments: i.adjustments, nodes: i.nodes })),
  };
}

export function download(filename: string, data: BlobPart, type: string) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
