// @vitest-environment jsdom
import { webcrypto } from 'node:crypto';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { notesKey, writeAnnotations, writeGeneralNote, writeColorLabels } from './annotations';
import {
  bookNoteChunks,
  noteVaultState,
  removeBookNotes,
  syncBookNotes,
  type NoteTransport,
} from './notesVaultSync';
import type { Book } from './types';

const book: Book = {
  id: 'book-one',
  title: 'My book',
  author: 'An author',
  filePath: '',
  ext: 'txt',
  hue: 0,
  addedAt: 0,
  sentenceCount: 2,
  chapters: [{ id: 'chapter', title: 'Chapter One', start: 0, end: 100, sentenceStart: 0 }],
  progressSentence: 0,
  ingest: 'idle',
  archived: true,
};
const vault = 'APP-MNEMO-READER';
let rows: { id: number; content: string }[];
let nextId: number;
let api: NoteTransport;
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('crypto', webcrypto);
  rows = [{ id: 1, content: 'Book catalogue entry — must stay' }];
  nextId = 2;
  api = {
    notesQuery: vi.fn(() => Promise.resolve({ chronicles: rows.map((r) => ({ ...r })) })),
    notesIngest: vi.fn((_vault, content) => {
      const id = nextId++;
      rows.push({ id, content });
      return Promise.resolve({ chronicleId: id });
    }),
    forgetNotes: vi.fn((ids) => {
      const before = rows.length;
      rows = rows.filter((r) => !ids.includes(r.id));
      return Promise.resolve({ success: true, forgotten: before - rows.length });
    }),
  };
});
afterEach(() => vi.unstubAllGlobals());

it('exports book/chapter provenance, quotes, comments, general notes, and color meanings', async () => {
  writeAnnotations(book.id, [
    {
      id: 'a',
      startSentence: 0,
      startOffset: 0,
      endSentence: 0,
      endOffset: 5,
      quote: 'Quote',
      comment: 'My response',
      color: '#123456',
      createdAt: 1,
    },
  ]);
  writeGeneralNote(book.id, 'My independent note');
  writeColorLabels(book.id, { '#123456': 'Questions' });
  await syncBookNotes(vault, [book], api);
  const text = rows[1].content;
  for (const value of [
    'My book',
    'An author',
    'Chapter One',
    'Quote',
    'My response',
    'My independent note',
    'Questions',
  ])
    expect(text).toContain(value);
  expect(text).toContain('Quoted passages are excerpts from the book');
  expect(text).toContain('does not establish agreement, belief, or personal experience');
  expect(text).toContain('reader-defined labels, not inferred themes');
  expect(noteVaultState(book.id)?.phase).toBe('synced');
  await syncBookNotes(vault, [book], api);
  expect(api.notesIngest).toHaveBeenCalledTimes(1);
});

it('replaces edits, removes cleared notes, and keeps unrelated catalogue records', async () => {
  writeGeneralNote(book.id, 'Old thoughts');
  await syncBookNotes(vault, [book], api);
  writeGeneralNote(book.id, 'New thoughts');
  await syncBookNotes(vault, [book], api);
  expect(rows).toHaveLength(2);
  expect(rows[1].content).toContain('New thoughts');
  expect(rows[1].content).not.toContain('Old thoughts');
  writeGeneralNote(book.id, '');
  await syncBookNotes(vault, [book], api);
  expect(rows).toEqual([{ id: 1, content: 'Book catalogue entry — must stay' }]);
});

it('retains the old remote version and local notes when a replacement fails, then retries', async () => {
  writeGeneralNote(book.id, 'Original');
  await syncBookNotes(vault, [book], api);
  writeGeneralNote(book.id, 'Edited');
  vi.mocked(api.notesIngest).mockRejectedValueOnce(new Error('Permission denied'));
  await syncBookNotes(vault, [book], api);
  expect(rows[1].content).toContain('Original');
  expect(localStorage.getItem(notesKey(book.id))).toContain('Edited');
  expect(noteVaultState(book.id)?.phase).toBe('error');
  await syncBookNotes(vault, [book], api);
  expect(rows).toHaveLength(2);
  expect(rows[1].content).toContain('Edited');
});

it('queues confirmed book deletion and does not treat missing local books as consent to purge', async () => {
  writeGeneralNote(book.id, 'Keep until removed');
  await syncBookNotes(vault, [book], api);
  await syncBookNotes(vault, [], api);
  expect(rows).toHaveLength(2);
  removeBookNotes(book.id);
  vi.mocked(api.forgetNotes).mockResolvedValueOnce({ success: false, error: 'Host unavailable' });
  await syncBookNotes(vault, [], api);
  expect(rows).toHaveLength(2);
  expect(noteVaultState(book.id)?.phase).toBe('error');
  await syncBookNotes(vault, [], api);
  expect(rows).toHaveLength(1);
  expect(localStorage.getItem(notesKey(book.id))).toBeNull();
});

it('recovers a remote write after losing sync history without duplicating it', async () => {
  writeGeneralNote(book.id, 'Recover this');
  await syncBookNotes(vault, [book], api);
  localStorage.removeItem(`mnemoreader.notes-vault-v1:${vault}`);
  await syncBookNotes(vault, [book], api);
  expect(api.notesIngest).toHaveBeenCalledTimes(1);
  expect(rows).toHaveLength(2);
});

it('chunks long notes and retains all replacements while a stale-copy removal fails', async () => {
  writeGeneralNote(book.id, 'A'.repeat(26000));
  expect(bookNoteChunks(book)).toHaveLength(3);
  for (const chunk of bookNoteChunks(book)) {
    expect(chunk).toContain('Source: MnemoReader book annotations.');
    expect(chunk).toContain('consult adjacent parts');
  }
  await syncBookNotes(vault, [book], api);
  writeGeneralNote(book.id, 'Short replacement');
  vi.mocked(api.forgetNotes).mockResolvedValueOnce({ success: false, error: 'Unavailable' });
  await syncBookNotes(vault, [book], api);
  expect(rows).toHaveLength(5);
  expect(noteVaultState(book.id)?.phase).toBe('error');
  await syncBookNotes(vault, [book], api);
  expect(rows).toHaveLength(2);
  expect(rows[1].content).toContain('Short replacement');
});

it('rebuilds purged vault entries, excludes demo books, and refuses other vaults', async () => {
  writeGeneralNote(book.id, 'Restore');
  await syncBookNotes(vault, [book], api);
  rows = [rows[0]];
  await syncBookNotes(vault, [book, { ...book, id: 'sample_demo' }], api);
  expect(rows).toHaveLength(2);
  expect(api.notesIngest).toHaveBeenCalledTimes(2);
  await expect(syncBookNotes('LIBRARY', [book], api)).rejects.toThrow('sandbox');
});
