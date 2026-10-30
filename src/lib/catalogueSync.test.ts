// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { catalogueContent, syncCatalogue } from './catalogueSync';
import type { Book } from './types';

const book = { id: 'eden', title: 'East of Eden', author: 'John Steinbeck', ext: 'epub', chapters: [{ id: 'c' }], sentenceCount: 7589 } as Book;
let rows: { id: number; content: string }[];
let next: number;
const api = {
  notesQuery: vi.fn(() => Promise.resolve({ chronicles: [...rows] })),
  catalogueIngest: vi.fn((_vault: string, content: string) => { const id = next++; rows.push({ id, content }); return Promise.resolve({ chronicleId: id }); }),
  forgetNotes: vi.fn((ids: number[]) => { rows = rows.filter(row => !ids.includes(row.id)); return Promise.resolve({ success: true, forgotten: ids.length }); }),
};
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); next = 10; rows = [
  { id: 1, content: 'Book: John Steinbeck. Author: East of Eden. Format: EPUB, 0 chapters, 0 sentences.' },
  { id: 2, content: 'Book: John Steinbeck. Author: East of Eden. Format: EPUB, 61 chapters, 7589 sentences.' },
  { id: 3, content: 'Book: East of Eden. Author: John Steinbeck. Format: EPUB, 61 chapters, 7589 sentences.' },
  { id: 4, content: '[MNEMOREADER-NOTES:v1:eden]\nMy highlight and comment' },
  { id: 5, content: 'Unrelated memory' },
]; });

it('replaces the three catalogue snapshots with one and preserves notes and unrelated entries', async () => {
  await syncCatalogue('APP-READER', [book], api);
  expect(rows.map(row => row.id)).toEqual([4, 5, 10]);
  expect(rows[2].content).toBe(catalogueContent(book));
  await syncCatalogue('APP-READER', [book], api);
  expect(api.catalogueIngest).toHaveBeenCalledTimes(1);
  await syncCatalogue('APP-READER', [{ ...book, sentenceCount: 8000 }], api);
  expect(rows.map(row => row.id)).toEqual([4, 5, 11]);
});

it('keeps previous records when the replacement cannot be saved', async () => {
  api.catalogueIngest.mockRejectedValueOnce(new Error('offline'));
  await expect(syncCatalogue('APP-READER', [book], api)).rejects.toThrow('offline');
  expect(rows).toHaveLength(5);
  expect(api.forgetNotes).not.toHaveBeenCalled();
});

it('recovers after losing local history and retries a failed cleanup without another write', async () => {
  api.forgetNotes.mockImplementationOnce(() => Promise.resolve({ success: false, forgotten: 0 }));
  await expect(syncCatalogue('APP-READER', [book], api)).rejects.toThrow('cleanup');
  localStorage.clear();
  await syncCatalogue('APP-READER', [book], api);
  expect(api.catalogueIngest).toHaveBeenCalledTimes(1);
  expect(rows.map(row => row.id)).toEqual([4, 5, 10]);
});
