import type { Book } from '../lib/types';
import { useI18n } from '../i18n/useI18n';

/**
 * Deletion validation overlay — replaces the old instant right-click removal.
 * The sandboxed iframe blocks window.confirm(), so this is an in-app modal.
 *
 * Governance: it states EXACTLY what is deleted and what is not. What was
 * archived into the Mnemosyne vault deliberately stays — memory is governed by
 * the human from the host (Governance / Neural Map), never silently from a
 * cartridge. A host-gated "also forget the archived memory" flow is planned
 * (needs per-book tagging host-side); until then this modal makes no promise
 * it cannot keep.
 */
export function ConfirmDelete({ book, onCancel, onConfirm }: {
  book: Book;
  onCancel: () => void;
  onConfirm: (book: Book) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="import-overlay" onClick={onCancel}>
      <div className="import-card" onClick={(e) => e.stopPropagation()}>
        <div className="import-title">{t('confirm.title', { title: book.title })}</div>
        <div className="import-msg" style={{ textAlign: 'left' }}>
          <p style={{ margin: '0 0 8px' }}>{t('confirm.line1')}</p>
          <p style={{ margin: '0 0 8px' }}>{t('confirm.line2')}</p>
          <p style={{ margin: 0 }}>{t('confirm.line3')}</p>
          <p>This also removes this book’s saved highlights and comments from MnemoReader.</p>
          <p>Its synced note copies will also be removed from the MnemoReader vault. If the host is unavailable, that removal waits until the cartridge can sync again. Previously archived book text stays in the Library vault.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button className="btn btn-ghost" onClick={onCancel}>{t('confirm.cancel')}</button>
          <button className="btn btn-primary" onClick={() => onConfirm(book)}>{t('confirm.remove')}</button>
        </div>
      </div>
    </div>
  );
}
