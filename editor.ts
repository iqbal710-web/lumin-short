import { createContext, useContext } from 'react';
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
} from '../types';
import type { Look } from '../lib/looks';

export interface Editor {
  // media
  media: MediaItem[];
  currentId: string | null;
  current: MediaItem | null;
  currentImage: HTMLImageElement | null;
  selectMedia: (id: string) => void;
  removeMedia: (id: string) => void;
  openImport: () => void;
  openLutImport: () => void;
  openGradeImport: () => void;
  loadSamples: () => void;
  editFor: (id: string) => EditState;

  // edit + history
  edit: EditState;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  commit: () => void;
  updateEdit: (fn: (e: EditState) => EditState, transient?: boolean) => void;
  selectedNode: GradeNode;
  selectedIndex: number;
  selectNode: (id: string) => void;
  updateGrade: (fn: (g: Grade) => Grade, transient?: boolean) => void;
  setGrade: <K extends keyof Grade>(key: K, value: Grade[K], transient?: boolean) => void;
  setFinishing: <K extends keyof Finishing>(key: K, value: Finishing[K], transient?: boolean) => void;
  setTransform: (patch: Partial<Transform>, transient?: boolean) => void;
  rotate: (dir: 1 | -1) => void;
  addNode: (grade?: Partial<Grade>, label?: string) => void;
  deleteNode: (id?: string) => void;
  toggleNode: (id?: string) => void;
  resetNode: (id?: string) => void;
  renameNode: (id: string, label: string, transient?: boolean) => void;
  resetAll: () => void;

  // view
  view: ViewOptions;
  setView: (patch: Partial<ViewOptions>) => void;
  page: Page;
  setPage: (p: Page) => void;
  palette: PaletteTab;
  setPalette: (p: PaletteTab) => void;
  scopeType: ScopeType;
  setScopeType: (s: ScopeType) => void;

  // luts / looks / stills
  luts: Record<string, LutData>;
  removeLut: (id: string) => void;
  applyLook: (look: Look, asNewNode?: boolean) => void;
  exportLut: () => void;
  stills: Still[];
  grabStill: () => void;
  applyStill: (id: string) => void;
  deleteStill: (id: string) => void;

  // clipboard + files
  hasClipboard: boolean;
  copyGrade: () => void;
  pasteGrade: () => void;
  saveGrade: () => void;

  // export
  exportSettings: ExportSettings;
  setExportSettings: (s: ExportSettings) => void;
  exportItems: (ids: string[], onProgress?: (done: number, total: number) => void) => Promise<void>;

  // misc
  toast: (msg: string) => void;
  openModal: (m: ModalId) => void;
}

export const EditorContext = createContext<Editor | null>(null);

export function useEditor(): Editor {
  const e = useContext(EditorContext);
  if (!e) throw new Error('useEditor must be used inside <EditorContext.Provider>');
  return e;
}
