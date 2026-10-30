import { useMemo, useState } from 'react';
import { searchBook, type BookSearchResult } from '../lib/bookSearch';
import type { Annotation } from '../lib/annotations';
import type { Book, LoadedBook } from '../lib/types';

export function BookSearch({ book, loaded, notes, general, labels, onSelect }: {
  book: Book; loaded: LoadedBook; notes: Annotation[]; general: string; labels: Record<string, string>;
  onSelect: (result: BookSearchResult) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'all' | 'book' | 'notes'>('all');
  const [limit, setLimit] = useState(30);
  const results = useMemo(() => searchBook(book, loaded, notes, general, labels, query, scope), [book, loaded, notes, general, labels, query, scope]);
  return <>
    <button className="chip" aria-expanded={open} onClick={() => setOpen(v => !v)}>Search book & notes</button>
    {open && <section className="book-search-panel" aria-label="Search this book and notes">
      <div className="book-search-heading"><strong>Search · {book.title}</strong><button className="chip" onClick={() => setOpen(false)}>Close search</button></div>
      <label>Words, phrase, or color label<input autoFocus type="search" value={query} placeholder="Search this book and your notes"
        onChange={e => { setQuery(e.target.value); setLimit(30); }} /></label>
      <label>Search in<select value={scope} onChange={e => { setScope(e.target.value as 'all' | 'book' | 'notes'); setLimit(30); }}>
        <option value="all">Book and notes</option><option value="book">Book text</option><option value="notes">My notes and theme labels</option>
      </select></label>
      <p>Matches words and phrases, including your color labels. This searches only the open book; AI recall handles broader searches by meaning.</p>
      {query.trim() && <p role="status">{results.length} matching passage{results.length === 1 ? '' : 's'} or note{results.length === 1 ? '' : 's'}</p>}
      {query.trim() && !results.length && <p>No matches. Try another word or one of your color labels.</p>}
      <div className="book-search-results">
        {results.slice(0, limit).map(result => <button key={result.id} className="book-search-result" onClick={() => { onSelect(result); setOpen(false); }}>
          <strong>{result.title}</strong><span>{result.snippet}</span>
        </button>)}
      </div>
      {results.length > limit && <button className="chip" onClick={() => setLimit(n => n + 30)}>Show more results</button>}
    </section>}
  </>;
}
