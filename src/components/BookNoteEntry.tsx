import { useState, type Ref } from 'react';
import type { Annotation } from '../lib/annotations';
import { highlightColor, normalizeHex } from '../lib/highlightColors';
import { HighlightColorPicker } from './HighlightColorPicker';

interface Props {
  note: Annotation;
  location: string;
  matches: boolean;
  targeted: boolean;
  entryRef?: Ref<HTMLElement>;
  labels: Record<string, string>;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onJump: () => void;
  onSave: (note: Annotation) => boolean;
  onRemove: () => void;
}

/** One saved passage, with a local edit draft that survives a failed save. */
export function BookNoteEntry({
  note,
  location,
  matches,
  targeted,
  entryRef,
  labels,
  editing,
  onEditingChange,
  onJump,
  onSave,
  onRemove,
}: Props) {
  const [comment, setComment] = useState(note.comment);
  const [color, setColor] = useState(highlightColor(note.color));

  const edit = () => {
    setComment(note.comment);
    setColor(highlightColor(note.color));
    onEditingChange(true);
  };

  const save = () => {
    const normalized = normalizeHex(color);
    if (normalized && onSave({ ...note, comment: comment.trim(), color: normalized })) {
      onEditingChange(false);
    }
  };

  return (
    <article
      ref={entryRef}
      tabIndex={-1}
      className={`book-note-entry${targeted ? ' targeted-note' : ''}`}
    >
      <button className="note-location" disabled={!matches} onClick={onJump}>
        {location}
      </button>
      {!matches && (
        <p>Book text has changed. This saved quote is preserved, but its location needs review.</p>
      )}
      <blockquote style={{ borderLeftColor: highlightColor(note.color) }}>{note.quote}</blockquote>
      {editing ? (
        <>
          <label>
            Comment
            <textarea value={comment} onChange={(event) => setComment(event.target.value)} />
          </label>
          <HighlightColorPicker value={color} onChange={setColor} labels={labels} />
          <button className="chip" disabled={!normalizeHex(color)} onClick={save}>
            Save changes
          </button>{' '}
          <button className="chip" onClick={() => onEditingChange(false)}>
            Cancel
          </button>
        </>
      ) : (
        <>
          {note.comment && <p className="note-comment">{note.comment}</p>}
          <button className="chip" onClick={edit}>
            Edit highlight
          </button>{' '}
          <button className="chip" onClick={onRemove}>
            Remove highlight
          </button>
        </>
      )}
    </article>
  );
}
