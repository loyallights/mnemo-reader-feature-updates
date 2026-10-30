import { bridge } from './bridge';
import { NOTES_CHANGED, notesKey, readBookNotes } from './annotations';
import { highlightColor } from './highlightColors';
import type { Book } from './types';

export type VaultNoteState = { phase: 'pending' | 'syncing' | 'synced' | 'error'; message: string };
type Journal = Record<string, { ids: number[]; digest: string }>;
export type NoteTransport = Pick<typeof bridge, 'notesQuery' | 'notesIngest' | 'forgetNotes'>;
export const VAULT_NOTES_STATUS = 'mnemoreader:vault-notes-status';
export const VAULT_NOTES_RETRY = 'mnemoreader:vault-notes-retry';
const states = new Map<string, VaultNoteState>();
export const noteVaultState = (id: string) => states.get(id);
export const vaultNoteFailures = () => [...states.entries()].filter(([, s]) => s.phase === 'error');
const deletionKey = 'mnemoreader.notes-vault-deletions-v1';
function deletions(): string[] {
  const value: unknown = JSON.parse(localStorage.getItem(deletionKey) ?? '[]');
  if (!Array.isArray(value) || !value.every((id) => typeof id === 'string'))
    throw new Error('Pending vault deletions could not be read.');
  return value;
}
export function removeBookNotes(bookId: string): void {
  const before = deletions();
  localStorage.setItem(deletionKey, JSON.stringify([...new Set([...before, bookId])]));
  try {
    localStorage.removeItem(notesKey(bookId));
  } catch (error) {
    localStorage.setItem(deletionKey, JSON.stringify(before));
    throw error;
  }
  window.dispatchEvent(new Event(NOTES_CHANGED));
}
const marker = (id: string) => `[MNEMOREADER-NOTES:v1:${encodeURIComponent(id)}]\n`;
const journalKey = (vault: string) => `mnemoreader.notes-vault-v1:${vault}`;
function status(id: string, phase: VaultNoteState['phase'], message: string): void {
  states.set(id, { phase, message });
  window.dispatchEvent(new Event(VAULT_NOTES_STATUS));
}
export function markVaultSyncPending(id: string): void {
  if (!id.startsWith('sample_'))
    status(id, 'pending', 'Notes saved locally; vault sync is pending.');
}
function numericId(value: unknown): number {
  const id =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^\d+$/.test(value)
        ? Number(value)
        : NaN;
  if (!Number.isSafeInteger(id) || id <= 0)
    throw new Error('The vault returned an invalid entry ID.');
  return id;
}
function readJournal(vault: string): Journal {
  const raw = localStorage.getItem(journalKey(vault));
  if (!raw) return {};
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Vault sync history could not be read.');
  for (const entry of Object.values(value)) {
    const e = entry as { ids?: unknown; digest?: unknown };
    if (
      !e ||
      !Array.isArray(e.ids) ||
      !e.ids.every((id) => typeof id === 'number' && Number.isSafeInteger(id) && id > 0) ||
      typeof e.digest !== 'string'
    )
      throw new Error('Vault sync history is invalid.');
  }
  return value as Journal;
}

/** Plain text for retrieval, with an exact app-owned marker for reconciliation. */
export function bookNoteChunks(book: Book): string[] {
  const data = readBookNotes(book.id);
  const labels = Object.entries(data.colorLabels).filter(([, label]) => label.trim());
  if (!data.general.trim() && !data.notes.length && !labels.length) return [];
  const lines = [
    'Color key (reader-defined labels, not inferred themes):',
    ...labels.map(
      ([hex, label]) =>
        `${hex}: ${label}${data.hiddenColors.includes(hex) ? ' (hidden from color key)' : ''}`
    ),
    '',
    'Highlights and comments:',
  ];
  for (const a of [...data.notes].sort(
    (x, y) => x.startSentence - y.startSentence || x.startOffset - y.startOffset
  )) {
    const chapter = [...book.chapters].reverse().find((c) => c.sentenceStart <= a.startSentence);
    const color = highlightColor(a.color);
    lines.push(
      `Chapter: ${chapter?.title ?? 'Unknown chapter'}; sentence ${a.startSentence + 1}.`,
      `Highlight color: ${color}${data.colorLabels[color] ? ` — ${data.colorLabels[color]}` : ''}`,
      `Quoted passage: ${a.quote}`,
      `Reader comment: ${a.comment || '(none)'}`,
      ''
    );
  }
  lines.push('General notes:', data.general);
  const text = lines.join('\n');
  const parts: string[] = [];
  // Small enough for host ingest limits; every chunk carries book provenance.
  for (let start = 0; start < text.length; start += 12000)
    parts.push(text.slice(start, start + 12000));
  return parts.map(
    (part, i) =>
      `${marker(book.id)}Book: ${book.title}\nAuthor: ${book.author ?? 'Unknown'}\nPart ${i + 1}/${parts.length}\nSource: MnemoReader book annotations.\nQuoted passages are excerpts from the book; reader comments and general notes are the reader's words. Highlighting a passage does not establish agreement, belief, or personal experience. Color meanings are labels chosen by the reader. A part may continue text from the previous part; consult adjacent parts before attributing an incomplete excerpt.\n${part}`
  );
}

/** One serialized reconciliation pass. Never deletes catalogue/book-text records. */
export async function syncBookNotes(
  vault: string,
  books: Book[],
  api: NoteTransport = bridge
): Promise<void> {
  if (!vault.startsWith('APP-')) throw new Error('Notes may only sync to the app sandbox.');
  const journal = readJournal(vault);
  const rows = (await api.notesQuery(vault)).chronicles;
  if (!Array.isArray(rows)) throw new Error('The vault returned an unreadable note list.');
  // Recover a write that succeeded remotely just before a reload/local-save failure.
  for (const row of rows) {
    if (typeof row.content !== 'string') throw new Error('The vault returned unreadable content.');
  }
  const current = new Map(books.filter((b) => !b.id.startsWith('sample_')).map((b) => [b.id, b]));
  const pendingDeletes = deletions();
  // Missing local state alone is NOT consent to purge remote notes (e.g. a new device).
  const ids = new Set([...current.keys(), ...pendingDeletes]);
  const persist = () => localStorage.setItem(journalKey(vault), JSON.stringify(journal));
  for (const bookId of ids) {
    try {
      const book = pendingDeletes.includes(bookId) ? undefined : current.get(bookId);
      const chunks = book ? bookNoteChunks(book) : [];
      const digestBytes = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(JSON.stringify(chunks))
      );
      const digest = [...new Uint8Array(digestBytes)]
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      const owned = rows.filter((row) => row.content.startsWith(marker(bookId)));
      const prior = journal[bookId];
      const previous = [
        ...new Set([...(prior?.ids ?? []), ...owned.map((row) => numericId(row.id))]),
      ];
      // A complete listing detects a sandbox purge and lets us rebuild it.
      const stillPresent =
        rows.length >= 200 ||
        (prior?.ids.every((id) => owned.some((row) => numericId(row.id) === id)) ?? false);
      if (prior?.digest === digest && stillPresent && previous.length === prior.ids.length) {
        if (book)
          status(
            bookId,
            'synced',
            'Notes saved in the MnemoReader vault. AI recall follows your vault permissions.'
          );
        continue;
      }
      status(bookId, 'syncing', 'Syncing notes to the MnemoReader vault…');
      const nextIds: number[] = [];
      // Keep old records until all replacement parts are saved and journalled.
      for (const content of chunks) {
        const existing = owned.find((row) => row.content === content);
        const id = existing
          ? numericId(existing.id)
          : numericId(
              (await api.notesIngest(vault, content, `mnemoreader-notes:${bookId}`)).chronicleId
            );
        nextIds.push(id);
        journal[bookId] = { ids: [...new Set([...previous, ...nextIds])], digest: '' };
        persist();
      }
      const stale = previous.filter((id) => !nextIds.includes(id));
      for (let i = 0; i < stale.length; i += 500) {
        const batch = stale.slice(i, i + 500);
        const result = await api.forgetNotes(batch);
        if (!result.success)
          throw new Error(result.error ?? 'Old vault notes could not be removed.');
        if (result.forgotten !== batch.length) {
          const check = (await api.notesQuery(vault)).chronicles;
          if (check.length >= 200 || check.some((row) => batch.includes(numericId(row.id))))
            throw new Error('Removal of outdated notes could not be confirmed.');
        }
      }
      if (book && chunks.length) journal[bookId] = { ids: nextIds, digest };
      else delete journal[bookId];
      persist();
      if (!book) {
        localStorage.setItem(
          deletionKey,
          JSON.stringify(deletions().filter((id) => id !== bookId))
        );
        states.delete(bookId);
        window.dispatchEvent(new Event(VAULT_NOTES_STATUS));
      }
      if (book)
        status(
          bookId,
          'synced',
          chunks.length
            ? 'Notes saved in the MnemoReader vault. AI recall follows your vault permissions.'
            : 'No notes to sync. Previous note copies have been removed from the vault.'
        );
    } catch (error) {
      status(
        bookId,
        'error',
        `Vault sync needs attention: ${error instanceof Error ? error.message : String(error)} Your local notes are kept.`
      );
    }
  }
}

export function markVaultSyncError(books: Book[], error: unknown): void {
  const ids = new Set(books.map((book) => book.id));
  try {
    for (const id of deletions()) ids.add(id);
  } catch {
    ids.add('__notes_sync__');
  }
  for (const id of ids)
    if (!id.startsWith('sample_'))
      status(
        id,
        'error',
        `Notes or note deletions are pending; vault sync failed: ${error instanceof Error ? error.message : String(error)}`
      );
}
