import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, UploadCloud } from 'lucide-react';
import sampleMountain from './assets/samples/mountain.jpg';
import sampleStreet from './assets/samples/street.jpg';
import samplePortrait from './assets/samples/portrait.jpg';
import type {
  EditState,
  ExportSettings,
  Finishing,
  Grade,
  GradeNode,
  LutData,
  MediaItem,
  ModalId,
  Page,
  PaletteTab,
  ScopeType,
  Still,
  Transform,
  ViewOptions,
} from './types';
import { EditorContext, type Editor } from './state/editor';
import { useHistory, type HistoryState } from './hooks';
import { cloneNodes, defaultEdit, defaultFinishing, defaultGrade, editHasChanges, makeNode, normalizeGrade, uid } from './lib/grade';
import { aspectValue, cropForAspect, orientedSize } from './lib/transform';
import { downloadBlob, downloadText, generateLutText, loadImage, makeThumb, outputName, renderFull, renderGradedThumb, zipFiles } from './lib/media';
import { parseCube } from './lib/cube';
import type { Look } from './lib/looks';
import { PageNav, TopBar } from './components/TopBar';
import { ColorPage } from './components/ColorPage';
import { MediaPage } from './components/MediaPage';
import { DeliverPage } from './components/DeliverPage';
import { Modals } from './components/Modals';

const SAMPLES = [
  { name: 'Alpine Sunrise.jpg', src: sampleMountain },
  { name: 'Neon Rain.jpg', src: sampleStreet },
  { name: 'Golden Hour Portrait.jpg', src: samplePortrait },
];
const IMAGE_RE = /\.(jpe?g|png|webp|avif|gif|bmp)$/i;
const PALETTE_KEYS: PaletteTab[] = ['wheels', 'curves', 'adjust', 'effects', 'transform'];
const dataUrlBytes = (s: string) => (s.startsWith('data:') ? Math.round((s.length - s.indexOf(',') - 1) * 0.75) : undefined);
const baseName = (n?: string) => (n ?? 'grade').replace(/\.[^.]+$/, '');

interface NewMedia {
  name: string;
  src: string;
  bytes?: number;
  sample?: boolean;
  objectUrl?: boolean;
}

export default function App() {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const mediaRef = useRef<MediaItem[]>([]);
  mediaRef.current = media;
  const [currentId, setCurrentId] = useState<string | null>(null);
  const currentIdRef = useRef<string | null>(null);
  const [currentImage, setCurrentImage] = useState<HTMLImageElement | null>(null);
  const images = useRef(new Map<string, HTMLImageElement>());
  const objectUrls = useRef(new Map<string, string>());
  const histories = useRef(new Map<string, HistoryState<EditState>>());

  const history = useHistory<EditState>(defaultEdit);
  const hs = history.get();
  const edit = hs.present;

  const [selectedNodeId, setSelectedNodeId] = useState(() => edit.nodes[0].id);
  const [page, setPage] = useState<Page>('color');
  const [palette, setPalette] = useState<PaletteTab>('wheels');
  const [scopeType, setScopeType] = useState<ScopeType>('parade');
  const [view, setViewState] = useState<ViewOptions>({ compare: 'off', split: 0.5, clipping: false, cropMode: false, cinema: false });
  const [luts, setLuts] = useState<Record<string, LutData>>({});
  const lutsRef = useRef(luts);
  lutsRef.current = luts;
  const [stills, setStills] = useState<Still[]>([]);
  const stillCounter = useRef(0);
  const [clipboard, setClipboard] = useState<{ nodes: GradeNode[]; finishing: Finishing } | null>(null);
  const [modal, setModal] = useState<ModalId | null>(null);
  const [toasts, setToasts] = useState<{ id: string; msg: string }[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [exportSettings, setExportSettings] = useState<ExportSettings>({ format: 'image/jpeg', quality: 92, scale: 1, suffix: '_graded' });
  const exportRef = useRef(exportSettings);
  exportRef.current = exportSettings;
  const fileInput = useRef<HTMLInputElement>(null);
  const lutInput = useRef<HTMLInputElement>(null);
  const gradeInput = useRef<HTMLInputElement>(null);

  const selectedIndex = Math.max(0, edit.nodes.findIndex((n) => n.id === selectedNodeId));
  const selectedNode = edit.nodes[selectedIndex];
  const selRef = useRef(selectedNode.id);
  selRef.current = selectedNode.id;
  const current = media.find((m) => m.id === currentId) ?? null;

  /* ---------------- basics ---------------- */
  const toast = useCallback((msg: string) => {
    const id = uid();
    setToasts((t) => [...t.slice(-3), { id, msg }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);
  const setView = useCallback((patch: Partial<ViewOptions>) => setViewState((v) => ({ ...v, ...patch })), []);
  const closeModal = useCallback(() => setModal(null), []);

  const editFor = useCallback(
    (id: string): EditState => (id === currentIdRef.current ? history.get().present : histories.current.get(id)?.present ?? defaultEdit()),
    [history],
  );

  /* ---------------- edit helpers ---------------- */
  const updateEdit = useCallback((fn: (e: EditState) => EditState, transient = false) => history.update(fn, transient), [history]);

  const updateGrade = useCallback(
    (fn: (g: Grade) => Grade, transient = false) => {
      history.update((e) => {
        const id = e.nodes.some((n) => n.id === selRef.current) ? selRef.current : e.nodes[0].id;
        return { ...e, nodes: e.nodes.map((n) => (n.id === id ? { ...n, grade: fn(n.grade) } : n)) };
      }, transient);
    },
    [history],
  );

  const setGrade = useCallback(
    <K extends keyof Grade>(key: K, value: Grade[K], transient = false) => updateGrade((g) => ({ ...g, [key]: value }), transient),
    [updateGrade],
  );

  const setFinishing = useCallback(
    <K extends keyof Finishing>(key: K, value: Finishing[K], transient = false) =>
      history.update((e) => ({ ...e, finishing: { ...e.finishing, [key]: value } }), transient),
    [history],
  );

  const setTransform = useCallback(
    (patch: Partial<Transform>, transient = false) => history.update((e) => ({ ...e, transform: { ...e.transform, ...patch } }), transient),
    [history],
  );

  const rotate = useCallback(
    (dir: 1 | -1) => {
      const item = mediaRef.current.find((m) => m.id === currentIdRef.current);
      history.update((e) => {
        const rot90 = (((e.transform.rot90 + dir) % 4) + 4) % 4;
        const [W, H] = item ? orientedSize(item.width, item.height, rot90) : [1, 1];
        return { ...e, transform: { ...e.transform, rot90, crop: cropForAspect(aspectValue(e.transform.aspect, W, H), W, H) } };
      });
    },
    [history],
  );

  /* ---------------- nodes ---------------- */
  const addNode = useCallback(
    (grade?: Partial<Grade>, label?: string) => {
      const e = history.get().present;
      const idx = e.nodes.findIndex((n) => n.id === selRef.current);
      const node = makeNode(label ?? `Node ${e.nodes.length + 1}`, grade);
      history.update((ed) => {
        const nodes = [...ed.nodes];
        nodes.splice(idx < 0 ? nodes.length : idx + 1, 0, node);
        return { ...ed, nodes };
      });
      setSelectedNodeId(node.id);
    },
    [history],
  );

  const deleteNode = useCallback(
    (id?: string) => {
      const target = id ?? selRef.current;
      const e = history.get().present;
      if (e.nodes.length <= 1) {
        toast('A grade needs at least one node');
        return;
      }
      const idx = e.nodes.findIndex((n) => n.id === target);
      if (idx < 0) return;
      history.update((ed) => ({ ...ed, nodes: ed.nodes.filter((n) => n.id !== target) }));
      const next = e.nodes[idx - 1] ?? e.nodes[idx + 1];
      if (next) setSelectedNodeId(next.id);
    },
    [history, toast],
  );

  const toggleNode = useCallback(
    (id?: string) => {
      const target = id ?? selRef.current;
      history.update((e) => ({ ...e, nodes: e.nodes.map((n) => (n.id === target ? { ...n, enabled: !n.enabled } : n)) }));
    },
    [history],
  );

  const resetNode = useCallback(
    (id?: string) => {
      const target = id ?? selRef.current;
      history.update((e) => ({ ...e, nodes: e.nodes.map((n) => (n.id === target ? { ...n, grade: defaultGrade() } : n)) }));
    },
    [history],
  );

  const renameNode = useCallback(
    (id: string, label: string, transient = false) =>
      history.update((e) => ({ ...e, nodes: e.nodes.map((n) => (n.id === id ? { ...n, label } : n)) }), transient),
    [history],
  );

  const resetAll = useCallback(() => {
    const fresh = defaultEdit();
    history.update(() => fresh);
    setSelectedNodeId(fresh.nodes[0].id);
    toast('All grades and sizing reset');
  }, [history, toast]);

  /* ---------------- media ---------------- */
  const selectMedia = useCallback(
    (id: string) => {
      const prev = currentIdRef.current;
      if (prev === id) return;
      if (prev) histories.current.set(prev, history.snapshot());
      const h = histories.current.get(id) ?? { past: [], present: defaultEdit(), future: [] };
      history.reset(h);
      currentIdRef.current = id;
      setCurrentId(id);
      setCurrentImage(images.current.get(id) ?? null);
      setSelectedNodeId(h.present.nodes[0].id);
      setViewState((v) => ({ ...v, cropMode: false }));
    },
    [history],
  );

  const addMedia = useCallback(
    async (entries: NewMedia[]) => {
      const added: MediaItem[] = [];
      for (const e of entries) {
        try {
          const img = await loadImage(e.src);
          const id = uid();
          images.current.set(id, img);
          if (e.objectUrl) objectUrls.current.set(id, e.src);
          added.push({ id, name: e.name, width: img.naturalWidth, height: img.naturalHeight, bytes: e.bytes, thumb: makeThumb(img, 320), sample: e.sample });
        } catch {
          toast(`Could not open ${e.name}`);
          if (e.objectUrl) URL.revokeObjectURL(e.src);
        }
      }
      if (added.length) setMedia((m) => [...m, ...added]);
      return added;
    },
    [toast],
  );

  const loadSamples = useCallback(async () => {
    const existing = new Set(mediaRef.current.filter((m) => m.sample).map((m) => m.name));
    const todo = SAMPLES.filter((s) => !existing.has(s.name));
    if (!todo.length) {
      toast('Sample images are already loaded');
      return;
    }
    const added = await addMedia(todo.map((s) => ({ ...s, sample: true, bytes: dataUrlBytes(s.src) })));
    if (added.length && !currentIdRef.current) selectMedia(added[0].id);
  }, [addMedia, selectMedia, toast]);

  const removeMedia = useCallback(
    (id: string) => {
      const list = mediaRef.current;
      const idx = list.findIndex((m) => m.id === id);
      if (idx < 0) return;
      const next = list.filter((m) => m.id !== id);
      setMedia(next);
      images.current.delete(id);
      histories.current.delete(id);
      const url = objectUrls.current.get(id);
      if (url) {
        URL.revokeObjectURL(url);
        objectUrls.current.delete(id);
      }
      if (currentIdRef.current === id) {
        currentIdRef.current = null;
        const n = next[idx] ?? next[idx - 1];
        if (n) selectMedia(n.id);
        else {
          const fresh = defaultEdit();
          history.reset({ past: [], present: fresh, future: [] });
          setCurrentId(null);
          setCurrentImage(null);
          setSelectedNodeId(fresh.nodes[0].id);
        }
      }
    },
    [history, selectMedia],
  );

  /* ---------------- LUTs & grade files ---------------- */
  const importLuts = useCallback(
    async (files: File[]) => {
      for (const f of files) {
        try {
          const lut = parseCube(await f.text(), f.name.replace(/\.cube$/i, ''));
          setLuts((l) => ({ ...l, [lut.id]: lut }));
          updateGrade((g) => ({ ...g, lutId: lut.id, lutAmount: 100 }));
          toast(`LUT loaded: ${lut.name} (${lut.size}³) → node ${selectedIndex + 1}`);
        } catch (err) {
          toast(`LUT error: ${(err as Error).message}`);
        }
      }
    },
    [toast, updateGrade, selectedIndex],
  );

  const removeLut = useCallback(
    (id: string) => {
      setLuts((l) => {
        const n = { ...l };
        delete n[id];
        return n;
      });
      history.update((e) => ({ ...e, nodes: e.nodes.map((n) => (n.grade.lutId === id ? { ...n, grade: { ...n.grade, lutId: null } } : n)) }));
    },
    [history],
  );

  const loadGradeFile = useCallback(
    async (file: File) => {
      try {
        const data = JSON.parse(await file.text());
        if (!Array.isArray(data?.nodes) || !data.nodes.length) throw new Error('no nodes found');
        const nodes: GradeNode[] = data.nodes.map((n: Partial<GradeNode>, i: number) => ({
          id: uid(),
          label: typeof n.label === 'string' ? n.label : `Node ${i + 1}`,
          enabled: n.enabled !== false,
          grade: normalizeGrade(n.grade ?? {}),
        }));
        const finishing: Finishing = { ...defaultFinishing(), ...(data.finishing ?? {}) };
        history.update((e) => ({ ...e, nodes, finishing }));
        setSelectedNodeId(nodes[0].id);
        toast(`Grade loaded: ${file.name}`);
      } catch (err) {
        toast(`Invalid grade file (${(err as Error).message})`);
      }
    },
    [history, toast],
  );

  const importFiles = useCallback(
    async (list: FileList | File[]) => {
      const files = Array.from(list);
      const imgs = files.filter((f) => f.type.startsWith('image/') || IMAGE_RE.test(f.name));
      const cubes = files.filter((f) => /\.cube$/i.test(f.name));
      const grades = files.filter((f) => /\.json$/i.test(f.name));
      if (!imgs.length && !cubes.length && !grades.length) {
        toast('Unsupported file. Use images, .cube LUTs or .json grades');
        return;
      }
      if (imgs.length) {
        const added = await addMedia(imgs.map((f) => ({ name: f.name || 'pasted-image.png', src: URL.createObjectURL(f), bytes: f.size, objectUrl: true })));
        if (added.length) {
          selectMedia(added[0].id);
          toast(`Imported ${added.length} image${added.length > 1 ? 's' : ''}`);
        }
      }
      if (cubes.length) await importLuts(cubes);
      if (grades.length) await loadGradeFile(grades[0]);
    },
    [addMedia, selectMedia, importLuts, loadGradeFile, toast],
  );

  const saveGrade = useCallback(() => {
    const e = history.get().present;
    const item = mediaRef.current.find((m) => m.id === currentIdRef.current);
    const data = {
      app: 'chroma-studio',
      version: 1,
      nodes: e.nodes.map((n) => ({ label: n.label, enabled: n.enabled, grade: n.grade })),
      finishing: e.finishing,
    };
    downloadText(JSON.stringify(data, null, 2), `${baseName(item?.name)}.grade.json`, 'application/json');
    toast('Grade preset saved (.json)');
  }, [history, toast]);

  const exportLut = useCallback(() => {
    try {
      const e = history.get().present;
      const item = mediaRef.current.find((m) => m.id === currentIdRef.current);
      const base = baseName(item?.name);
      downloadText(generateLutText(e.nodes, lutsRef.current, `${base} grade`, 33), `${base}_grade.cube`);
      toast('LUT exported (33³ .cube)');
    } catch (err) {
      toast(`LUT export failed: ${(err as Error).message}`);
    }
  }, [history, toast]);

  /* ---------------- looks, stills, clipboard ---------------- */
  const applyLook = useCallback(
    (look: Look, asNew = false) => {
      if (asNew) addNode(look.grade, look.name);
      else {
        history.update((e) => ({
          ...e,
          nodes: e.nodes.map((n) => (n.id === selRef.current ? { ...n, label: look.name, grade: normalizeGrade(structuredClone(look.grade)) } : n)),
        }));
      }
      toast(`${look.name} applied${asNew ? ' as a new node' : ''}`);
    },
    [addNode, history, toast],
  );

  const grabStill = useCallback(() => {
    const id = currentIdRef.current;
    const img = id ? images.current.get(id) : undefined;
    if (!id || !img) return;
    const e = history.get().present;
    const thumb = renderGradedThumb(img, id, e, lutsRef.current, 320) ?? '';
    stillCounter.current += 1;
    const n = stillCounter.current;
    setStills((s) => [{ id: uid(), name: `Still ${n}`, thumb, nodes: structuredClone(e.nodes), finishing: { ...e.finishing }, createdAt: Date.now() }, ...s]);
    toast(`Still ${n} grabbed to Gallery`);
  }, [history, toast]);

  const applyStill = useCallback(
    (sid: string) => {
      const st = stills.find((s) => s.id === sid);
      if (!st) return;
      const nodes = cloneNodes(st.nodes);
      history.update((e) => ({ ...e, nodes, finishing: { ...st.finishing } }));
      setSelectedNodeId(nodes[0].id);
      toast(`Applied ${st.name}`);
    },
    [stills, history, toast],
  );

  const deleteStill = useCallback((sid: string) => setStills((s) => s.filter((x) => x.id !== sid)), []);

  const copyGrade = useCallback(() => {
    const e = history.get().present;
    setClipboard({ nodes: structuredClone(e.nodes), finishing: { ...e.finishing } });
    toast(`Grade copied (${e.nodes.length} node${e.nodes.length > 1 ? 's' : ''})`);
  }, [history, toast]);

  const pasteGrade = useCallback(() => {
    if (!clipboard) return;
    const nodes = cloneNodes(clipboard.nodes);
    history.update((e) => ({ ...e, nodes, finishing: { ...clipboard.finishing } }));
    setSelectedNodeId(nodes[0].id);
    toast('Grade pasted');
  }, [clipboard, history, toast]);

  /* ---------------- export ---------------- */
  const exportItems = useCallback(
    async (ids: string[], onProgress?: (done: number, total: number) => void) => {
      const s = exportRef.current;
      const results: { name: string; blob: Blob }[] = [];
      let done = 0;
      for (const id of ids) {
        const item = mediaRef.current.find((m) => m.id === id);
        const img = images.current.get(id);
        if (!item || !img) continue;
        try {
          await new Promise((r) => setTimeout(r, 30));
          const blob = await renderFull(img, editFor(id), lutsRef.current, s);
          results.push({ name: outputName(item.name, s), blob });
        } catch (err) {
          toast(`Export failed for ${item.name}: ${(err as Error).message}`);
        }
        done++;
        onProgress?.(done, ids.length);
      }
      if (results.length === 1) {
        downloadBlob(results[0].blob, results[0].name);
        toast(`Exported ${results[0].name}`);
      } else if (results.length > 1) {
        downloadBlob(await zipFiles(results), `chroma-studio-export-${new Date().toISOString().slice(0, 10)}.zip`);
        toast(`Exported ${results.length} images as ZIP`);
      }
    },
    [editFor, toast],
  );

  /* ---------------- effects ---------------- */
  // boot: load the sample images once
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    (async () => {
      const added = await addMedia(SAMPLES.map((s) => ({ ...s, sample: true, bytes: dataUrlBytes(s.src) })));
      if (added.length && !currentIdRef.current) selectMedia(added[0].id);
    })();
  }, [addMedia, selectMedia]);

  // keep graded thumbnails in the clip strip up to date
  useEffect(() => {
    if (!currentImage || !currentId) return;
    const id = currentId;
    const t = window.setTimeout(() => {
      const url = editHasChanges(edit) ? renderGradedThumb(currentImage, id, edit, luts, 320) ?? undefined : undefined;
      setMedia((m) => m.map((it) => (it.id === id && it.graded !== url ? { ...it, graded: url } : it)));
    }, 450);
    return () => window.clearTimeout(t);
  }, [edit, luts, currentImage, currentId]);

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (modal) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'z') {
        e.preventDefault();
        if (e.shiftKey) history.redo();
        else history.undo();
        return;
      }
      if (mod && k === 'y') {
        e.preventDefault();
        history.redo();
        return;
      }
      if (mod && e.altKey && e.code === 'KeyG') {
        e.preventDefault();
        grabStill();
        return;
      }
      if (e.altKey && !mod && e.code === 'KeyS') {
        e.preventDefault();
        addNode();
        return;
      }
      if (mod && k === 'd') {
        e.preventDefault();
        toggleNode();
        return;
      }
      if (mod && k === 'o') {
        e.preventDefault();
        fileInput.current?.click();
        return;
      }
      if (mod && k === 'e') {
        e.preventDefault();
        if (currentIdRef.current) exportItems([currentIdRef.current]);
        return;
      }
      if (mod && k === 'c') {
        if (window.getSelection()?.toString()) return;
        e.preventDefault();
        copyGrade();
        return;
      }
      if (mod || e.altKey) return;
      if (e.shiftKey && k === 'd') {
        setView({ compare: view.compare === 'bypass' ? 'off' : 'bypass' });
        return;
      }
      switch (k) {
        case 'delete':
        case 'backspace':
          if (page === 'color') {
            e.preventDefault();
            deleteNode();
          }
          break;
        case 'w':
          setView({ compare: view.compare === 'split' ? 'off' : 'split' });
          break;
        case 'h':
          setView({ clipping: !view.clipping });
          break;
        case 'c':
          setView({ cropMode: !view.cropMode });
          if (page !== 'color') setPage('color');
          break;
        case 'r':
          rotate(e.shiftKey ? -1 : 1);
          break;
        case 'f':
          setView({ cinema: !view.cinema });
          break;
        case 'enter':
          if (view.cropMode) {
            history.commit();
            setView({ cropMode: false });
          }
          break;
        case 'escape':
          if (view.cinema || view.cropMode) setView({ cinema: false, cropMode: false });
          break;
        case 'arrowup':
        case 'arrowdown': {
          const list = mediaRef.current;
          const i = list.findIndex((m) => m.id === currentIdRef.current);
          const n = list[i + (k === 'arrowup' ? -1 : 1)];
          if (n) {
            e.preventDefault();
            selectMedia(n.id);
          }
          break;
        }
        case '?':
          setModal('shortcuts');
          break;
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
          setPalette(PALETTE_KEYS[Number(k) - 1]);
          if (page !== 'color') setPage('color');
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // paste images / grades, drag & drop files anywhere
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length) {
        e.preventDefault();
        importFiles(files);
        return;
      }
      pasteGrade();
    };
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) {
        e.preventDefault();
        setDragOver(true);
      }
    };
    const onDragLeave = (e: DragEvent) => {
      if (!e.relatedTarget) setDragOver(false);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer?.files.length) importFiles(e.dataTransfer.files);
    };
    window.addEventListener('paste', onPaste);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [importFiles, pasteGrade]);

  /* ---------------- context ---------------- */
  const editor: Editor = {
    media,
    currentId,
    current,
    currentImage,
    selectMedia,
    removeMedia,
    openImport: () => fileInput.current?.click(),
    openLutImport: () => lutInput.current?.click(),
    openGradeImport: () => gradeInput.current?.click(),
    loadSamples,
    editFor,
    edit,
    canUndo: hs.past.length > 0,
    canRedo: hs.future.length > 0,
    undo: history.undo,
    redo: history.redo,
    commit: history.commit,
    updateEdit,
    selectedNode,
    selectedIndex,
    selectNode: setSelectedNodeId,
    updateGrade,
    setGrade,
    setFinishing,
    setTransform,
    rotate,
    addNode,
    deleteNode,
    toggleNode,
    resetNode,
    renameNode,
    resetAll,
    view,
    setView,
    page,
    setPage,
    palette,
    setPalette,
    scopeType,
    setScopeType,
    luts,
    removeLut,
    applyLook,
    exportLut,
    stills,
    grabStill,
    applyStill,
    deleteStill,
    hasClipboard: !!clipboard,
    copyGrade,
    pasteGrade,
    saveGrade,
    exportSettings,
    setExportSettings,
    exportItems,
    toast,
    openModal: setModal,
  };

  return (
    <EditorContext.Provider value={editor}>
      <div className="flex h-full flex-col overflow-hidden bg-ink-950 text-ink-200">
        <TopBar />
        <main className="relative min-h-0 flex-1">
          {page === 'color' && <ColorPage />}
          {page === 'media' && <MediaPage />}
          {page === 'deliver' && <DeliverPage />}
        </main>
        <PageNav />
      </div>

      <Modals modal={modal} onClose={closeModal} />

      <div className="pointer-events-none fixed bottom-16 right-4 z-[70] flex flex-col items-end gap-2">
        {toasts.map((t) => (
          <div key={t.id} className="toast-in flex max-w-[360px] items-center gap-2 rounded-lg border border-ink-600 bg-ink-800/95 px-3 py-2 text-[12px] text-ink-100 shadow-2xl backdrop-blur">
            <Check size={13} className="shrink-0 text-accent" />
            {t.msg}
          </div>
        ))}
      </div>

      {dragOver && (
        <div className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-accent bg-ink-900/90 px-14 py-10">
            <UploadCloud size={34} className="text-accent" />
            <div className="text-[15px] font-semibold text-ink-100">Drop to import</div>
            <div className="text-[12px] text-ink-400">Images · .cube LUTs · .json grades</div>
          </div>
        </div>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="image/*,.cube,.json"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) importFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={lutInput}
        type="file"
        accept=".cube"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) importLuts(Array.from(e.target.files));
          e.target.value = '';
        }}
      />
      <input
        ref={gradeInput}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) loadGradeFile(f);
          e.target.value = '';
        }}
      />
    </EditorContext.Provider>
  );
}
