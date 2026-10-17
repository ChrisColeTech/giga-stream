# 06 - Pages and panes

**Status: the surface specification — every pane, toolbar, control, window and state of the interface.
Rewritten to the app as built on 2026-10-17 (after `25`'s remediation waves). Where a row says "phase 1",
the control is wired to its stub in `services/` and refuses with one sentence until phase 2 (`22`).**

This document says what is inside each surface and what each control does. `02` owns the interface
architecture (state, services, hydration), `03` the fileserver's wire, `04` movement between surfaces and
what persists, and `05` the walks. Nothing is attributed to the owner except in their quoted words.

---

## 1. Shell

The window is one titlebar, the active surface, an optional events drawer and a statusbar. The three
surfaces stay mounted for the life of the session. There are no routes (`04`).

### 1.1 Titlebar (40px)

| Position | Control | Behaviour |
|---|---|---|
| far left | **Left-pane toggle** | Shows or hides the active surface's left pane; pressed (accent outline) while it is shown; restores the committed size. Tooltip "Toggle the left pane" |
| left | **Brand** | A small accent icon tile and a two-line mono wordmark, `GIGA / STREAM` |
| centre | **Live / Library / Player** | A recessed rounded track with a sliding chip; the active surface is the chip. The only navigation between surfaces |
| right | **Bottom-pane toggle** | Player's related band. On a surface with no bottom pane it stays in place, disabled, with the reason as its tooltip |
| right | **Right-pane toggle** | Shows or hides the active surface's right pane |
| far right | **Window controls** | Minimize, maximize or restore, close, in the platform's own caption metrics, through named preload capabilities |

- The titlebar is a window drag region; its buttons are not.
- While a work window is open its scrim covers everything below the titlebar, and the pane toggles and the
  surface switch sleep with it.
- There is no account, search field, Settings gear, provider chip or media control in the titlebar.

### 1.2 Statusbar (24px)

| Element | Behaviour |
|---|---|
| **Running work** | First. LoRA Studio's running work: a 112px bar that fills to the first running job's percent (full and pulsing when the job cannot say how far it is, as a scan walking a folder), then `N running · X%` in mono, or `idle` over an empty track, then **Stop**. Stop cancels the first running job on one press (owner: a confirm makes no sense on an emergency stop); with nothing running it is disabled, `Nothing to stop`. The job's label and percent are the tooltip. Phase 1 reads the jobs fixture and Stop calls the `cancelJob` stub |
| **Notice line** | One polite live region. Each sentence replaces the last, in the text colour; a warn or error has a tone-coloured alert glyph before it, so it stays legible on the light theme and colour is not the only signal. It carries every outcome, refusal and unreadable-answer report. A warn or error is also appended to the events log |
| **Events** | An icon and the label "Events". Toggles the drawer; tinted while it is open |
| **Settings** | An icon and the label "Settings". Opens the Settings window. It is not a toggle and is never lit: the window's scrim covers the statusbar, and the window's `X` and Escape close it |

There is no connection dot or word. A dot is not used for state anywhere, and the outcome of the last request
is the notice line's sentence. The fileserver's answers land there too: a refusal's sentence, and any part of
an answer the interface could not read.

### 1.3 Panes and sashes

| Pane | Axis | Min | Preferred | Max | Collapsible |
|---|---|---:|---:|---:|---|
| Live settings (left) | width | 240 | 288 | 400 | yes |
| Live stage (centre) | width | 480 | flex | - | no |
| Live channels (right) | width | 260 | 320 | 440 | yes |
| Library collections (left) | width | 248 | 288 | 420 | yes |
| Library body (centre) | width | 520 | flex | - | no |
| Library filters (right) | width | 260 | 300 | 420 | yes |
| Player browser (left) | width | 190 | 236 | 380 | yes |
| Player stage (centre) | width | 520 | flex | - | no |
| Player inspector (right) | width | 220 | 280 | 420 | yes |
| Player related (bottom) | height | 60 | 140 | 280 | yes |
| Events drawer | height | 160 | 160 | 160 | yes |

- Allotment owns the sashes, pointer capture and the committed sizes; the sash is a 1px line.
- A collapse commits visibility at once and then a 100 ms tween paints the travel by writing each frame
  into Allotment, so the pane slides out and the centre follows. A pane's content keeps at least its minimum
  width and hugs the edge that stays put. Reduced motion makes it instant.
- A closed pane's sash cannot be dragged open; only the toggle reopens it. A closed pane is `inert`, so its
  controls leave the tab order and `Ctrl+F` never focuses a search inside it.
- A pane's size and visibility are saved a moment after they change and restored at launch (phase 2).
- Below 1000px of work width the right pane collapses first, then the left (below the centre's minimum plus
  the left pane's minimum); the centre never collapses. The notice line says which pane collapsed. A pane the
  width closed comes back when the width crosses its line again, and the notice says so, unless the user has
  opened or closed it since (`lib/pane-collapse.ts`).

### 1.4 Showing the window

The window mounts invisible, applies the saved surface, panes and sizes from the first `hello`, snaps the
panes to them without a tween, and becomes visible two animation frames later, once the panes have settled
(`02` §2.3). It never shows a default surface for the moment before the saved one arrives.

---

## 2. Rules every surface follows

1. **Loading and empty are skeletons** in the shape of their content: channel rows, poster cards, episode
   rows. Never a sentence over a skeleton, and no separate empty-state composition.
2. **Last good content stays** while a refresh runs and when a refresh fails recoverably; one notice says
   why.
3. **A control works or is visibly disabled.** A disabled control stays in place, dimmed, and its reason is
   its tooltip. No text is printed under a control.
4. **Pane toolbars are icons**, each with an accessible name and the family tooltip; ghost by default, no
   filled accent toolbar action. Search fields sit in the pane's strip, not in a header.
5. **Selected and playing are different states.** One primary selection per pane. A refresh keeps the
   selection by id while the row still exists.
6. **Each pane has one scroll container.** A surface switch keeps every pane's scroll. Keyboard row
   navigation scrolls the selection into view. Focus rings stay visible.
7. **Explanations are tooltips** on an info glyph or on the disabled control itself, placed against the
   window so no pane clips them. An info glyph belongs to a form group or row, not to a rail section.
8. **Rail sections are collapsible** on the Live and Player rails: the family `Section`, a header with a chevron
   that turns and a title; the whole header row folds the body; the fold state is kept in the store by id and
   survives a surface switch. The fold honours Reduce motion. Open sections share the rail's height and each
   scrolls inside its own share (the family accordion's grow model); in a short rail that leaves space under
   the open sections, which is the model working, not a gap to fill. The Library rail is the exception: it is
   `NavRail` (Sensenova's), whose Views and Collections groups are headed lists that do not fold.
9. **Destructive actions are an inline two-step** (`ArmedButton`, `01` section 9), never a dialog.
10. **No dots.** A state is a word, a left-edge accent strip, or a shimmer where a value is still arriving.

> Owner, 2026-10-15: *"why is there a label under the controls"* — and the rail printed a sentence under
> every section. Reasons are tooltips only.

---

## 3. Live

```
┌──────────────────────┬────────────────────────────────┬──────────────────────┐
│ Playback settings    │ Player                         │ Channels             │
│ Video · Display ·    │ the video, always on the stage │ heading · Refresh    │
│ Audio · Captions ·   │                                │ search · category    │
│ Playback             │                                │ channel rows         │
│                      │                                │ Details              │
└──────────────────────┴────────────────────────────────┴──────────────────────┘
```

### 3.1 Player (centre)

> Owner, 2026-10-15: *"i shouldnt need the admin backend to see a player"* and *"the video player just
> loads the stream. its not converting titles or channels, or copying anything."*

A `<video>` fills the stage, the picture fitted whole inside it by default (the Picture fit preference), with
the browser's own controls (play, time, volume, fullscreen), on `--color-stage`, which stays dark in the light
theme. A custom control bar is a later phase. It is always on the stage.

| State | What the stage shows |
|---|---|
| loading the list | the player alone |
| loading a stream | the player alone, showing its own loading state |
| ready | the picture and the player's controls |
| a stream that fails | a centred note over the picture area (icon, title, the reason in one sentence, **Retry**) |
| no channels | the same note with a **Refresh channels** action |

- Choosing a channel gives the player that channel's `streamUrl`. hls.js drives the stream whenever the
  browser can run it; the browser's own HLS is only a fallback.
- The stage counts as ready on the first frame. A browser that will not start the stream unasked leaves
  the loaded player paused with its Play control.
- **Retry** loads the same address again. A stream that is playing keeps playing even when the list under it
  is cleared.
- Nothing is drawn over the player while it loads. The failure and no-channels notes sit clear of the
  player's control bar and let presses through everywhere but their own button.

> Owner, 2026-10-15: *"its showing the player and a grey box over the middle"* — the picture-shaped
> skeleton that sat over the player while it loaded was removed.

### 3.2 Channels (right)

**Heading row**

| Control | Behaviour |
|---|---|
| `Channels` and the total | readout, in mono: LoRA Studio's queue head |
| **Refresh** icon (`Refresh channels`) | calls `POST /api/channels/refresh`; the whole list and every stream's status update from the answer; the notice line says `Channels refreshed.` or why not (phase 1: the `refreshChannels` stub) |

**When the status moves.** A stream's status (its strip and word) is a fact of the last read. It refreshes when
the list is read — when Live opens, when **Refresh channels** is pressed, or when another action
re-reads the list — and does not change on its own in between (`03` section 5.1). A channel that
goes offline mid-session keeps its `Live` status until the next read.

**Search and category** — both at the rail control height (24px), the same as the playback pane's selects.

| Control | Behaviour |
|---|---|
| Search field | always present; carries `data-search` for `Ctrl+F`; asks `GET /api/channels?q=` after a 250 ms pause; a newer keystroke abandons the older request; a clear control appears when it has text (phase 1 filters the fixture) |
| Category select | the published categories with their counts (`All · 16`), All first; a category chosen and since unpublished stays listed |

**Channel row**

| Element | Behaviour |
|---|---|
| Status strip | LoRA's queue-row accent bar on the left edge: live (the done colour), offline (the failed colour), not checked (the inactive grey) |
| Logo | a 56px 4:3 box: the logo, a shimmer while it loads, a glyph if it cannot be shown |
| Number and name | one mono line, ellipsised |
| Category | the second line, left, faint |
| Status word | the second line, right: `Live`, `Offline` or `Not checked`, so the strip's colour is never the only signal |
| Playing | on the channel the player has loaded, the status word is replaced by `Playing` in the accent (not `live`, which read as the status word) |
| Selected | the control fill alone. The left edge already carries the status strip, and a second strip there read as one muddled mark |
| Activation | a click or `Enter` plays the channel and remembers it (phase 1: marks it playing and calls the `rememberLastChannel` stub, whose refusal is said once) |

- Up, Down, Home and End move the selection and focus (one tab stop on the list); they never start a
  channel. The row has no context menu: the interface has no channel verbs.
- Published order is kept unless a search or category narrows it.

**States.** Loading, empty, a search with no match, and a backend that cannot be reached all show the same
14 skeleton rows; the query and category stay visible. A failed search keeps the last rows and says why on
the notice line.

**Details** — pinned at the foot under the list, as LoRA pins its job details under the queue: the heading
`Details` (never the channel's name, which is the first row), then the selected channel's `name`, `category`,
`number` and `revision` as mono key and value, a dash where nothing is selected. It does not scroll with the list.

**Opening.** With Settings > Playback > **On open** at `Last channel`, Live opens on the last channel played,
selected and already playing; at `Nothing` it selects the first row and plays nothing.

There is no footer, no star, no Manage Channels, no Recents and no Now Playing block. Channels are
published elsewhere.

### 3.3 Playback settings (left)

Five collapsible sections (§2.8). Each row is a mono label in a fixed column with its control beside it, and
every choice is a rail select, never chips. A readout sits at the row's right edge, as the Player inspector's
facts do, so a value has one alignment app-wide.

**The selects are preferences, not a remote for the stream** (owner, 2026-10-16: *"why would my settings
constantly change. thats not how youtube or netflix settings work"*). Each is a standing choice, saved as a
setting (`03` section 3.2) and applied to whatever plays, on Live and in Player alike. They are always usable;
a stream that cannot honor one plays its nearest offer, and nothing about the choice changes.

| Section | Row | Control | Setting | Behaviour |
|---|---|---|---|---|
| Video | quality | Auto / Higher picture quality / Data saver | `videoQuality` | Auto adapts; Higher picks the best level offered, Data saver the lowest |
| Video | resolution | readout | | the picture's size |
| Video | bitrate | readout | | the current level's bitrate |
| Display | fit | Fit / Fill / Original | `pictureFit` | how the picture sits in the stage |
| Display | aspect | readout | | the picture's ratio |
| Audio | language | Stream default and the languages | `audioLanguage` | picks that language's track when the stream has one |
| Captions | captions | Off and the languages | `subtitleLanguage` | shows that language's track when the stream has one |
| Playback | latency | Normal / Low | `lowLatency` | low latency, where the stream offers it |
| Playback | live edge | readout | | seconds behind the live edge |

A readout is a fact of the stream on screen: a dash, with `Available once a channel is playing.` as its
tooltip, until one plays. Volume, mute and fullscreen are on the player and are not repeated here.

---

## 4. Library

```
┌──────────────────┬────────────────────────────────┬──────────────────┐
│ Collections      │ All · Movies · TV · Local      │ Search           │
│ All              │ Continue Watching              │ View · Sort      │
│ History          │ Poster grid or list            │ Genre · Year     │
│ Favorites        │                                │ Watched          │
│ the collections  │                                │                  │
│ Manage collections                                                   │
└──────────────────┴────────────────────────────────┴──────────────────┘
```

### 4.1 Collections (left)

The family's `NavRail`, as Sensenova has it: two headed groups of one row style, a flat list and not a tree.
The groups do not fold (§2.8's exception).

| Group | Rows |
|---|---|
| **Views** | All, History, Favorites, in that order |
| **Collections** | every collection, alphabetical |

**Row**

| Element | Behaviour |
|---|---|
| Name | one line, ellipsised, text only. There are no glyphs in the rail: Sensenova's rail is text |
| Count | the view's or collection's item count, mono, at the trailing edge |
| Scanning | while any folder attached to the collection scans, the count is a shimmer pill the width of a three-digit count (loading is a skeleton, and the edge does not jump when the number lands); the partial count, `Scanning folders · N videos so far`, is the row's tooltip, and `Scanning folders` is announced. Never a dot or a spinner |
| Selected | the accent bar on the row's left edge and the control fill; selecting a row narrows the body |
| Context menu | on a collection: **Attach folder…** (acts here, so a folder is one press away), then **Rename…** and **Remove…**, which open the Collections window on that collection's workspace, where the name field and the two-step live. Neither is danger here: nothing is removed until the window's own two-step. All, History and Favorites have none |

- **Footer.** One full-width ghost **Manage collections** button with a folder-cog icon, pinned in a strip
  under a hairline. It opens the Collections window on its index; creating a collection is that window's first
  group. There is no separate New collection or Add Folder button.
- **States.** With no collections the group draws 5 row skeletons in the row's shape. If the list cannot be
  read, the last rows stay and one notice says why.

### 4.2 Body (centre)

**Type strip**

LoRA Studio's top strip over a gallery grid, holding `All · Movies · TV · Local` as the family's equal-width
pill choice (`Segmented`). No changing count text. The strip is one row and holds no Search, Sort, View,
selection count or batch verb; those belong to the filters. It is drawn over the grid, the list and Rows alike.
Existing cards stay while a scope change resolves.

**Continue Watching**

A horizontal strip above the results, on every view except History, with at most 10 cards, newest first. It
narrows the way the results do: by the type strip and by the rail's view (in a collection, only that
collection's titles in progress). Settings > Library > **Continue watching** off removes it, and the Rows shelf
with it. The strip is drawn only when there is progress to show; with none it is absent, since an empty band
would read as a stray strip, and the grid's own skeletons stand for loading.

| Card element | Behaviour |
|---|---|
| Art | a 16:9 backdrop in the title's colour family, the tile frame of LoRA's gallery; the accent border and ring when selected |
| Progress | a bar on the art's bottom edge |
| Label line | the title (or `Series - S01 E02`), then the time left (`26 min left`) or `Watched`, in mono |
| Verbs | **Play** (**Open** for a series), **Info** and the menu button, as a poster card's |
| Press | selects the card and opens its Info, as a poster does; the context menu is the poster card's |

**Poster grid**

LoRA Studio's gallery tile with Giga Stream's 2:3 poster (owner decision). Cards are at least 144px wide
(`repeat(auto-fill, minmax(144px, 1fr))`, gap 12, padding 12), six to eight across at 1600px of body width.

| Card element | Behaviour |
|---|---|
| Art | the poster in one bordered button: the dim border on hover, the accent border and ring when selected. With no image it is drawn as a poster in the title's colour family with the title set large at its foot, which is the content itself, not placeholder copy |
| Favorite | the star badge in the art's top right corner, in the accent, when the title is a favourite |
| Progress | a bar on the art's bottom edge for a title in progress |
| Verbs | under the art, on equal ghost tile buttons: **Play** (**Open** for a series), **Info**, and a fixed square menu button |
| Title | the art's tooltip and accessible name |

- The owner chose LoRA's tile, so a card has no title line, year line, watched check or quality badge under
  the art: the title is the tooltip, the watch state is the progress bar and Title information, and the quality
  is in Title information and the list.
- A press on the art selects the card and opens its Info; `Enter` on a focused card does exactly what the press
  does. Play and Info are always drawn, never only on hover.
- Context menu (on the card and from its menu button): the watch line as a heading when there is progress, Play
  or Open, Info, Favorite or Unfavorite, then `Collections ▸`: a submenu listing every collection with a check mark
  for its membership. A click toggles membership inline, with no dialog (family standard, Giga Images'
  `docs/frontend/00`, "Context menu actions"). In History it adds **Remove from History**.
- Arrow keys, Home and End move the selection and focus across the cards and scroll it into view; they only
  select.

**List view**

One row per title: a compact poster thumbnail (the image, or the title's colour alone: a box that small cannot
set the title, and the row beside it names it), the title, its facts (`2008 · Series · Drama, Crime`), the
progress bar, the favourite star (lit as the filled accent glyph alone), **Play** or **Open** and **Info** at
one fixed width so the verbs line up down the list, and the menu button. A press on the row selects it and
opens Info. The same commands as the card. Grid, List and Rows only change presentation, never the query or
the selection.

**Rows** (a third presentation, owner decision 2026-10-16). The library as shelves, one per group, of what the
grid would show: the rail's view, the type strip, the search, the filters and the sort narrow Rows exactly as
they narrow the grid. Each shelf is a heading and a horizontal row of the same cards as the grid. Shelves appear
in this fixed order, each only when it has items:

1. Continue Watching (the strip's cards; not in History, and not when the Continue watching setting is off).
2. Favorites.
3. Each collection, alphabetical, as the collections rail lists them.
4. Movies, TV and Local files, by kind.
5. Genres: each genre with at least three items no earlier genre shelf has taken, most items first, at most six.

A shelf's heading (mono, faint, the count dim) holds **See all** at its right end, which switches to the grid with
that group applied on a fresh query (the sort stays): a genre sets the Genre filter; a kind sets the type strip; a
collection opens that collection; Favorites opens the Favorites view. A row scrolls sideways, with raised chevron
buttons at its edges that show while the row is hovered or focused (`01` section 9's over-art exception). Left and
Right move across a row's cards, Up and Down move between rows, and Home and End go to the first and last card of a
row. Selection is single, as in the grid. With no shelf to draw, Rows shows shelves of card skeletons. Trending is
not a shelf. Rows offers no tile-size control.

**History**

Rows are watch entries and keep their watch id. A row's context menu adds **Remove from History** (phase 1: the
`removeHistoryEntry` stub; the fixture's titles with progress carry watch ids, so the row is usable). A strip below the
type strip, in the grid, the list and Rows, holds **Clear history**, an `ArmedButton`: the first press asks
`Clear all history?`, a second within four seconds clears it; blur or Escape disarms; it is disabled with
`The history is already empty.` when there is none. Neither removes favorites, collections or media. The type
strip stays `All · Movies · TV · Local` on every view.

**States**

| Situation | What shows |
|---|---|
| Loading, or nothing found | 12 card skeletons (10 row skeletons in the list) |
| Paging | trailing skeletons, with the cards already shown kept |
| The query fails | the old cards stay, one notice says why, and a retry repeats the exact query |
| An image fails | only that image shows its fallback; the query is not failed |
| The backend cannot be reached | the title cards are skeletons; local files, collections, favorites and history stay usable |

### 4.3 Filters (right)

LoRA Studio's gallery filter pane: one scrolling stack of settings, each a 14px label over a 36px control, and
**Clear filters** pinned under the stack, as the left rail pins Manage collections.

| Filter | Control |
|---|---|
| Search | a field with a search icon and a clear control, `data-search` for `Ctrl+F`; combines with the type strip and every filter |
| View | Grid / List / Rows, segmented. It opens on the **Default view** setting, and follows that setting when it changes |
| Sort | a select: Newest, Oldest, A to Z, Year. It opens on the **Default sort** setting and follows it when it changes. Trending is offered only when the backend supplies a real current popularity signal |
| Genre | a field (the same box and chevron as the selects beside it, not a button) that opens a popover of chips, multi-choice, with a search box when there are 12 or more; Escape or focus leaving closes it |
| Year | a populated select, `Any year` first |
| Watched | a select: All, Unwatched, Watching, Watched |
| **Clear filters** | ghost, full width, always enabled. Returns Genre, Year and Watched to their defaults and the sort to the Default sort setting; keeps the search, the type strip and the rail's view |

- Genre and Year are populated choices and never free text, with no counts. A selected value stays
  listed until it is removed, so no choice disappears.
- A filter change keeps the previous cards while the next result loads; superseded requests are abandoned.
- There is no tile-size slider.

### 4.4 Title information (a work window)

Opened by a card's Info, or a press on a card's art, as a modal work window (`02` section 5), 640px wide: drawn
inside the main window over a scrim, centred at its content's size, moved by its header, resized by its edges,
closed by its `X` or `Escape`, and focus returns to the opener. Favourite and Collections apply at once, so there
is nothing to cancel. The body is `Form`'s page grammar with one group.

| Region | Content |
|---|---|
| Header | `Title information` and a trailing `X` named `Close Title information` |
| Group heading | the title, with the year as its badge. The one group does not fold (`01` section 9's exception) |
| Artwork and plot | a 180px-wide poster (or its drawn fallback) beside the full plot; three shimmer lines while the detail is not read; a local file has no plot |
| Rows | Identity (`1999 · Movie · 1080p`), Genres and Cast as hairline name chips (`NAME_CHIP`, the same chips as the Player's Details), Rating, Runtime or Seasons (`2 seasons · 14 episodes`), Progress (the watch block) when there is one |
| Action strip | pinned at the foot: **Favorite** (the star lights as the accent glyph, no edge) and **Collections** on the left, **Play** (**Open in Player** for a series), the one accent, on the right |

- Only the body scrolls; the header and the action strip stay fixed.
- Favorite applies immediately, and so does a collection toggled from **Collections**. `Escape` or `X` closes it and keeps
  what was applied. Focus returns to the opener only if it still exists and no newer target owns focus.
- It holds no video, filmstrip, episode browser, source picker or transport. Only **Play** hands off to
  Player, and the window closes with the hand-off; current Live or Player playback and Library's panes stay usable.

### 4.5 Add to collection (the `Collections ▸` menu, not a popup)

It is not a popup and has no flow of its own. It is the `Collections ▸` submenu of §4.2, summoned from a card's menu, from Title information's **Collections** button, or from the Player stage's context menu, and it is the app's one context menu (§9). Its rows are the collections, each with a check for membership. A click toggles membership at once, inline, with no dialog.
With no collection yet, the submenu's one row says so, disabled with its reason, and **Manage collections** in the Library rail is the way to create one.

---

## 5. Player

```
┌──────────────────┬────────────────────────────────┬──────────────────┐
│ Seasons and      │ Stage                          │ Overview         │
│ episodes         │ the video, filling the pane    │ Details          │
│                  │                                │                  │
│                  │                                │ Resume (paused)  │
├──────────────────┴────────────────────────────────┴──────────────────┤
│ Related titles across the full width                                 │
└──────────────────────────────────────────────────────────────────────┘
```

Player is always enabled. With nothing open its stage is the player alone, nothing drawn over it, and its
panes are skeletons.

### 5.1 One title at a time (owner decision, 2026-10-16)

The Player has no tabs. It plays one title or one local file at a time, and the stage shows it the way Live's stage does
(§5.3): the picture fills the centre pane, fitted whole, with nothing drawn over it.

| Rule | Behaviour |
|---|---|
| Opening | a title or file opens in place, replacing the current one, and its stream is asked for (phase 1: the `playItem` stub). The current item's final progress write settles first (phase 2) |
| A series | opens on the episode it was left at, with that season shown and that episode the selected row, and asks for that episode (the `playEpisode` stub). A series with no progress opens on its first season and starts nothing until an episode is chosen |
| Reopening | opening the item that is already open does nothing but show Player: no second stream request |
| Episodes | choosing an episode loads it in place and asks for it (`playEpisode`); the season select starts nothing |
| Closing | **Close** in the stage's context menu empties the Player back to its idle state, after the final progress write settles or a short timeout expires |
| Context menu | the stage's own menu, on a right click on the picture: **Retry**, **Full screen**, **Reveal in Library**; **Favorite** or **Unfavorite**, **Collections ▸**, **Remove from History** when a watch entry exists (not danger: it touches no file); **Close**. The idle stage swallows the right click: no menu of its own and never the browser's video menu |
| Marks | Favorite and collection membership are the store's shared marks: a change made here shows in Library and Title information at once, and the reverse |
| Not here | no tab strip, no tab limit, no channel: a channel plays in Live |

### 5.2 Episode browser (left)

No collapsible section wraps the browser; the list is the pane's one scroll container. With nothing open it is
row skeletons.

**Series** — a season select with no label (every option reads `Season N`, so the select names itself; disabled
with its reason when the series has no seasons), then episode rows in LoRA Studio's queue-row shape.

| Row element | Behaviour |
|---|---|
| Still | a 56px 4:3 image, or a glyph |
| Title | the episode's title, one mono line |
| Meta line | `E1`, `E2` (or `E2 · watched`), and the runtime at the right |
| Watch marker | the exact episode only: a watched episode wears the success strip on its left edge; one partly watched carries a 2px progress hairline |
| Selected | the accent left border and the control fill |
| Activation | loads that exact season and episode in place |

Changing the season does not start anything.

**Movie** and **Local file** — one row of the same shape, so the rail reads the same for every kind: the
picture, the title, and `Movie` or `Local file` with the runtime, selected. It is a static row, not a button: it
has nothing to choose. A local file's other facts are in Details (§5.4). Never a path and never invented
chapters or season rows.

### 5.3 Stage (centre)

There is no toolbar and no banner (owner, 2026-10-16: two toolbars on the canvas were redundant and repeated the
title). The `<video>` fills the stage on `--color-stage`, dark in every theme, exactly as on Live (§3.1), and is
fitted by the Picture fit preference (Fit by default). Chrome's native control layers are made transparent
(`styles/video.css`), so a stage with no source stays dark instead of a grey sheet. Loading shows the player
alone. A stream that fails shows Live's stage note (§3.1): an icon, `This stream will not play`, the reason in
one sentence and **Retry**, clear of the control bar. The stage's verbs are its context menu (§5.1).

- **Resume.** With Settings > Playback > **Resume** at `Ask`, a title left partway pins `resume at m:ss`,
  **Resume** (the one accent) and **Start over** at the foot of the details pane while the video is paused, and
  hides them while it plays. At `Always resume` or `Always start over` the Player has done that on opening and
  asks nothing, so the footer is not drawn.
- **Progress** is written about every 30 seconds while playing (never more often) and immediately on pause,
  ended, seek settle and close. Each playback numbers its writes from 1 and a lower number can
  never replace a higher one.
- **Fullscreen** is the stage; `F` toggles it.
- A local file plays through the fileserver's Range route; a title with a stream address (in development,
  the test server) plays from it. Neither is converted or relayed.
- **A provider's title plays in the provider's embedded player**, hosted in the stage in place of the
  `<video>` (owner, 2026-10-16). The stage hosts the iframe of `22` section 3.4a (the PoC's proven frame:
  allow list, referrer policy, the nested-frame guard, clean stop). Resume passes the watched seconds
  through the source's start parameter; progress comes from the source's documented messages, on the same
  cadence as the `<video>`'s; Retry re-creates the frame with a fresh address. When the title has two or
  more playable sources (its provider sources, and its stream address if any, listed last as `App player`),
  the stage toolbar gains a **Source** control (owner, 2026-10-17) that lists them and switches: picking one
  clean-stops the current frame and hosts the next. With no pick, the first source by preference order
  plays; when one source fails to start, the next in order is offered, not played unasked. A source without
  documented messages plays but reports no progress.

### 5.4 Details (right)

Two collapsible blocks (§2.8) of mono key and value facts, skeletons with no title open, and Resume pinned at
the foot while paused (§5.3). Each open block takes its share of the pane and scrolls inside itself rather than
squeezing its content (owner: opening the lower block must add a scrollbar, not shrink the art); the footer stays
on the pane's foot when the blocks close. Nothing is written twice: the title appears once, in Overview. A fact's
value sits at the row's right edge; the label column is sized to the longest label the inspector draws.

| Block | Contents |
|---|---|
| **Overview** | the art at the pane's full width, 16:9 (a poster is cropped from its top), with no words on it; the title, with the episode and its name, the year or `Local file` beneath; the year for a series, quality and rating; the plot |
| **Details** | a movie's runtime or a series' season count, then genres and cast as name chips. A local file has no catalogue entry, so its Details are the file's own facts: the year, its duration once it has been played, and the collections it is in as name chips |

The read-only Watch block is gone (owner, 2026-10-16). Favorite, Collections and Remove from History are the
stage's context menu; the episode marker in the browser shows progress.

There is no Clear History here: it belongs to Library.

### 5.5 Related (bottom)

A band across the full work area. It is Giga LoRA Studio's bottom rail, `components/generate/PastRuns.tsx`, copied
(`23` section 3.4): the same row, the same thumbnail frame, the same selected and hover render, the same skeleton.

| Part | Behaviour |
|---|---|
| Rail | one horizontal list of 4:3 thumbnails that fill the band's height, with no header, no fold, no caption and no tint; each is a button, reached with Tab (a list of buttons, not a listbox, since there is no selection to move with arrows); the open title's thumbnail wears the accent border and `aria-current`; the title is each thumbnail's tooltip and accessible name, and the list is labelled `Related titles` (in phase 2, with its basis: `TMDB`, or `Genre + year`, `Genre`, `Year` over the catalog, `11` section 4); at most 20 at first |
| Activation | replaces the current item with that title (the open one does nothing); a movie loads at once, a series opens on its resumable episode or waits for one to be chosen (§5.1) |
| Loading and empty | the rail's own skeleton (`ThumbnailRailSkeleton`) |
| Failure | the last thumbnails stay and one notice says why |
| Local file | the band shows the rail's skeleton; there is nothing related to a local file |

### 5.6 Opening something

| From | Result |
|---|---|
| a movie card's Play | the Player shows that movie in place, and the title's stream address is given to the player; Library is unchanged |
| a series card's Play or Open | the Player shows the series in place. Left partway, the browser shows that season with that episode selected and the episode is asked for; never watched, it shows the first season and **nothing loads** until an exact episode is chosen |
| a local card's Play | the Player shows the file in place and it plays through its Range route |
| a related card | as above, and the current item is replaced |
| **Reveal in Library** (the stage's context menu) | `requestLibrary({ select })`: Library is shown on All with the type strip, search and filters cleared (the sort kept), the item selected, focused and scrolled into view; Player stays loaded |

A failed load leaves the item in place with a failed stage and **Retry**; it does not bounce back to Library.

---

## 6. Windows

### 6.1 The frame

Settings, Collections and Title information are modal work windows drawn inside the app: a frameless panel with its own border,
a header holding its title and an `X` named `Close <title>` (never a commit action), eight resize grips, a
scrim over everything below the titlebar (the titlebar slice stays a drag strip), and a body of a workspace of
groups and rows, one column at the window's full width. Settings has a rail of its sections beside the
workspace (150px, 210px on a wide window); a Collections workspace has its own `NavRail`; the Collections index
and Title information have none. It opens centred at its content's size,
at most 80% of the window and never below 658 x 412, moves by its header, resizes by its edges, remembers
its place for the run, and is pulled back inside when the window shrinks. The body is the family `Form`: a group
has a 48px accent-tint icon tile, a 28px mono title, and folds from its heading and the chevron on its readout
edge; a row is a 14px semibold label in one column with its info glyph, then its control. The label column is
sized once per window from every label the window can show, so it does not move as the rail changes page.
Choices are `Segmented` pills and accent swatches. One commit sits at the end of the final group; there is no
footer or Cancel. Moving between a window's views (the Collections index and a workspace) keeps focus inside the
window, and a key arriving with focus on the page body returns focus to the frame, so Escape and Tab keep working.

### 6.2 Settings

| Section | Rows |
|---|---|
| Appearance | Theme (Dark / Light / System), Reduce motion (Follow system / Off / On), Accent (Amber, Blue, Green, Violet, Rose), UI zoom (0.5 to 3, a stepper; `Ctrl+0` resets), and **Restore defaults** at the end of the group |
| Playback | **Playback** group: Autoplay, Resume (Ask / Always resume / Always start over; read by the Player's Resume footer), Mark as watched (at 90%, at 95%, at the end). **Live** group: On open (Last channel / Nothing; read when Live opens). The stream preferences (quality, fit, audio and caption languages, latency) have one home, Live's playback rail (§3.3), and Fit applies to the Player's stage too |
| Library | **Library** group: Default view (Grid / List / Rows), Default sort, Continue watching (on/off), Pause history (on/off), History (**Open History**, and **Clear history** as an `ArmedButton`), Collections (**Manage collections** opens that window). **Folders** group: Rescan on startup. Library reads Default view, Default sort and Continue watching at once (§4.2, §4.3) |
| Admin backend | Address (the `adminUrl` setting, saved through the fileserver on Enter or when the field is left), State (connection, the backend's revision, when the channels were last read, the last error) as read-only facts, a dash with `The fileserver is not connected.` as the tooltip until phase 2 |
| About | Version and build and runtime mode (dashes until the fileserver supplies them), Licences (**View licences**, enabled, asks the fileserver for the bundled licence texts: phase 1 the `readLicences` stub), and the **Attribution** group with the TMDB notice (`11` section 6) |

**Open History** is `requestLibrary({ source: "history" })`: it closes Settings and shows Library on its History
view, whatever view was set before.

The preferences (theme, motion, accent, zoom, playback, library) are the store's and apply at once; they do not
call `saveSetting` on every change in phase 1, since a refusal on every click would drown the notice line. Phase 2
saves them through the fileserver (`22`). Only the admin address saves on commit now.

There is no credential, admin CRUD or login field, and no provider section: providers are the backend's.

### 6.3 Collections

The family's index and workspace flow (owner, 2026-10-16), as Sensenova's dataset index and workspace
(`pages/datasets/DatasetsIndex.tsx`, `DatasetWorkspace.tsx`). Section headers carry no buttons (owner). The
window opens on the index from **Manage collections**, and on one collection's workspace from that collection's
`Rename…` or `Remove…` in Library's rail menu.

- **Index, no rail.** The **New collection** group: Name, Type (Movies / TV / Local, `Segmented`), an optional
  **Folder** to start from (**Choose** through the native dialog), and **Create**, the one accent, disabled only
  while the name is blank. Then the **Collections** group: Sensenova's datasets grid, a header row in the folders
  table's style (`DataTable`: sans 12px semibold, faint, on the panel over a hairline) with the columns `name`,
  `type`, `videos`, `folders`, then one row per collection. A press on the row opens its workspace; **Remove**
  beside it is an `ArmedButton` (`Remove Films?`, the original files untouched). While a scan runs, the videos
  cell is the rail's shimmer pill with the partial count as its tooltip, so the index and the rail say
  "scanning" the same way and no scan column is spent (owner: a scan column was a waste of space). Columns are
  rem tracks, so the 12px header and the 14px rows line up. Sensenova's tick column is left out (it picks a
  context for a forward verb, and this window has none).
- **Workspace, with a rail.** Sensenova's rail: the way back as one full-width stock button, `← Collections`,
  then the sections **Details**, **Folders** and **Videos**; a press scrolls the page there and the rail follows
  the scroll. Details holds Name and Type and **Save details**. Folders is a table (`folder`, `indexed`, `scan`
  as a coloured word, `last scan` as a short date such as `Sep 21, 10:42 PM` with the full stamp as its tooltip,
  then the icon actions **Replace**, **Rescan** (disabled while that folder scans), **Cancel scan** (only while
  scanning) and **Remove**, `01` section 9's icon-row two-step), with **Attach folder** as a ghost action under
  it. Videos is the member table (picture, `title or file`, `year`, remove). Removing the collection lives on
  the index, beside its row, never in the workspace.

A token that expires keeps the draft and asks to choose again.

A folder is never more than one press away (owner, 2026-10-16: the button sat under two groups on a view you
had to find first): **Attach folder…** is also the first row of a collection's context menu in Library's rail.

---

## 7. Events drawer

A 160px band above the statusbar, opened and closed by the statusbar's **Events**; it slides (100 ms, the pane
collapse's duration; instant under Reduce motion), stays mounted so the log keeps appending while closed, and is `inert` while closed. A header
with `Events`, the row count, and **Clear** (disabled, `The log is empty.`, when there are no rows). The body is a
`log` region of mono rows: time, the tone as a coloured word (`info`, `warn`, `error`; never a dot or an icon
alone), an area (Connection, Catalog, Scan, Media, Playback), the normalized sentence and an optional short
identity. The newest row is at the foot and kept in view. Every warn or error notice is appended as a row; the
log holds at most 200 rows, shows no secret, path, token or stack trace, and **Clear** empties only the list.
With no rows the body is shimmer lines. There is no severity filter or close control: the drawer is closed by the
door that opened it, or Escape.

---

## 8. Keys

| Key | Does |
|---|---|
| `Ctrl+1` / `Ctrl+2` / `Ctrl+3` | Live / Library / Player |
| `Ctrl+,` | open Settings |
| `Ctrl+0` | reset zoom |
| `Ctrl+F` | focus the active surface's search |
| `Escape` | the order in `04` §5 |
| Up, Down, Home, End | move the channel selection |
| Arrows, Home, End | move the selection across Library's cards (and between shelves in Rows); they only select |
| `Enter` | on a channel, plays it; on a Library card, selects it and opens Info, exactly as a press does |
| Space, Left, Right, `M`, `F` | the player's play and pause, seek, mute and fullscreen, when it has focus |

Global keys yield to text fields, selects, menus, popups and IME composition.

---

## 9. Building blocks

The ui layer is Giga LoRA Studio's, copied verbatim (`23` section 3.1): `ContextMenu` (the one context menu, summoned
by `openMenu`, with one level of submenu; a row's action runs after the menu closes), `Button`, `IconButton`,
`Segmented`, `Field` (`Input`, `Select`, `Textarea`), `Toggle`, `Section` (a collapsible rail group), `NumberField`
(the rail row), `Form` (`Workspace`, `Group`, `Row`, `Wide`, `Actions`: a window's page), `NavRail` (`NavGroup`,
`NavItem`; Sensenova's build of it), `Tooltip` (`InfoTip`), `SkeletonRows`, `SkeletonCards`, and the rest of that
list. LoRA's `StatusDot` is not used: dots are not a state signal here. Giga Stream keeps its own `DataTable`,
`Swatches`, `PosterImage` (with a `compact` mode for list thumbnails), `LogoImage`, `ArmedButton` (the one inline
two-step) and `NAME_CHIP` (`components/ui/name-chip.ts`, the read-only name chip). Each exists once; a surface uses
these and does not build its own, and sets no arbitrary text size of its own (the `type-scale` rule).

---

## 10. What each surface does not have

**Shell:** an account, login, credits or admin CRUD; media transport or search in the titlebar; a fourth
primary tab; two ways to switch surface.

**Live:** a generation prompt, a model control, a queue of jobs; a placeholder Add button; prose in place
of a skeleton; a box drawn over the player; a Player tab for a channel; an automatic proxy of any address;
a channel context menu; a saved copy of the channel list.

**Library:** a free-text Genre or Year; a separate Add Folder or Manage button beside the one **Manage
collections**; a Latest scope or an invented Trending sort; text-only poster cards; an external viewer
window; editing or timeline controls.

**Player:** a start prompt with no control; a transport that does nothing; a floating or external player; a
whole series presented as an episode; provider administration or a credential in the interface (the stage's
Source control of 5.3 is the one exception); related titles as text rows.

**Windows:** a centred modal card, a backdrop of a feature's own, a focus trap, a footer Cancel button, a
commit action in a toolbar, a raw path or credential.

**Everywhere:** an empty-state sentence; a sentence under a control; a control that does nothing; a dot for
state; a danger-red control at rest.
