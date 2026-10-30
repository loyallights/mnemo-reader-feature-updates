import type { Book } from './types';

/** User-confirmed repair for an existing import; never guess which names are authors. */
export function repairBookMetadata(book: Book): Book {
  const key = (value: string | undefined) => value?.trim().toLowerCase();
  if (key(book.title) === 'john steinbeck' && key(book.author) === 'east of eden') {
    return { ...book, title: 'East of Eden', author: 'John Steinbeck' };
  }
  return book;
}
