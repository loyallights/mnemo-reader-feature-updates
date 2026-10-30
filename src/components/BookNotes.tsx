import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Book, LoadedBook } from '../lib/types';
import {
  matchesPassage,
  passage,
  readBookNotes,
  writeAnnotations,
  writeGeneralNote,
  writeColorKey,
  type Annotation,
} from '../lib/annotations';
import {
  DEFAULT_HIGHLIGHT,
  highlightColor,
  highlightInk,
  normalizeHex,
} from '../lib/highlightColors';
import { HighlightColorPicker } from './HighlightColorPicker';
import { BookColorKey } from './BookColorKey';
import { FloatingNotes } from './FloatingNotes';
import { useBookVaultStatus } from '../hooks/useNotesVaultSync';
import { VAULT_NOTES_RETRY } from '../lib/notesVaultSync';
import { isFramed } from '../lib/bridge';
import { BookSearch } from './BookSearch';
import { BookNoteEntry } from './BookNoteEntry';
import { chapterForNote, noteChapterKey, groupNotesByChapter } from '../lib/noteChapters';

interface Props {
  book: Book;
  loaded: LoadedBook;
  onJump: (sentence: number) => void;
  children: (
    render: (
      text: string,
      sentence: number,
      word: { start: number; end: number } | null
    ) => ReactNode
  ) => ReactNode;
}

export function BookNotes({ book, loaded, onJump, children }: Props) {
  const vaultStatus = useBookVaultStatus(book.id);
  const [saved, setSaved] = useState(() => {
    try {
      return { ...readBookNotes(book.id), error: '' };
    } catch {
      return {
        notes: [] as Annotation[],
        general: '',
        colorLabels: {},
        hiddenColors: [],
        error:
          'Saved notes could not be read. Reopen this book to retry; existing notes have not been overwritten.',
      };
    }
  });
  const [generalDraft, setGeneralDraft] = useState(saved.general);
  const [labelDraft, setLabelDraft] = useState(saved.colorLabels);
  const [hiddenDraft, setHiddenDraft] = useState(saved.hiddenColors);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});
  const [noteTarget, setNoteTarget] = useState<{ id: string } | null>(null);
  const targetEntry = useRef<HTMLElement>(null);
  const generalEntry = useRef<HTMLElement>(null);
  const [generalTarget, setGeneralTarget] = useState<object | null>(null);
  const [selection, setSelection] = useState<Annotation | null>(null);
  const [comment, setComment] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [color, setColor] = useState(DEFAULT_HIGHLIGHT);
  const prose = useRef<HTMLDivElement>(null);
  const notes = saved.notes;
  const valid = notes.filter((a) => matchesPassage(loaded, a));
  const chapterFor = (note: Annotation) => chapterForNote(book, note);
  const chapterKey = (note: Annotation) => noteChapterKey(book, note);
  const chapterGroups = groupNotesByChapter(book, notes);

  useEffect(() => {
    if (open && noteTarget && targetEntry.current) {
      targetEntry.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      targetEntry.current.focus({ preventScroll: true });
    }
  }, [open, noteTarget]);

  useEffect(() => {
    if (open && generalTarget && generalEntry.current) {
      generalEntry.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      generalEntry.current.querySelector('textarea')?.focus({ preventScroll: true });
    }
  }, [open, generalTarget]);

  const openHighlightNote = (id: string) => {
    setGeneralTarget(null);
    const annotation = notes.find((a) => a.id === id);
    const group = annotation ? chapterKey(annotation) : null;
    if (group) setExpandedChapters((prev) => ({ ...prev, [group]: true }));
    setSelection(null);
    setOpen(true);
    setNoteTarget({ id });
  };

  const commit = (next: Annotation[]) => {
    if (saved.error) return false;
    try {
      writeAnnotations(book.id, next);
      setSaved((prev) => ({ ...prev, notes: next }));
      setError('');
      return true;
    } catch {
      setError(
        'Your change could not be saved. Storage may be full or unavailable. Please try again.'
      );
      return false;
    }
  };

  const saveGeneral = (value: string) => {
    if (saved.error) return;
    try {
      writeGeneralNote(book.id, value);
      setSaved((prev) => ({ ...prev, general: value }));
      setError('');
    } catch {
      setError(
        'Your general notes could not be saved. Keep this book open and try Save notes again.'
      );
    }
  };

  const saveLabels = (labels: Record<string, string>, hidden: string[] = hiddenDraft) => {
    if (saved.error) return;
    try {
      writeColorKey(book.id, labels, hidden);
      setSaved((prev) => ({ ...prev, colorLabels: labels, hiddenColors: hidden }));
      setError('');
    } catch {
      setError(
        'Your color labels could not be saved. Keep this book open and try Save color key again.'
      );
    }
  };

  const capture = () => {
    const s = window.getSelection();
    if (!s || s.isCollapsed || !s.rangeCount || !prose.current) {
      setSelection(null);
      return;
    }
    const range = s.getRangeAt(0);
    const endpoint = (node: Node, offset: number) => {
      const el = (
        node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement
      )?.closest<HTMLElement>('[data-sentence]');
      if (!el || !prose.current?.contains(el)) return null;
      const prefix = document.createRange();
      prefix.selectNodeContents(el);
      prefix.setEnd(node, offset);
      const sentence = Number(el.dataset.sentence);
      return {
        sentence,
        offset: Math.min(prefix.toString().length, loaded.sentences[sentence].length),
      };
    };
    const start = endpoint(range.startContainer, range.startOffset);
    const end = endpoint(range.endContainer, range.endOffset);
    if (!start || !end) {
      setSelection(null);
      return;
    }
    const anchor = {
      startSentence: start.sentence,
      startOffset: start.offset,
      endSentence: end.sentence,
      endOffset: end.offset,
    };
    const quote = passage(loaded, anchor);
    if (!quote) {
      setSelection(null);
      return;
    }
    setSelection({ ...anchor, id: crypto.randomUUID(), quote, comment: '', createdAt: Date.now() });
    setComment('');
  };

  const add = () => {
    if (!selection || !normalizeHex(color)) return;
    const duplicate = notes.find(
      (a) =>
        a.startSentence === selection.startSentence &&
        a.startOffset === selection.startOffset &&
        a.endSentence === selection.endSentence &&
        a.endOffset === selection.endOffset &&
        a.quote === selection.quote
    );
    if (duplicate) {
      openHighlightNote(duplicate.id);
      return;
    }
    if (
      commit([...notes, { ...selection, comment: comment.trim(), color: normalizeHex(color)! }])
    ) {
      setExpandedChapters((prev) => ({ ...prev, [chapterKey(selection)]: true }));
      setSelection(null);
      setComment('');
      setOpen(true);
      setNoteTarget(null);
      window.getSelection()?.removeAllRanges();
    }
  };

  const render = (text: string, sentence: number, word: { start: number; end: number } | null) => {
    const ranges = valid
      .filter((a) => a.startSentence <= sentence && a.endSentence >= sentence)
      .map((a) => ({
        start: a.startSentence === sentence ? a.startOffset : 0,
        end: a.endSentence === sentence ? a.endOffset : text.length,
        color: highlightColor(a.color),
        id: a.id,
      }));
    const cuts = [
      ...new Set([
        0,
        text.length,
        ...ranges.flatMap((a) => [a.start, a.end]),
        ...(word ? [word.start, word.end] : []),
      ]),
    ].sort((a, b) => a - b);
    return cuts.slice(0, -1).map((start, i) => {
      const end = cuts[i + 1];
      // For overlaps, the most recently added highlight supplies the color.
      const highlighted = [...ranges].reverse().find((a) => start < a.end && end > a.start);
      const spoken = word && start < word.end && end > word.start;
      const content = spoken ? (
        <span className="kw">{text.slice(start, end)}</span>
      ) : (
        text.slice(start, end)
      );
      return highlighted ? (
        <mark
          className="book-highlight"
          role="button"
          tabIndex={0}
          aria-label="Open note for highlighted passage"
          title="Open this highlight in Book notes"
          onClick={() => {
            if (window.getSelection()?.isCollapsed !== false) openHighlightNote(highlighted.id);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openHighlightNote(highlighted.id);
            }
          }}
          style={{ backgroundColor: highlighted.color, color: highlightInk(highlighted.color) }}
          key={start}
        >
          {content}
        </mark>
      ) : (
        <Fragment key={start}>{content}</Fragment>
      );
    });
  };

  return (
    <>
      <div className="book-notes-tools">
        <BookSearch
          book={book}
          loaded={loaded}
          notes={notes}
          general={generalDraft}
          labels={labelDraft}
          onSelect={(result) => {
            if (result.kind === 'note' && result.noteId) {
              setGeneralTarget(null);
              openHighlightNote(result.noteId);
            } else if (result.kind === 'general') {
              setOpen(true);
              setNoteTarget(null);
              setGeneralTarget({});
            } else if (result.sentence !== undefined) {
              setOpen(false);
              onJump(result.sentence);
            }
          }}
        />
        <button className="chip" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          Book notes ({notes.length})
        </button>
        <span>Select text to highlight or add a comment.</span>
      </div>
      {!open && (error || saved.error) && (
        <p className="notes-error" role="alert">
          {error || saved.error}
        </p>
      )}
      {selection && (
        <section className="selection-note" aria-label="Highlight selected passage">
          <blockquote>{selection.quote}</blockquote>
          <HighlightColorPicker value={color} onChange={setColor} labels={saved.colorLabels} />
          <label>
            Comment (optional)
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} />
          </label>
          <button
            className="btn btn-primary"
            onClick={add}
            disabled={!!saved.error || !normalizeHex(color)}
          >
            Save highlight
          </button>{' '}
          <button className="btn btn-ghost" onClick={() => setSelection(null)}>
            Cancel
          </button>
        </section>
      )}
      <div
        ref={prose}
        onMouseUp={capture}
        onKeyUp={(e) => {
          if (e.key === 'Shift' || e.key.startsWith('Arrow')) capture();
        }}
      >
        {children(render)}
      </div>
      {open && (
        <FloatingNotes title={book.title} onClose={() => setOpen(false)}>
          <p>
            Saved on this device in MnemoReader. Each highlight becomes an entry in this book’s
            running note.
          </p>
          <p role="status">
            {!isFramed()
              ? 'Open inside Mnemosyne OS to sync notes to its vault.'
              : book.id.startsWith('sample_')
                ? 'Demo notes stay local.'
                : (vaultStatus?.message ??
                  'Local notes are waiting for the MnemoReader vault connection.')}
          </p>
          {isFramed() && !book.id.startsWith('sample_') && (
            <button
              className="chip"
              onClick={() => window.dispatchEvent(new Event(VAULT_NOTES_RETRY))}
            >
              Retry vault sync
            </button>
          )}
          {(error || saved.error) && (
            <p className="notes-error" role="alert">
              {error || saved.error}
            </p>
          )}
          <BookColorKey
            labels={labelDraft}
            usedColors={notes.map((a) => a.color)}
            disabled={!!saved.error}
            hiddenColors={hiddenDraft}
            onRemove={(hex) => {
              const hidden = [...new Set([...hiddenDraft, hex])];
              setHiddenDraft(hidden);
              saveLabels(labelDraft, hidden);
            }}
            onAdd={(hex) => {
              const labels = { ...labelDraft, [hex]: labelDraft[hex] ?? '' };
              const hidden = hiddenDraft.filter((h) => h !== hex);
              setLabelDraft(labels);
              setHiddenDraft(hidden);
              saveLabels(labels, hidden);
            }}
            unsaved={
              JSON.stringify(labelDraft) !== JSON.stringify(saved.colorLabels) ||
              JSON.stringify(hiddenDraft) !== JSON.stringify(saved.hiddenColors)
            }
            onChange={(labels) => {
              setLabelDraft(labels);
              saveLabels(labels);
            }}
            onRetry={() => saveLabels(labelDraft)}
          />
          <h3>Highlights and comments</h3>
          {!notes.length && <p>No highlights yet. Select a passage in the book to start.</p>}
          {chapterGroups.map((group) => (
            <details
              key={group.id}
              className="notes-chapter"
              open={expandedChapters[group.id] ?? false}
              onToggle={(e) => {
                const isOpen = e.currentTarget.open;
                setExpandedChapters((prev) =>
                  prev[group.id] === isOpen ? prev : { ...prev, [group.id]: isOpen }
                );
              }}
            >
              <summary>
                {group.title} <span>({group.notes.length})</span>
              </summary>
              {group.notes.map((note) => (
                <BookNoteEntry
                  key={note.id}
                  note={note}
                  location={chapterFor(note)?.title || 'Return to passage'}
                  matches={matchesPassage(loaded, note)}
                  targeted={noteTarget?.id === note.id}
                  entryRef={noteTarget?.id === note.id ? targetEntry : undefined}
                  labels={saved.colorLabels}
                  editing={editing === note.id}
                  onEditingChange={(isEditing) => setEditing(isEditing ? note.id : null)}
                  onJump={() => {
                    onJump(note.startSentence);
                    setOpen(false);
                  }}
                  onSave={(updated) =>
                    commit(
                      notes.map((existing) => (existing.id === updated.id ? updated : existing))
                    )
                  }
                  onRemove={() => commit(notes.filter((existing) => existing.id !== note.id))}
                />
              ))}
            </details>
          ))}
          <section className="book-note-entry" ref={generalEntry}>
            <label>
              General notes
              <textarea
                value={generalDraft}
                disabled={!!saved.error}
                placeholder="Write thoughts about this book without selecting a passage."
                onChange={(e) => {
                  setGeneralDraft(e.target.value);
                  saveGeneral(e.target.value);
                }}
              />
            </label>
            <p role="status">
              {generalDraft === saved.general
                ? 'Saved on this device.'
                : 'Unsaved changes — please retry saving.'}
            </p>
            <button
              className="chip"
              disabled={!!saved.error || generalDraft === saved.general}
              onClick={() => saveGeneral(generalDraft)}
            >
              Save notes
            </button>
          </section>
        </FloatingNotes>
      )}
    </>
  );
}
