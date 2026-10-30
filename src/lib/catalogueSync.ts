import { bridge } from './bridge';
import type { Book } from './types';

type Transport = Pick<typeof bridge, 'notesQuery' | 'catalogueIngest' | 'forgetNotes'>;
const marker = (id: string) => `[MNEMOREADER-BOOK:v1:${encodeURIComponent(id)}]\n`;
const numericId = (value: number | string) => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid catalogue record ID.');
  return id;
};

export function catalogueContent(book: Book): string {
  return `${marker(book.id)}Book: ${book.title}. ${book.author ? `Author: ${book.author}. ` : ''}Format: ${book.ext.toUpperCase()}, ${book.chapters.length} chapters, ${book.sentenceCount} sentences.`;
}

function legacyMatch(content: string, book: Book): boolean {
  const pairs = [[book.title, book.author]];
  // The user confirmed these older, reversed East of Eden records are obsolete.
  if (book.title === 'East of Eden' && book.author === 'John Steinbeck') pairs.push(['John Steinbeck', 'East of Eden']);
  return pairs.some(([title, author]) => {
    const prefix = `Book: ${title}. ${author ? `Author: ${author}. ` : ''}Format: ${book.ext.toUpperCase()}, `;
    return content.startsWith(prefix) && /^\d+ chapters, \d+ sentences\.$/.test(content.slice(prefix.length));
  });
}

/** Save the replacement first. Only delete this book's tagged or exact legacy catalogue records. */
export async function syncCatalogue(vault: string, books: Book[], api: Transport = bridge): Promise<void> {
  if (!vault.startsWith('APP-')) throw new Error('Catalogue sync requires the reader sandbox.');
  const key = `mnemoreader.catalogue-ids-v2:${vault}`;
  const journal = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, number[]>;
  if (!journal || typeof journal !== 'object' || Array.isArray(journal) || Object.values(journal).some(ids => !Array.isArray(ids) || ids.some(id => !Number.isSafeInteger(id) || id <= 0))) throw new Error('Catalogue sync history is unreadable.');
  const rows = (await api.notesQuery(vault)).chronicles;
  for (const book of books.filter(b => !b.id.startsWith('sample_'))) {
    const content = catalogueContent(book);
    const owned = rows.filter(row => row.content.startsWith(marker(book.id)) || legacyMatch(row.content, book));
    const existing = owned.find(row => row.content === content);
    const id = numericId(existing?.id ?? (await api.catalogueIngest(vault, content, `mnemoreader-book:${book.id}`)).chronicleId ?? NaN);
    const previous = [...new Set([...(journal[book.id] ?? []), ...owned.map(row => numericId(row.id))])];
    journal[book.id] = [...new Set([...previous, id])];
    localStorage.setItem(key, JSON.stringify(journal));
    const stale = previous.filter(old => old !== id);
    if (stale.length) {
      const result = await api.forgetNotes(stale);
      if (!result.success) throw new Error('Catalogue cleanup could not be confirmed; retry will preserve the current record.');
      if (result.forgotten !== stale.length) {
        const check = (await api.notesQuery(vault)).chronicles;
        if (check.length >= 200 || check.some(row => stale.includes(numericId(row.id)))) throw new Error('Catalogue cleanup could not be confirmed; retry will preserve the current record.');
      }
    }
    journal[book.id] = [id];
    localStorage.setItem(key, JSON.stringify(journal));
  }
}
