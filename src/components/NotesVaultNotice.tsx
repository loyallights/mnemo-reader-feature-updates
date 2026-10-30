import { useEffect, useState } from 'react';
import { isFramed } from '../lib/bridge';
import { VAULT_NOTES_RETRY, VAULT_NOTES_STATUS, vaultNoteFailures } from '../lib/notesVaultSync';

export function NotesVaultNotice() {
  const [failures, setFailures] = useState(vaultNoteFailures);
  useEffect(() => {
    const refresh = () => setFailures(vaultNoteFailures());
    window.addEventListener(VAULT_NOTES_STATUS, refresh);
    return () => window.removeEventListener(VAULT_NOTES_STATUS, refresh);
  }, []);
  if (!isFramed() || !failures.length) return null;
  return <div className="vault-sync-notice" role="alert">
    <span>Some book notes or note deletions have not synced to the vault. AI recall may still have older details. Your local notes are kept.</span>
    <button className="chip" onClick={() => window.dispatchEvent(new Event(VAULT_NOTES_RETRY))}>Retry notes sync</button>
  </div>;
}
