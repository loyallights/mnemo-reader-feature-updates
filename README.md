<div align="center">

<img src="https://raw.githubusercontent.com/Mnemosyne-OS/Mnemosyne-Neural-OS/main/assets/banner-mnemosyne-os.png" width="100%" alt="Mnemosyne OS — Your memory. Your machine. Your rules." />

🌐 [**mnemosyne-os.io**](https://mnemosyne-os.io) — the product&ensp;·&ensp;[**mnemosyne-os.com**](https://mnemosyne-os.com) — for organizations&ensp;·&ensp;📖 [**docs.mnemosyne-os.io**](https://docs.mnemosyne-os.io) — the documentation

</div>

# MnemoReader

**A living book library with voice reading — EPUB, PDF, DOCX and more. A cartridge for [Mnemosyne OS](https://github.com/Mnemosyne-OS/Mnemosyne-Neural-OS).**

> [!IMPORTANT]
> **MnemoReader is a cartridge — it runs inside Mnemosyne OS.** Install the host app first, then load this cartridge from MnemoHub (or link it in dev mode).
>
> [![Download latest release](https://img.shields.io/badge/⬇%20Download-Mnemosyne%20OS%20latest-0ea5e9?style=for-the-badge)](https://github.com/Mnemosyne-OS/Mnemosyne-Neural-OS/releases/latest) &nbsp; [![Mnemosyne OS repository](https://img.shields.io/badge/GitHub-Mnemosyne%20OS-181717?style=for-the-badge&logo=github)](https://github.com/Mnemosyne-OS/Mnemosyne-Neural-OS)

Drop a book — **EPUB, PDF, DOCX, RTF, TXT, HTML, Markdown…** — or a whole folder, and MnemoReader:

- 📖 **Extracts the text** host-side (pdf-parse / mammoth — PDF, DOCX, TXT, MD…)
- 🧠 **Vectorizes + archives** it into a dedicated **Library vault** (SHA-256 dedup, auto-spines)
- 🔖 **Auto-detects chapters** from headings, numbering, and structure
- 🔊 **Reads it aloud** with **word-synced karaoke highlighting**, resume position, chapter jumping, variable speed, and a sleep timer
- 🌍 **Speaks seven languages** (de, en, es, fr, pt, ru, zh), following the host, and it tells you when no installed voice speaks the book's own language rather than reading it in the wrong one

<p align="center"><em>Dark reading-lamp UI · liquid-glass surfaces · fluid motion.</em></p>

![The reader — chapter rail, reading canvas, and the audio dock with karaoke-synced playback](./docs/images/reader.png)

---

## How it works

MnemoReader is a sandboxed **cartridge**: it runs in an iframe and talks to the
host only through a whitelisted postMessage bridge (`src/lib/bridge.ts`). It
declares exactly the permissions it needs (`vault:read`, `vault:write`,
`model:infer`, `dialog:open`, `shell:open`) and nothing more.

```
MnemoReader (iframe)                 Mnemosyne OS host
────────────────────                 ─────────────────
dialog.selectFile      ───▶  OS file picker
reader.extractDocument ───▶  pdf-parse / mammoth  → plain text
reader.ttsStatus/Voices───▶  the host's local voice engines (status/voices)
reader.ttsSpeak        ───▶  the chosen engine → raw PCM (played via Web Audio)
reader.ingest          ───▶  routePulse → vectorize + archive into LIBRARY vault
```

### One player, whichever engine the host offers

| Engine | Quality | Karaoke | Availability |
|--------|---------|---------|--------------|
| **System voice** (Web Speech) | good | **exact** (word-boundary events) | always, in-browser |
| **A local neural engine** | excellent | time-interpolated | when installed + licensed in the host |

MnemoReader names no engine of its own. It asks the host which local voices are
installed and plays the one you chose in Mnemosyne OS settings, so an engine
added to the OS works here without a line of code changing. The reader starts on
the system voice, follows your host setting every time it opens, and when a
neural engine stops answering mid-session it names the engine it fell back from
instead of just saying a voice is unavailable.

## Try it standalone

You don't need the full OS to explore the reader UI:

```bash
pnpm install
pnpm dev          # http://localhost:5210
```

Then click **“Try it with a sample story”** — the reader, karaoke highlighting,
chapters, and system-voice playback all work in a plain browser tab. (PDF import
and vault archiving require running inside Mnemosyne OS, which provides the file
picker, extractor, and vault engine.)

![The library — drop a book, import a folder, or paste a link](./docs/images/library.png)

## Build

```bash
pnpm build        # tsc + vite → dist/  (served via mnemo-plugin:// when installed)
```

## Project layout

```
src/
├── App.tsx                 # library ⇆ reader, ingest pipeline, toasts, resume
├── styles.css              # design system (glassmorphism, amber accent, motion)
├── sdk/mnemo-sdk.ts        # postMessage bridge to the host
├── i18n/
│   ├── useI18n.ts          # follows the host's language
│   └── locales/            # de, en, es, fr, pt, ru, zh
├── hooks/
│   ├── useReaderVoice.ts   # engine selection, playback state, fallbacks
│   ├── useSandboxCatalogue.ts
│   └── useSleepTimer.ts
├── lib/
│   ├── bridge.ts           # typed reader ⇄ host actions
│   ├── voice.ts            # the single import site for the three files below
│   ├── voice/player.ts     # ReaderPlayer: backends and the gapless scheduler
│   ├── voice/leadPolicy.ts # how much audio to hold when an engine is slower than speech
│   ├── voice/browserVoices.ts
│   ├── pdf.ts              # sentence split, chapter detection, ingest chunking
│   ├── lang.ts             # does any installed voice speak this book?
│   ├── textStore.ts        # extracted text cached in IndexedDB
│   ├── vaults.ts           # provisions the Library vault
│   └── types.ts
└── components/
    ├── Library.tsx  BookCard.tsx      # cover grid, progress rings, ingest states
    ├── Reader.tsx   ChapterRail.tsx   # reading canvas + chapter navigation
    ├── AudioDock.tsx                  # transport, scrubber, speed/voice/sleep
    ├── ImportOverlay.tsx  ConfirmDelete.tsx
    └── Icons.tsx    Toast.tsx
```

Tests run with `pnpm test` (68 of them, on the sentence splitter, the language
match, the lead policy and the seven locale files).

## Reader updates: highlights, notes, search, and library progress

The additions below extend the reader described above. Original project content,
credits, and screenshots are retained. The existing screenshots predate these updates.

Developer notes on module responsibilities, reconciliation, and spine compatibility
are in [Maintaining reader notes](docs/reader-notes-development.md).

### Highlights and book notes

**Search book & notes** searches only the currently open book and its saved
highlights/comments, General notes, and color labels. Choose Book text, My notes
and theme labels, or both. Results include chapter context and jump to the passage,
expand its note chapter, or focus General notes. The search matches words/phrases
and your theme labels; it does not infer conceptual similarities. Broader AI recall
remains a separate host feature subject to vault permissions. Search works offline.

Library cards show a percentage based on the saved reading position, including 0%
for unstarted books. **Mark finished** adds a saved Finished badge and displays 100%;
**Mark unfinished** restores the regular progress display without resetting position.
Finishing read-aloud playback without skipped passages also marks the book finished.
Finished books sort after unfinished books by default. The **Show** menu can hide
finished books or show only finished books; the chosen filter is saved on this device.

The notes panel floats over the reader. Drag its title bar to move it; the content
scrolls independently. Drag the bottom-right corner handle to resize the panel.
The resize handle also accepts arrow keys when focused (Shift for larger steps).
Minimum sizes keep the controls usable, and resizing is bounded by the window.
Keyboard users can focus the title bar and use arrow keys
(Shift for larger steps), or Home to reset its position. The panel stays within the
window and keeps its position while open in the same book.


Select text in the reading view, optionally add a comment, then choose **Save highlight**.
**Book notes** opens one running note per book, ordered by passage location. Choose a
chapter link to return to a passage and close the notes panel; comments can be
edited and highlights removed.
Highlights and comments are grouped into collapsible chapter lists, each showing its
highlight count. Only chapters containing saved highlights/comments appear. Title and author headings
are omitted; highlights on those pages remain under Other saved passages. Chapters
start collapsed and can be opened independently. Clicking
a highlight in the reader automatically expands its chapter before revealing the entry.
Click a saved highlight in the reader to open Book notes directly at its entry.
Keyboard users can focus a highlight and press Enter or Space. Selecting text across
a highlight still works without opening notes.
The saved highlights remain separate from the moving read-aloud word highlight.

Each book also has a **General notes** section for thoughts unrelated to a selected
passage. It saves as you type, independently of highlights. If saving fails, keep
the book open and use **Save notes** to retry. Existing highlights are preserved
when upgrading to the combined notes format. Highlights offer seven rainbow
presets plus a custom 3- or 6-digit hex field with a preview. Use **Edit highlight**
to change an existing color or comment. Older highlights remain yellow. Custom
colors automatically use contrasting black or white text. For overlapping
highlights, the most recently added highlight supplies the visible color.

**Color key** is a collapsible list at the top of Book notes, closed by default to
keep the panel compact. Highlights and comments follow, with General notes at the
end. Expand Color key to find a blank label field beside each rainbow
swatch and any custom highlight colors used in this book. Write your own meanings;
labels save as you type, separately for each book. The highlight picker shows the
saved meaning beside its preview and in each swatch's tooltip. Labeling a custom
color also makes it available as a picker swatch for reuse. Existing notes and
highlights are preserved when adding or changing labels.
Use the × beside a color to remove it from that book's key. Removed colors can be
added back from the dropdown, with their labels preserved. You can also add a custom
hex color before using it for any highlights. Removing a key row never deletes or
recolors existing highlights; the selection is saved separately for each book.

Notes save locally first. Inside Mnemosyne OS they also sync to the app's own
`APP-MNEMO-READER` vault, using the host's existing `vault:read`/`vault:write`
permissions. The vault must separately be allowed for AI recall in the host;
the cartridge never enables permanence or broadens retrieval permissions itself.
The preview and sample story keep their notes local. This does not create entries
in the host's separate Notes app or synchronize the editable UI across devices.

Sync includes quoted highlights, their chapter locations, reader comments, General
notes, and color meanings. It runs after a short typing pause, on reopening the
cartridge, on retry, and periodically while it is open. Updates replace older note
copies only after their replacements are safely saved; cleared notes and confirmed
book deletion remove this feature's own vault copies. Catalogue entries and archived
book text are not removed. Failures stay visible, and pending work retries later.
If the cartridge is closed or offline, AI recall can still see the last synced version.
The host currently lists at most 200 recent vault entries; a durable local journal
tracks older synced IDs for replacement/deletion. Keep browser storage until pending
sync work completes. Clearing it can lose pending edits or deletions and the journal.
Clearing local state alone never triggers a purge of remote notes.

### Catalogue consistency and validation

Catalogue records now carry a stable book identifier. Changes save a replacement
before removing superseded records, avoiding duplicate counts as extraction or
metadata changes. Exact legacy catalogue snapshots are migrated without deleting
highlights, general notes, or unrelated vault entries. The book counter is labeled
Books. Existing local book identities and reading positions are preserved.

The current suite contains **107 tests**, including saved annotations, colors,
chapter navigation, search, floating notes, library filters, note sync, and catalogue
reconciliation. Run `pnpm test`, `pnpm build`, and `pnpm lint` to validate changes.
The original test count above describes the baseline reader.

Vault permission failures, retries, replacement writes, deletions, and recovery are
tested with a simulated host. Manual testing inside Mnemosyne OS confirmed note
sync, retrieval of a quote and its distinct reader comment, and reconciliation to
one catalogue entry and one notes entry for a single test book. Local Dream logs
confirmed that the reader notes entry was included in a multi-vault comparison scan;
a specific resulting cross-vault bridge was not independently verified.

The standalone checkout retains the original `workspace:*` SDK dependency. Outside
the Mnemosyne workspace, the SDK must be supplied through the workspace or installed
separately for development; host import, extraction, vault sync, and AI recall cannot
be tested in the standalone browser preview.

### Dream State and cross-vault associations

Saved notes use `SOCIAL_NODE`, so Dream's Social category must be enabled.
The host also excludes isolated app sandboxes from Dream. Saving successfully does
not unlock the sandbox: the human must unlock permanence in the host's vault controls.
The installed host constructs Dream's corpus from active vaults, excluding isolated
sandboxes, provisional vaults, hidden vaults, and MAXIMUM-protection vaults. Requesting
all vaults does not override those exclusions or activate unmounted vaults.

Every exported part identifies the book and author and distinguishes quoted book
text from reader comments and general notes. Color labels are reader-defined; a
highlight does not establish the reader's agreement or personal experience. These
provenance cues assist inference but cannot guarantee a model's interpretation.
Dream's associations are sampled, so a run need not connect every book or vault.
A consolidation copied from a conversation is not evidence that a reader note was
used directly. Verify source vaults when assessing a particular comparison.
This cartridge neither runs a separate Dream engine nor changes host permissions.
The existing `SOCIAL_CONTACT` catalogue and `SOCIAL_NODE` notes mapping is retained
for compatibility. Moving to Reference/Note spines requires checking host ingestion
and Dream eligibility; it is not included in this update. Annotation controls use
English labels even when the baseline reader follows another host language.
Highlights apply to extracted reader text and do not modify the original PDF/document.
If re-extraction or Deep OCR changes a saved passage, its quote and comment are kept
in Book notes, with a warning instead of highlighting or linking to the wrong text.
The annotation controls currently use English labels.

## License

MIT © Mnemosyne Labs. Contributions welcome — this cartridge is meant to be
forked and remixed.

## Where Mnemosyne OS lives

This cartridge runs inside **Mnemosyne OS**, the sovereign, local-first memory operating system published by XPACEGEMS LLC. Its official addresses:

- Product site: <https://mnemosyne-os.io>
- Organizations: <https://mnemosyne-os.com>
- Documentation: <https://docs.mnemosyne-os.io>
- Host source: <https://github.com/Mnemosyne-OS/Mnemosyne-Neural-OS>
- Packages: the npm scope `@mnemosyne_os`

---

<sub>**[Mnemosyne OS](https://mnemosyne-os.io)** — the sovereign, local-first memory OS this cartridge runs in.
Get it at [mnemosyne-os.io/download](https://mnemosyne-os.io/download), install cartridges from the built-in MnemoHub store, or [build your own](https://mnemosyne-os.io/dev).</sub>
