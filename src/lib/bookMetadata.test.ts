import { expect, it } from 'vitest';
import { repairBookMetadata } from './bookMetadata';
import type { Book } from './types';

it('repairs only the confirmed reversed import and preserves reading data and identity', () => {
  const reversed = { id: 'existing-book', title: 'John Steinbeck', author: 'East of Eden', progressSentence: 50, chapters: [] } as unknown as Book;
  const repaired = repairBookMetadata(reversed);
  expect(repaired).toEqual({ ...reversed, title: 'East of Eden', author: 'John Steinbeck' });
  expect(repairBookMetadata(repaired)).toBe(repaired);
  const other = { ...reversed, author: 'Another book' };
  expect(repairBookMetadata(other)).toBe(other);
});
