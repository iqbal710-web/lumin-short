import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Download, Images, Palette, Redo2, Rocket, Undo2 } from 'lucide-react';
import type { Page } from '../types';
import { useEditor } from '../state/editor';
import { GithubMark, IconBtn, Logo } from './ui';
import { cn } from '../utils/cn';

interface MenuItem {
  label?: string;
  shortcut?: string;
  onClick?: () => void;
  disabled?: boolean;
  divider?: boolean;
  checked?: boolean;
}

function Menu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn('rounded px-2 py-1 text-[12px] transition', open ? 'bg-ink-650 text-ink-100' : 'text-ink-300 hover:bg-ink-700 hover:text-ink-100')}
      >
        {label}
      </button>
      {open && (
        <div className="animate-in absolute left-0 top-full z-50 mt-1 min-w-[250px] rounded-lg border border-ink-600 bg-ink-800/95 py-1 shadow-2xl backdrop-blur">
          {items.map((it, i) =>
            it.divider ? (
              <div key={i} className="my-1 h-px bg-ink-650" />
            ) : (
              <button
                key={i}
                type="button"
                disabled={it.disabled}
                onClick={() => {
                  setOpen(false);
                  it.onClick?.();
                }}
                className="flex w-full items-center justify-between gap-6 px-3 py-1.5 text-left text-[12px] text-ink-200 hover:bg-accent hover:text-white disabled:pointer-events-none disabled:opacity-35"
              >
                <span className="flex items-center gap-2">
                  {it.checked !== undefined && <Check size={12} className={it.checked ? '' : 'invisible'} />}
                  {it.label}
                </span>
                {it.shortcut && <span className="font-mono text-[10px] opacity-60">{it.shortcut}</span>}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

export function TopBar() {
  const ed = useEditor();
  const { view, setView } = ed;
  const menus: { label: string; items: MenuItem[] }[] = [
    {
      label: 'File',
      items: [
        { label: 'Import Images…', shortcut: 'Ctrl+O', onClick: ed.openImport },
        { label: 'Import LUT (.cube)…', onClick: ed.openLutImport },
        { label: 'Load Grade (.json)…', onClick: ed.openGradeImport },
        { divider: true },
        { label: 'Quick Export Image', shortcut: 'Ctrl+E', onClick: () => ed.currentId && ed.exportItems([ed.currentId]), disabled: !ed.currentId },
        { label: 'Deliver Page…', onClick: () => ed.setPage('deliver') },
        { label: 'Save Grade (.json)', onClick: ed.saveGrade, disabled: !ed.currentId },
        { label: 'Export LUT (.cube)', onClick: ed.exportLut, disabled: !ed.currentId },
        { divider: true },
        { label: 'Load Sample Images', onClick: ed.loadSamples },
      ],
    },
    {
      label: 'Edit',
      items: [
        { label: 'Undo', shortcut: 'Ctrl+Z', onClick: ed.undo, disabled: !ed.canUndo },
        { label: 'Redo', shortcut: 'Ctrl+Shift+Z', onClick: ed.redo, disabled: !ed.canRedo },
        { divider: true },
        { label: 'Copy Grade', shortcut: 'Ctrl+C', onClick: ed.copyGrade },
        { label: 'Paste Grade', shortcut: 'Ctrl+V', onClick: ed.pasteGrade, disabled: !ed.hasClipboard },
        { label: 'Grab Still', shortcut: 'Ctrl+Alt+G', onClick: ed.grabStill, disabled: !ed.currentId },
        { divider: true },
        { label: 'Reset All Grades & Sizing', onClick: ed.resetAll },
      ],
    },
    {
      label: 'View',
      items: [
        { label: 'Bypass Grade', shortcut: 'Shift+D', checked: view.compare === 'bypass', onClick: () => setView({ compare: view.compare === 'bypass' ? 'off' : 'bypass' }) },
        { label: 'Split Wipe', shortcut: 'W', checked: view.compare === 'split', onClick: () => setView({ compare: view.compare === 'split' ? 'off' : 'split' }) },
        { label: 'Show Clipping', shortcut: 'H', checked: view.clipping, onClick: () => setView({ clipping: !view.clipping }) },
        { label: 'Crop Tool', shortcut: 'C', checked: view.cropMode, onClick: () => setView({ cropMode: !view.cropMode }) },
        { label: 'Cinema Viewer', shortcut: 'F', checked: view.cinema, onClick: () => setView({ cinema: !view.cinema }) },
        { divider: true },
        { label: 'Waveform', onClick: () => ed.setScopeType('waveform'), checked: ed.scopeType === 'waveform' },
        { label: 'RGB Parade', onClick: () => ed.setScopeType('parade'), checked: ed.scopeType === 'parade' },
        { label: 'Vectorscope', onClick: () => ed.setScopeType('vectorscope'), checked: ed.scopeType === 'vectorscope' },
        { label: 'Histogram', onClick: () => ed.setScopeType('histogram'), checked: ed.scopeType === 'histogram' },
      ],
    },
    {
      label: 'Nodes',
      items: [
        { label: 'Add Serial Node', shortcut: 'Alt+S', onClick: () => ed.addNode() },
        { label: 'Enable / Disable Node', shortcut: 'Ctrl+D', onClick: () => ed.toggleNode() },
        { label: 'Reset Node Grade', onClick: () => ed.resetNode() },
        { label: 'Delete Node', shortcut: 'Del', onClick: () => ed.deleteNode(), disabled: ed.edit.nodes.length <= 1 },
      ],
    },
    {
      label: 'Help',
      items: [
        { label: 'Keyboard Shortcuts', shortcut: '?', onClick: () => ed.openModal('shortcuts') },
        { label: 'Deploy to GitHub — Step by Step', onClick: () => ed.openModal('github') },
        { label: 'About Chroma Studio', onClick: () => ed.openModal('about') },
      ],
    },
  ];

  return (
    <header className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-ink-700 bg-ink-850 px-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex shrink-0 items-center gap-2">
          <Logo size={22} />
          <span className="text-[13px] font-semibold tracking-tight text-ink-100">
            Chroma<span className="text-accent">Studio</span>
          </span>
        </div>
        <nav className="hidden items-center md:flex">
          {menus.map((m) => (
            <Menu key={m.label} label={m.label} items={m.items} />
          ))}
        </nav>
      </div>
      <div className="hidden min-w-0 truncate text-[11px] text-ink-400 lg:block">
        Project <span className="text-ink-200">Untitled Grade</span>
        {ed.current && (
          <>
            <span className="mx-1.5 text-ink-600">/</span>
            <span className="text-ink-200">{ed.current.name}</span>
          </>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <IconBtn title="Undo (Ctrl+Z)" onClick={ed.undo} disabled={!ed.canUndo}>
          <Undo2 size={15} />
        </IconBtn>
        <IconBtn title="Redo (Ctrl+Shift+Z)" onClick={ed.redo} disabled={!ed.canRedo}>
          <Redo2 size={15} />
        </IconBtn>
        <div className="mx-1 h-5 w-px bg-ink-650" />
        <button
          type="button"
          onClick={() => ed.openModal('github')}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11.5px] text-ink-300 ring-1 ring-ink-650 transition hover:bg-ink-700 hover:text-white sm:px-2.5"
          title="How to publish this site on GitHub Pages"
        >
          <GithubMark size={14} /> <span className="hidden sm:inline">Deploy guide</span>
        </button>
        <button
          type="button"
          onClick={() => ed.setPage('deliver')}
          className="flex items-center gap-1.5 rounded-md bg-gradient-to-b from-accent-2 to-accent px-3 py-1.5 text-[11.5px] font-semibold text-white shadow-[0_4px_14px_-4px_rgba(255,107,61,0.7)] transition hover:brightness-110"
        >
          <Download size={13} /> Export
        </button>
      </div>
    </header>
  );
}

const PAGES: { id: Page; label: string; icon: ReactNode }[] = [
  { id: 'media', label: 'Media', icon: <Images size={17} /> },
  { id: 'color', label: 'Color', icon: <Palette size={17} /> },
  { id: 'deliver', label: 'Deliver', icon: <Rocket size={17} /> },
];

export function PageNav() {
  const { page, setPage, media } = useEditor();
  return (
    <footer className="flex h-12 shrink-0 items-center justify-between border-t border-ink-700 bg-ink-850 px-3">
      <div className="hidden w-48 items-center gap-2 text-[11px] text-ink-500 sm:flex">
        <Logo size={14} /> Chroma Studio <span className="text-ink-600">v1.0</span>
      </div>
      <nav className="flex flex-1 items-center justify-center gap-1 sm:flex-none">
        {PAGES.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPage(p.id)}
            className={cn(
              'relative flex flex-col items-center gap-0.5 rounded-md px-6 py-1 text-[10px] font-medium transition',
              page === p.id ? 'text-accent' : 'text-ink-400 hover:text-ink-200',
            )}
          >
            {p.icon}
            {p.label}
            {page === p.id && <span className="absolute -top-[7px] left-1/2 h-[2px] w-8 -translate-x-1/2 rounded bg-accent" />}
          </button>
        ))}
      </nav>
      <div className="hidden w-48 justify-end text-[10.5px] text-ink-500 sm:flex">
        {media.length} clip{media.length === 1 ? '' : 's'} · 100% local processing
      </div>
    </footer>
  );
}
