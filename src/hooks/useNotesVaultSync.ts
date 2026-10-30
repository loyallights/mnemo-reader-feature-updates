import { useEffect, useRef, useState } from 'react';
import { NOTES_CHANGED } from '../lib/annotations';
import { bridge, isFramed } from '../lib/bridge';
import { markVaultSyncError, markVaultSyncPending, noteVaultState, syncBookNotes, VAULT_NOTES_RETRY, VAULT_NOTES_STATUS } from '../lib/notesVaultSync';
import type { Book } from '../lib/types';

export function useNotesVaultSync(books: Book[], vault: string | null): void {
  const latest = useRef(books);
  latest.current = books;
  const running = useRef(false);
  const dirty = useRef(false);
  const bookMetadata = JSON.stringify(books.map(({ id, title, author, chapters }) => ({ id, title, author, chapters })));
  useEffect(() => {
    if (!isFramed()) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = async () => {
      dirty.current = true;
      if (running.current) return;
      running.current = true;
      try {
        while (dirty.current && !stopped) {
          dirty.current = false;
          try { const targetVault = vault ?? (await bridge.ensureSandbox()).vault; await syncBookNotes(targetVault, latest.current); }
          catch (error) { markVaultSyncError(latest.current, error); }
        }
      } finally { running.current = false; }
    };
    const schedule = (event?: Event) => {
      if (event instanceof CustomEvent && typeof event.detail?.bookId === 'string') markVaultSyncPending(event.detail.bookId);
      clearTimeout(timer); timer = setTimeout(() => { void run(); }, 1200);
    };
    schedule();
    window.addEventListener(NOTES_CHANGED, schedule);
    window.addEventListener(VAULT_NOTES_RETRY, schedule);
    window.addEventListener('online', schedule);
    const retry = setInterval(schedule, 60000);
    return () => { stopped = true; clearTimeout(timer); clearInterval(retry); window.removeEventListener(NOTES_CHANGED, schedule); window.removeEventListener(VAULT_NOTES_RETRY, schedule); window.removeEventListener('online', schedule); };
  }, [vault]);
  useEffect(() => { window.dispatchEvent(new Event(NOTES_CHANGED)); }, [bookMetadata]);
}

export function useBookVaultStatus(bookId: string) {
  const [state, setState] = useState(() => noteVaultState(bookId));
  useEffect(() => {
    const refresh = () => setState(noteVaultState(bookId));
    refresh(); window.addEventListener(VAULT_NOTES_STATUS, refresh);
    return () => window.removeEventListener(VAULT_NOTES_STATUS, refresh);
  }, [bookId]);
  return state;
}
