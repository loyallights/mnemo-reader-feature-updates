import { useEffect, useRef, useState } from 'react';
import { bridge, isFramed } from '../lib/bridge';
import type { Book } from '../lib/types';
import { syncCatalogue } from '../lib/catalogueSync';

/**
 * The app's own walled-off vault, and one chronicle per book inside it.
 *
 * This is the ONLY part of MnemoReader that writes about the library rather than
 * about a book being read, which is why it lives apart: the catalogue is a
 * side-effect of owning books, not a step of opening one. Nothing in the reading
 * path depends on it, and a host that refuses it changes nothing on screen.
 *
 * Returns the vault's name once it exists, for anything that wants to name it.
 */
export function useSandboxCatalogue(books: Book[]): string | null {
  const queue = useRef(Promise.resolve());
  const latestBooks = useRef(books);
  latestBooks.current = books;
  // Name of this app's walled-off sandbox vault (`APP-MNEMO-READER`) once ensured.
  const [sandboxVault, setSandboxVault] = useState<string | null>(null);

  // ── App sandbox vault (doc 58) ─────────────────────────────────────────────
  // Ensure the walled-off `APP-MNEMO-READER` vault at boot, then declare its
  // Vault Pad tile. The vault starts isolated (no federated RAG / neural map /
  // Dream State) until the human unlocks permanence from the host — so giving
  // Mnemosyne "the memory of the books" is the human's gated choice.
  useEffect(() => {
    if (!isFramed()) return;
    let cancelled = false;
    void (async () => {
      try {
        const sb = await bridge.ensureSandbox();
        if (cancelled || !sb?.vault) return;
        setSandboxVault(sb.vault);
        await bridge.describeVaultTile({
          icon: '📚',
          metrics: [
            { label: 'Books', spine: 'SOCIAL_CONTACT' },
            { label: 'Notes', spine: 'SOCIAL_NODE' },
          ],
        });
      } catch (err) {
        console.warn('[MnemoReader] sandbox vault ensure failed', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Serialize reconciliation so metadata changes cannot race an older write.
  const signature = JSON.stringify(
    books.map(({ id, title, author, ext, chapters, sentenceCount }) => ({
      id,
      title,
      author,
      ext,
      chapters: chapters.length,
      sentenceCount,
    }))
  );
  useEffect(() => {
    if (!sandboxVault) return;
    let cancelled = false;
    const run = () => {
      queue.current = queue.current
        .then(async () => {
          if (!cancelled) await syncCatalogue(sandboxVault, latestBooks.current);
        })
        .catch((error) => console.warn('[MnemoReader] catalogue sync needs attention', error));
    };
    run();
    const timer = setInterval(run, 60000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // Only catalogue metadata changes schedule writes; playback progress does not.
  }, [sandboxVault, signature]);

  return sandboxVault;
}
