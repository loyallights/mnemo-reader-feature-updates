import type { Annotation } from './annotations';
import { matchesPassage } from './annotations';
import { highlightColor } from './highlightColors';
import type { Book, LoadedBook } from './types';

export interface BookSearchResult {
  id: string;
  kind: 'passage' | 'note' | 'general';
  title: string;
  snippet: string;
  sentence?: number;
  noteId?: string;
}
function snippet(text: string, query: string): string {
  const found = text.toLocaleLowerCase().indexOf(query);
  const start = Math.max(0, found - 65);
  return `${start ? '…' : ''}${text.slice(start, start + 240)}${text.length > start + 240 ? '…' : ''}`;
}
export function searchBook(book: Book, loaded: LoadedBook, notes: Annotation[], general: string, labels: Record<string, string>, query: string, scope: 'all' | 'book' | 'notes' = 'all'): BookSearchResult[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [];
  const results: BookSearchResult[] = [];
  const chapter = (sentence: number) => [...book.chapters].reverse().find(c => c.sentenceStart <= sentence)?.title ?? book.title;
  if (scope !== 'book') {
    for (const note of notes) {
      const theme = labels[highlightColor(note.color)] ?? '';
      const text = [note.quote, note.comment, theme].filter(Boolean).join('\n');
      if (text.toLocaleLowerCase().includes(needle)) results.push({ id: `note:${note.id}`, kind: 'note', title: `Note · ${chapter(note.startSentence)}${theme ? ` · ${theme}` : ''}`, snippet: snippet(text, needle), noteId: note.id,
        ...(matchesPassage(loaded, note) ? { sentence: note.startSentence } : {}) });
    }
    if (general.toLocaleLowerCase().includes(needle)) results.push({ id: 'general', kind: 'general', title: 'General notes', snippet: snippet(general, needle) });
  }
  if (scope !== 'notes') {
    // Search the full source rather than individual sentences, so phrases can
    // cross sentence boundaries. Binary search maps hits back to reader positions.
    let from = 0;
    const source = loaded.text.toLocaleLowerCase();
    const seen = new Set<number>();
    while (from < source.length) {
      const hit = source.indexOf(needle, from);
      if (hit < 0) break;
      let low = 0; let high = loaded.sentenceOffsets.length - 1;
      while (low < high) { const mid = Math.ceil((low + high) / 2); if (loaded.sentenceOffsets[mid] <= hit) low = mid; else high = mid - 1; }
      if (loaded.sentences.length && !seen.has(low)) {
        seen.add(low);
        results.push({ id: `passage:${low}`, kind: 'passage', title: `Passage · ${chapter(low)}`, sentence: low, snippet: snippet(loaded.text.slice(Math.max(0, hit - 65), hit + needle.length + 175), needle) });
      }
      from = hit + Math.max(1, needle.length);
    }
  }
  return results;
}
