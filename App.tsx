import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/utils/cn";
import { GradeEngine } from "@/editor/engine";
import { analyze, createScopeData, peakOf, type ScopeData } from "@/editor/scopes";
import { download, mediaFromFile, mediaFromUrl, serialize, type MediaItem } from "@/editor/project";
import {
  NODES,
  allNodesOn,
  applyLook,
  clamp,
  defaultAdjustments,
  isNodeDirty,
  type Adjustments,
  type Look,
  type NodeKind,
  type NodeState,
} from "@/editor/types";
import portraitUrl from "@/assets/samples/portrait.jpg";
import landscapeUrl from "@/assets/samples/landscape.jpg";
import streetUrl from "@/assets/samples/street.jpg";

import { Viewer, computeLayout } from "@/components/Viewer";
import { LeftDock } from "@/components/LeftDock";
import { ToolDock } from "@/components/ToolDock";
import { NodeStrip, Timeline } from "@/components/Timeline";
import { Scopes } from "@/components/Scopes";
import { DeployModal, ExportModal, ShortcutsModal } from "@/components/Modals";
import { Btn, Kbd, Tag } from "@/components/ui";
import {
  IconAperture,
  IconCompare,
  IconDownload,
  IconGithub,
  IconKeyboard,
  IconNodes,
  IconRedo,
  IconReset,
  IconUndo,
} from "@/components/Icons";

const SAMPLES: [string, string][] = [
  [portraitUrl, "Portrait — Window Light"],
  [landscapeUrl, "Valley — Golden Hour"],
  [streetUrl, "Neon Rain — Night Street"],
];

type Hist = { id: string; adj: Adjustments; nodes: NodeState };

export default function App() {
  /* ---------------------------------------------------------- state */
  const [engine, setEngine] = useState<GradeEngine | null>(null);
  const [engineInfo, setEngineInfo] = useState("WebGL2");
  const [booting, setBooting] = useState(true);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [activeId, setActiveId] = useState("");
  const [tab, setTab] = useState<NodeKind>("primary");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [split, setSplit] = useState(-1);
  const [original, setOriginal] = useState(false);
  const [grid, setGrid] = useState(false);
  const [safe, setSafe] = useState(false);
  const [box, setBox] = useState({ w: 900, h: 560 });
  const [preview, setPreview] = useState<Adjustments | null>(null);
  const [lookId, setLookId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ms, setMs] = useState(0);
  const [tick, setTick] = useState(0);
  const [texVersion, setTexVersion] = useState(0);
  const [modal, setModal] = useState<null | "export" | "keys" | "deploy">(null);
  const [toast, setToast] = useState<{ msg: string; tone: "amber" | "teal" | "flame" } | null>(null);
  const [past, setPast] = useState<Hist[]>([]);
  const [project, setProject] = useState("Untitled Grade — Reel 01");
  const [future, setFuture] = useState<Hist[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scopeRef = useRef<ScopeData>(createScopeData());
  const requested = useRef<Set<string>>(new Set());
  const pending = useRef<Hist | null>(null);
  const lastScope = useRef(0);
  const toastTimer = useRef<number | undefined>(undefined);

  const itemsRef = useRef(items);
  itemsRef.current = items;

  const active = useMemo(() => items.find((i) => i.id === activeId) ?? items[0], [items, activeId]);
  const gradeAdj = preview ?? active?.adjustments ?? defaultAdjustments();
  const gradeNodes = active?.nodes ?? allNodesOn();
  const gradeKey = useMemo(() => JSON.stringify(gradeAdj), [gradeAdj]);
  const nodeKey = useMemo(() => JSON.stringify(gradeNodes), [gradeNodes]);

  const dpr = typeof window === "undefined" ? 1 : Math.min(2, window.devicePixelRatio || 1);
  const layout = useMemo(
    () => computeLayout(box.w, box.h, active?.w ?? 16, active?.h ?? 9, zoom, dpr),
    [active?.h, active?.w, box.h, box.w, dpr, zoom],
  );

  const say = useCallback((msg: string, tone: "amber" | "teal" | "flame" = "teal") => {
    setToast({ msg, tone });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2400);
  }, []);

  /* --------------------------------------------------------- engine */
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    try {
      const e = new GradeEngine(cvs);
      setEngine(e);
      setEngineInfo(e.info());
      return () => e.dispose();
    } catch (err) {
      console.error(err);
      setEngineInfo("WebGL2 unavailable");
      setBooting(false);
    }
  }, []);

  const renderFrame = useCallback(() => {
    if (!engine || !active || !engine.has(active.id)) return;
    const t0 = performance.now();
    engine.resize(layout.bufW, layout.bufH);
    engine.draw(active.id, gradeAdj, gradeNodes, { split, original });
    const dt = performance.now() - t0;
    setMs((prev) => (Math.abs(prev - dt) > 0.4 ? dt : prev));

    const now = performance.now();
    if (now - lastScope.current > 105) {
      lastScope.current = now;
      if (analyze(engine.canvas, scopeRef.current, 184)) setTick((t) => t + 1);
    }
    // texVersion re-triggers this callback as soon as a GPU texture lands
  }, [active, engine, gradeAdj, gradeNodes, layout.bufH, layout.bufW, original, split, texVersion]);

  useEffect(() => {
    renderFrame();
  }, [renderFrame, gradeKey, nodeKey]);

  /* -------------------------------------------------- media loading */
  const registerTextures = useCallback(() => {
    if (!engine) return;
    for (const m of itemsRef.current) {
      if (engine.has(m.id) || requested.current.has(m.id)) continue;
      requested.current.add(m.id);
      const img = new Image();
      img.onload = () => {
        engine.addImage(m.id, img, m.w, m.h);
        setTexVersion((v) => v + 1);
      };
      img.onerror = () => requested.current.delete(m.id);
      img.src = m.url;
    }
  }, [engine]);

  useEffect(() => {
    registerTextures();
  }, [registerTextures, items]);

  useEffect(() => {
    let dead = false;
    (async () => {
      const loaded: MediaItem[] = [];
      for (const [url, name] of SAMPLES) {
        try {
          loaded.push(await mediaFromUrl(url, name, "sample"));
        } catch {
          /* ignore broken sample */
        }
      }
      if (dead || !loaded.length) {
        setBooting(false);
        return;
      }
      setItems(loaded);
      setActiveId(loaded[0].id);
      setTimeout(() => !dead && setBooting(false), 520);
    })();
    return () => {
      dead = true;
    };
  }, []);

  /* ------------------------------------------------- container size */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setBox({ w: Math.max(60, r.width), h: Math.max(60, r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* -------------------------------------------------------- history */
  const snapshot = useCallback((): Hist | null => {
    const it = itemsRef.current.find((i) => i.id === activeId);
    if (!it) return null;
    return { id: it.id, adj: structuredClone(it.adjustments), nodes: { ...it.nodes } };
  }, [activeId]);

  const beginEdit = useCallback(() => {
    if (!pending.current) pending.current = snapshot();
  }, [snapshot]);

  const commit = useCallback(() => {
    if (!pending.current) return;
    const h = pending.current;
    pending.current = null;
    setPast((p) => [...p.slice(-49), h]);
    setFuture([]);
  }, []);

  const patch = useCallback(
    (p: Partial<Adjustments>) => {
      beginEdit();
      setLookId(null);
      setItems((list) =>
        list.map((m) => (m.id === activeId ? { ...m, adjustments: { ...m.adjustments, ...p } } : m)),
      );
    },
    [activeId, beginEdit],
  );

  const setNodes = useCallback(
    (n: Partial<NodeState>) => {
      beginEdit();
      setItems((list) =>
        list.map((m) => (m.id === activeId ? { ...m, nodes: { ...m.nodes, ...n } } : m)),
      );
      commit();
    },
    [activeId, beginEdit, commit],
  );

  const applyHist = useCallback((h: Hist) => {
    setItems((list) => list.map((m) => (m.id === h.id ? { ...m, adjustments: h.adj, nodes: h.nodes } : m)));
    setActiveId(h.id);
  }, []);

  const undo = useCallback(() => {
    setPast((p) => {
      if (!p.length) return p;
      const cur = snapshot();
      const h = p[p.length - 1];
      if (cur) setFuture((f) => [...f, cur]);
      applyHist(h);
      return p.slice(0, -1);
    });
  }, [applyHist, snapshot]);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (!f.length) return f;
      const cur = snapshot();
      const h = f[f.length - 1];
      if (cur) setPast((p) => [...p, cur]);
      applyHist(h);
      return f.slice(0, -1);
    });
  }, [applyHist, snapshot]);

  const resetNode = useCallback(
    (kind: NodeKind) => {
      beginEdit();
      const d = defaultAdjustments();
      const it = itemsRef.current.find((m) => m.id === activeId);
      if (!it) return;
      let adj = { ...it.adjustments };
      if (kind === "primary")
        adj = {
          ...adj,
          exposure: d.exposure,
          contrast: d.contrast,
          pivot: d.pivot,
          highlights: 0,
          shadows: 0,
          whites: 0,
          blacks: 0,
          temperature: 0,
          tint: 0,
          vibrance: 0,
          saturation: 1,
        };
      if (kind === "wheels") adj = { ...adj, lift: d.lift, gamma: d.gamma, gain: d.gain, offset: d.offset };
      if (kind === "curves") adj = { ...adj, curves: d.curves };
      if (kind === "split") adj = { ...adj, shadowAmt: 0, highAmt: 0 };
      if (kind === "fx")
        adj = {
          ...adj,
          sharpen: 0,
          blur: 0,
          bloom: 0,
          bloomThreshold: d.bloomThreshold,
          vignette: 0,
          vignetteSoft: d.vignetteSoft,
          grain: 0,
          chroma: 0,
          intensity: 1,
        };
      setItems((list) => list.map((m) => (m.id === activeId ? { ...m, adjustments: adj } : m)));
      setLookId(null);
      commit();
      say(`${NODES.find((n) => n.id === kind)?.label} node reset`, "amber");
    },
    [activeId, beginEdit, commit, say],
  );

  const resetAll = useCallback(() => {
    beginEdit();
    setItems((list) =>
      list.map((m) =>
        m.id === activeId ? { ...m, adjustments: defaultAdjustments(), nodes: allNodesOn() } : m,
      ),
    );
    setLookId(null);
    commit();
    say("Grade cleared", "amber");
  }, [activeId, beginEdit, commit, say]);

  /* --------------------------------------------------------- auto tone */
  const autoTone = useCallback(() => {
    if (!engine || !active || !engine.has(active.id)) return;
    // measure the *source* pixels: render ungraded into the buffer, analyse, restore
    engine.resize(layout.bufW, layout.bufH);
    engine.draw(active.id, gradeAdj, gradeNodes, { split: -1, original: true });
    const s = createScopeData();
    if (!analyze(engine.canvas, s, 200)) {
      renderFrame();
      say("Auto tone needs pixel access", "flame");
      return;
    }
    const [R, G, B] = s.avg.map((v) => v / 255);
    const mean = Math.max(0.001, R * 0.2126 + G * 0.7152 + B * 0.0722);

    // percentile spread of the luma histogram
    const total = s.samples;
    let acc = 0;
    let p1 = 0;
    let p99 = 1;
    for (let i = 0; i < 256; i++) {
      acc += s.luma[i];
      if (p1 === 0 && acc > total * 0.01) p1 = i / 255;
      if (acc > total * 0.99) {
        p99 = i / 255;
        break;
      }
    }
    const spread = Math.max(0.08, p99 - p1);

    let hi = 0;
    let lo = 0;
    for (let i = 250; i < 256; i++) hi += s.luma[i];
    for (let i = 0; i < 6; i++) lo += s.luma[i];

    const r2 = (v: number, lim: number) => Math.round(clamp(v, -lim, lim) * 100) / 100;
    const next: Partial<Adjustments> = {
      exposure: r2(Math.log2(0.44 / mean) * 0.85, 1.6),
      contrast: r2((0.74 - spread) * 0.95, 0.45),
      blacks: r2(Math.max(0, p1 - 0.012) * 1.6, 0.35),
      whites: r2(Math.max(0, 0.985 - p99) * 1.1, 0.3),
      highlights: hi > total * 0.004 ? -0.18 : r2((0.9 - p99) * 0.25, 0.25),
      shadows: lo > total * 0.006 ? 0.16 : r2((0.08 - p1) * 0.5, 0.22),
      temperature: r2(((R - B) / Math.max(0.05, (R + B) / 2)) * -0.42, 0.55),
      tint: r2(((G - (R + B) / 2) / Math.max(0.05, mean)) * -0.34, 0.35),
    };
    beginEdit();
    setLookId(null);
    setItems((list) =>
      list.map((m) => (m.id === activeId ? { ...m, adjustments: { ...m.adjustments, ...next } } : m)),
    );
    commit();
    renderFrame();
    say(`Auto tone · EV ${next.exposure} · WB ${next.temperature}`, "teal");
  }, [active, activeId, beginEdit, commit, engine, gradeAdj, gradeNodes, layout.bufH, layout.bufW, renderFrame, say]);

  /* ------------------------------------------------------------ looks */
  const tweenLook = useRef<number | undefined>(undefined);
  const onApplyLook = useCallback(
    (look: Look) => {
      window.clearTimeout(tweenLook.current);
      const it = itemsRef.current.find((m) => m.id === activeId);
      if (!it) return;
      beginEdit();
      const target = applyLook(look);
      const from = it.adjustments;
      const t0 = performance.now();
      const dur = 420;
      const step = () => {
        const k = clamp((performance.now() - t0) / dur, 0, 1);
        const e = 1 - Math.pow(1 - k, 3);
        const mixed = mixAdjustments(from, target, e);
        setItems((list) => list.map((m) => (m.id === activeId ? { ...m, adjustments: mixed } : m)));
        if (k < 1) tweenLook.current = window.setTimeout(step, 16);
        else commit();
      };
      step();
      setLookId(look.id);
      setPreview(null);
      say(`Look applied · ${look.name}`, "teal");
    },
    [activeId, beginEdit, commit, say],
  );

  const onPreviewLook = useCallback(
    (look: Look | null) => {
      if (!look) {
        setPreview(null);
        return;
      }
      setPreview(applyLook(look));
    },
    [],
  );

  /* ------------------------------------------------------------- io */
  const onFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files);
      for (const f of arr) {
        if (f.type === "application/json" || f.name.endsWith(".json")) {
          try {
            const proj = JSON.parse(await f.text());
            if (proj?.app === "lumen-grade") {
              beginEdit();
              setItems((list) =>
                list.map((m, i) =>
                  proj.clips?.[i] ? { ...m, adjustments: proj.clips[i].adjustments, nodes: proj.clips[i].nodes } : m,
                ),
              );
              commit();
              say(`Project loaded · ${proj.clips?.length ?? 0} clips`, "teal");
            }
          } catch {
            say("Project file could not be read", "flame");
          }
          continue;
        }
        if (!f.type.startsWith("image/")) continue;
        try {
          const m = await mediaFromFile(f);
          setItems((list) => [...list, m]);
          setActiveId(m.id);
          say(`Imported · ${m.name}`, "teal");
        } catch {
          say(`Could not decode ${f.name}`, "flame");
        }
      }
    },
    [beginEdit, commit, say],
  );

  const removeItem = useCallback(
    (id: string) => {
      engine?.removeImage(id);
      requested.current.delete(id);
      setItems((list) => {
        const next = list.filter((m) => m.id !== id);
        if (id === activeId && next.length) setActiveId(next[Math.max(0, next.length - 1)].id);
        return next;
      });
      say("Clip removed", "amber");
    },
    [activeId, engine, say],
  );

  const doExport = useCallback(
    (o: { format: string; quality: number; scale: number; filename: string }) => {
      if (!engine || !active) return;
      setBusy(true);
      window.setTimeout(() => {
        try {
          const c = engine.exportCanvas(active.id, active.adjustments, active.nodes, o.scale);
          if (!c) throw new Error("render failed");
          c.toBlob(
            (blob) => {
              if (blob) {
                download(o.filename, blob, o.format);
                say(`Rendered ${c.width}×${c.height} · ${o.filename}`, "teal");
              }
              setBusy(false);
              setModal(null);
              renderFrame();
            },
            o.format,
            o.quality,
          );
        } catch (e) {
          console.error(e);
          setBusy(false);
          say("Export failed", "flame");
        }
      }, 40);
    },
    [active, engine, renderFrame, say],
  );

  /* -------------------------------------------------------- shortcuts */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "e") {
        e.preventDefault();
        setModal("export");
        return;
      }
      if (mod && e.key.toLowerCase() === "o") {
        e.preventDefault();
        fileRef.current?.click();
        return;
      }
      if (mod) return;
      switch (e.key) {
        case "\\":
          setSplit((s) => (s >= 0 ? -1 : 0.5));
          break;
        case "y":
        case "Y":
          setOriginal((o) => !o);
          break;
        case "f":
        case "F":
          setZoom(1);
          setPan({ x: 0, y: 0 });
          break;
        case "g":
        case "G":
          setGrid((v) => !v);
          break;
        case "s":
        case "S":
          setSafe((v) => !v);
          break;
        case "b":
        case "B":
          setNodes({ [tab]: !gradeNodes[tab] } as Partial<NodeState>);
          break;
        case "r":
        case "R":
          resetNode(tab);
          break;
        case "0":
          resetAll();
          break;
        case "+":
        case "=":
          setZoom((z) => clamp(z * 1.25, 0.06, 12));
          break;
        case "-":
        case "_":
          setZoom((z) => clamp(z / 1.25, 0.06, 12));
          break;
        case "?":
          setModal("keys");
          break;
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
          setTab(NODES[Number(e.key) - 1].id);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gradeNodes, redo, resetAll, resetNode, setNodes, tab, undo]);

  const selectItem = useCallback((id: string) => {
    setActiveId(id);
    setPreview(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  /* ------------------------------------------------------------- UI */
  const lumaPeak = peakOf(scopeRef.current.luma);

  return (
    <div className="app-bg relative flex h-screen w-screen flex-col overflow-hidden font-sans text-txt">
      <div className="grid-fade pointer-events-none absolute inset-x-0 top-0 h-[420px]" />

      {/* ============================ header ============================ */}
      <header className="relative z-20 flex h-[52px] shrink-0 items-center gap-3 border-b border-line bg-panel/70 px-3 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-[7px] border border-amber/35 bg-[#15120c]">
            <IconAperture width={17} height={17} className="text-amber" />
            <span className="spin-slow absolute inset-[-3px] rounded-[9px] border border-dashed border-amber/20" />
          </div>
          <div className="leading-none">
            <h1 className="font-display text-[15px] font-bold tracking-[0.2em] text-txt uppercase">
              Lumen<span className="text-amber">Grade</span>
            </h1>
            <p className="mt-[3px] font-mono text-[8.5px] tracking-[0.22em] text-faint uppercase">
              node color suite · v1.0
            </p>
          </div>
        </div>

        <div className="mx-2 h-7 w-px bg-line" />

        <div className="group hidden min-w-0 items-center gap-2 rounded-[6px] border border-transparent px-2 py-1 transition-colors hover:border-line focus-within:border-amber/45 focus-within:bg-base/60 md:flex">
          <IconNodes width={13} height={13} className="shrink-0 text-faint" />
          <input
            value={project}
            onChange={(e) => setProject(e.target.value)}
            spellCheck={false}
            className="w-[190px] truncate bg-transparent text-[11.5px] text-dim caret-amber outline-none transition-colors focus:text-txt"
            title="Project name"
          />
          <Tag tone="dim">autosave</Tag>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <Btn size="sm" title="Undo (Ctrl+Z)" onClick={undo} disabled={!past.length} icon={<IconUndo width={13} height={13} />} />
          <Btn size="sm" title="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={!future.length} icon={<IconRedo width={13} height={13} />} />
          <span className="mx-1 h-5 w-px bg-line" />
          <Btn
            size="sm"
            title="Compare wipe (\)"
            active={split >= 0}
            onClick={() => setSplit((s) => (s >= 0 ? -1 : 0.5))}
            icon={<IconCompare width={13} height={13} />}
          >
            <span className="hidden xl:inline">Compare</span>
          </Btn>
          <Btn size="sm" title="Reset entire grade (0)" onClick={resetAll} icon={<IconReset width={13} height={13} />}>
            <span className="hidden xl:inline">Reset</span>
          </Btn>
          <span className="mx-1 h-5 w-px bg-line" />
          <Btn size="sm" title="Keyboard shortcuts (?)" onClick={() => setModal("keys")} icon={<IconKeyboard width={13} height={13} />} />
          <Btn
            size="sm"
            variant="outline"
            title="Deploy to GitHub Pages"
            onClick={() => setModal("deploy")}
            icon={<IconGithub width={13} height={13} />}
          >
            Deploy
          </Btn>
          <Btn size="md" variant="solid" title="Export (Ctrl+E)" onClick={() => setModal("export")} icon={<IconDownload width={14} height={14} />}>
            Export
          </Btn>
        </div>
      </header>

      {/* ============================ body ============================ */}
      <div className="relative z-10 flex min-h-0 flex-1">
        <LeftDock
          items={items}
          activeId={activeId}
          onSelect={selectItem}
          onRemove={removeItem}
          onFiles={onFiles}
          onOpenPicker={() => fileRef.current?.click()}
          onApplyLook={onApplyLook}
          onPreviewLook={onPreviewLook}
          activeLookId={lookId}
        />

        <main className="relative flex min-w-0 flex-1 flex-col">
          <Viewer
            canvasRef={canvasRef}
            containerRef={containerRef}
            imgW={active?.w ?? 16}
            imgH={active?.h ?? 9}
            name={active?.name ?? "No media"}
            empty={!active}
            layout={layout}
            zoom={zoom}
            pan={pan}
            split={split}
            original={original}
            showGrid={grid}
            showSafe={safe}
            dirty={preview ? true : NODES.some((n) => active && isNodeDirty(active.adjustments, n.id))}
            onZoom={(z) => setZoom(z)}
            onPan={setPan}
            onSplit={setSplit}
            onOriginal={setOriginal}
            onGrid={() => setGrid((v) => !v)}
            onSafe={() => setSafe((v) => !v)}
            onFit={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            onFiles={onFiles}
            onOpenPicker={() => fileRef.current?.click()}
          />
        </main>

        <ToolDock
          adj={gradeAdj}
          nodes={gradeNodes}
          tab={tab}
          onTab={setTab}
          patch={patch}
          commit={commit}
          onResetNode={resetNode}
          onToggleNode={(k) => setNodes({ [k]: !gradeNodes[k] } as Partial<NodeState>)}
          onAuto={autoTone}
          lumaHist={scopeRef.current.luma}
          lumaPeak={lumaPeak}
        />
      </div>

      {/* ============================ bottom ============================ */}
      <div className="relative z-10 flex h-[152px] shrink-0 border-t border-line bg-panel/60 backdrop-blur-md">
        <div className="flex min-w-0 flex-1 flex-col">
          <NodeStrip
            nodes={gradeNodes}
            adj={gradeAdj}
            selected={tab}
            onSelect={setTab}
            onToggle={(k) => setNodes({ [k]: !gradeNodes[k] } as Partial<NodeState>)}
          />
          <div className="hair h-px" />
          <Timeline
            items={items}
            activeId={activeId}
            onSelect={selectItem}
            onAdd={() => fileRef.current?.click()}
          />
        </div>
        <div className="hidden w-[262px] shrink-0 border-l border-line bg-panel/40 lg:block xl:w-[302px]">
          <Scopes data={scopeRef.current} tick={tick} />
        </div>
      </div>

      {/* ============================ status ============================ */}
      <footer className="relative z-10 flex h-[24px] shrink-0 items-center gap-3 border-t border-line bg-[#080a0d] px-3 font-mono text-[9.5px] tracking-wide text-faint">
        <span className="flex items-center gap-1.5">
          <span className="rec-dot h-[5px] w-[5px] rounded-full bg-[#62d26f]" />
          <span className="text-dim">GPU</span>
          <span className="max-w-[230px] truncate">{engineInfo}</span>
        </span>
        <span className="h-3 w-px bg-line" />
        <span className="tabular">
          {active ? `${active.w}×${active.h}` : "—"} · {Math.round(zoom * 100)}%
        </span>
        <span className="h-3 w-px bg-line" />
        <span className="tabular">render {ms.toFixed(1)} ms</span>
        <span className="h-3 w-px bg-line" />
        <span className="tabular">{items.length} clips</span>
        <span className="ml-auto hidden items-center gap-2 lg:flex">
          <span>
            <Kbd>\</Kbd> compare
          </span>
          <span>
            <Kbd>Y</Kbd> original
          </span>
          <span>
            <Kbd>0</Kbd> reset
          </span>
          <span>
            <Kbd>Ctrl</Kbd>+<Kbd>E</Kbd> export
          </span>
          <span>
            <Kbd>?</Kbd> all keys
          </span>
        </span>
      </footer>

      {/* ============================ overlays ============================ */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*,.json"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {toast && (
        <div className="pointer-events-none fixed bottom-[52px] left-1/2 z-40 -translate-x-1/2">
          <div
            className={cn(
              "pop-in flex items-center gap-2 rounded-[7px] border bg-[#0c0f14]/95 px-3 py-1.5 shadow-[0_18px_44px_-22px_#000] backdrop-blur",
              toast.tone === "amber" && "border-amber/45 text-amber",
              toast.tone === "teal" && "border-teal/45 text-teal",
              toast.tone === "flame" && "border-flame/50 text-flame",
            )}
          >
            <span className="h-[6px] w-[6px] rounded-full bg-current" />
            <span className="font-mono text-[10.5px] tracking-wide">{toast.msg}</span>
          </div>
        </div>
      )}

      {booting && (
        <div className="fade-in fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#07080a]">
          <div className="relative mb-4 flex h-12 w-12 items-center justify-center rounded-[10px] border border-amber/40 bg-[#14110b]">
            <IconAperture width={24} height={24} className="text-amber" />
            <span className="spin-slow absolute inset-[-5px] rounded-[13px] border border-dashed border-amber/25" />
          </div>
          <p className="font-display text-[13px] font-semibold tracking-[0.34em] text-txt uppercase">
            Lumen<span className="text-amber">Grade</span>
          </p>
          <div className="relative mt-3 h-[3px] w-[164px] overflow-hidden rounded-full bg-[#171b22]">
            <span className="sweep absolute inset-0 block" />
          </div>
          <p className="mt-3 font-mono text-[9.5px] tracking-[0.2em] text-faint uppercase">
            compiling shaders · loading media
          </p>
        </div>
      )}

      <ExportModal
        open={modal === "export"}
        onClose={() => setModal(null)}
        name={active?.name ?? "image"}
        imgW={active?.w ?? 1}
        imgH={active?.h ?? 1}
        onExport={doExport}
        busy={busy}
        onSaveProject={() => {
          download(`lumen-grade-project.json`, JSON.stringify(serialize(items, activeId), null, 2), "application/json");
          say("Project saved to .json", "teal");
        }}
      />
      <ShortcutsModal open={modal === "keys"} onClose={() => setModal(null)} />
      <DeployModal open={modal === "deploy"} onClose={() => setModal(null)} />
    </div>
  );
}

/* ----------------------------------------------------------- helpers */

function mixAdjustments(a: Adjustments, b: Adjustments, t: number): Adjustments {
  const num = (x: number, y: number) => x + (y - x) * t;
  const wheel = (x: { x: number; y: number; master: number }, y: { x: number; y: number; master: number }) => ({
    x: num(x.x, y.x),
    y: num(x.y, y.y),
    master: num(x.master, y.master),
  });
  const pts = (x: { x: number; y: number }[], y: { x: number; y: number }[]) =>
    t > 0.5 ? y.map((p) => ({ ...p })) : x.map((p) => ({ ...p }));
  return {
    ...a,
    exposure: num(a.exposure, b.exposure),
    contrast: num(a.contrast, b.contrast),
    pivot: num(a.pivot, b.pivot),
    highlights: num(a.highlights, b.highlights),
    shadows: num(a.shadows, b.shadows),
    whites: num(a.whites, b.whites),
    blacks: num(a.blacks, b.blacks),
    temperature: num(a.temperature, b.temperature),
    tint: num(a.tint, b.tint),
    vibrance: num(a.vibrance, b.vibrance),
    saturation: num(a.saturation, b.saturation),
    lift: wheel(a.lift, b.lift),
    gamma: wheel(a.gamma, b.gamma),
    gain: wheel(a.gain, b.gain),
    offset: wheel(a.offset, b.offset),
    curves: {
      master: pts(a.curves.master, b.curves.master),
      red: pts(a.curves.red, b.curves.red),
      green: pts(a.curves.green, b.curves.green),
      blue: pts(a.curves.blue, b.curves.blue),
    },
    shadowHue: b.shadowHue,
    shadowAmt: num(a.shadowAmt, b.shadowAmt),
    highHue: b.highHue,
    highAmt: num(a.highAmt, b.highAmt),
    sharpen: num(a.sharpen, b.sharpen),
    blur: num(a.blur, b.blur),
    bloom: num(a.bloom, b.bloom),
    bloomThreshold: num(a.bloomThreshold, b.bloomThreshold),
    vignette: num(a.vignette, b.vignette),
    vignetteSoft: num(a.vignetteSoft, b.vignetteSoft),
    grain: num(a.grain, b.grain),
    chroma: num(a.chroma, b.chroma),
    intensity: num(a.intensity, b.intensity),
  };
}
