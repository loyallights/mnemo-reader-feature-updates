# Maintaining reader notes

## Responsibilities

- `BookNotes` coordinates selection, note storage, chapter expansion, and navigation.
- `BookNoteEntry` owns a highlight's unsaved comment/color draft. Failed saves keep
  that draft open; successful saves close the editor.
- `FloatingNotes` handles movement, resizing, and viewport constraints.
- `BookColorKey` and `HighlightColorPicker` handle per-book color meanings and colors.
- `noteChapters` groups populated chapters and preserves front-matter highlights.
- `annotations` reads and validates local notes and migrates the old array format.
- `bookSearch` performs literal matching within the open book and its notes.
- `notesVaultSync` reconciles notes; `catalogueSync` reconciles book metadata.
- The corresponding hooks schedule these services and expose status to the UI.

The original library, extraction, and audio paths remain in their existing modules.

## Saving and reconciliation

Local writes happen before change events. A failed local write must not appear saved
or trigger a successful remote state. Corrupt stored notes are reported rather than
replaced with an empty version.

Each remote note part starts with a marker containing its book ID. Catalogue records
use a different marker. The local journals retain remote IDs during replacement:
write replacements, persist their IDs, remove superseded IDs, then finalize the
journal. This ordering allows retries after partial failure without deleting the
last saved version before the replacement exists.

Catalogue migration accepts untagged legacy records only when their title, author,
and format exactly match the current book. It does not guess reversed names or make
book-specific corrections. Ambiguous old records require explicit user review.
Deleting a local book's notes uses an explicit deletion queue; a book missing on
another device is not deletion consent. Catalogue records and archived book text
are not purged by note deletion.

The host query is limited to 200 recent entries. Journals track older known IDs, but
clearing browser storage can lose unsynced work and reconciliation history. This
feature syncs retrieval snapshots, not collaborative editable notes across devices.

## Existing spine compatibility

The existing host integration uses `SOCIAL_CONTACT` for catalogue records and
`SOCIAL_NODE` for notes. The tile counts those same spines. This mapping is retained
for compatibility; it is not a claim that books are people or reading notes are
social posts. Switching to Reference/Note requires checking host ingestion, count
metrics, migration, and Dream's allowed categories together.

The cartridge never unlocks permanence, changes vault governance, or runs its own
Dream engine. An unlocked eligible vault can participate in host retrieval and
Dream scans; a successful save does not guarantee a particular inference or bridge.
Quoted passages remain distinguishable from reader comments and general notes.

## Review checks

Run `pnpm test`, `pnpm build`, and `pnpm lint` in an environment with the workspace
SDK available. Commit only the current generated build, not accumulated bundles
from earlier iterations. New annotation controls currently use English strings.

For host validation, save a general note and a highlight/comment, reopen the reader,
verify persistence and navigation, and check retrieval sources in a new chat scoped
to the reader vault. Change book metadata and verify catalogue replacement preserves
notes. Use source vault IDs to distinguish direct reader access from a conversation
that merely quotes reader notes.
