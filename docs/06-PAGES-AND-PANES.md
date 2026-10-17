# 06 - Pages and panes

**Status: the surface specification — every pane, toolbar, control, window and state of the interface.
2026-10-15.**

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
| **Connection** | A status dot and a lowercase mono word: `connecting` while the first state read is in flight, `ready` after a request succeeded, `reconnecting` after one failed - the outcome of the last request (`03` section 4), not a live link. The sentence behind it is its tooltip |
| **Notice line** | One polite live region. Each sentence replaces the last. Tones are info, warn and error. It carries every outcome, refusal and unreadable-answer report |
| **Events** | An icon and the label "Events". Toggles the drawer; lit while it is open |
| **Settings** | An icon and the label "Settings". Toggles the Settings window; lit while it is open |

The fileserver's answers also land on the notice line: a refusal's sentence, and any part of an
answer the interface could not read.

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
- A closed pane's sash cannot be dragged open; only the toggle reopens it.
- A pane's size and visibility are saved a moment after they change and restored at launch.
- Below 1000px of work width the right pane collapses first, then the left; the centre never collapses.

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
8. **Rail sections are collapsible**: the family `Section`, a header with a chevron that turns and a title; the
   whole header row folds the body; the fold state is kept in the store by id and survives a surface switch.
9. **Destructive actions are an inline two-step**, never a dialog.

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

A `<video>` fills the stage, the picture fitted whole inside it by default, with the browser's own controls
(play, time, volume, fullscreen). A custom control bar is a later phase. It is always on the stage.

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
| `Channels` and the total | readout |
| **Refresh** icon (`Refresh channels`) | calls `POST /api/channels/refresh`; the whole list, every stream's status and the dots update from the answer; the notice line says `Channels refreshed.` or why not |

**When the dots move.** A stream's status and its dot are facts of the last read. They refresh when
the list is read — when Live opens, when **Refresh channels** is pressed, or when another action
re-reads the list — and they do not change on their own in between (`03` section 5.1). A channel that
goes offline mid-session keeps its `live` dot until the next read.

**Search and category**

| Control | Behaviour |
|---|---|
| Search field | always present; asks `GET /api/channels?q=` after a 250 ms pause; a newer keystroke abandons the older request; a clear control appears when it has text |
| Category select | the published categories with their counts, All first; a category chosen and since unpublished stays listed |

**Channel row**

| Element | Behaviour |
|---|---|
| Logo | a 56px 4:3 box: the logo, a shimmer while it loads, a glyph if it cannot be shown |
| Number | the channel number when it has one |
| Name | one line, ellipsised |
| Status dot | before the category: live (the done colour), offline (the failed colour), not yet probed (the queued grey); the word is there for assistive technology |
| Category | a compact subdued label |
| Playing | an accent `live` marker at the right of the second line on the channel the player has loaded |
| Selected | an accent bar on the row's left edge and a faint fill |
| Activation | a click or `Enter` plays the channel and remembers it |

- Up, Down, Home and End move the selection and focus (one tab stop on the list); they never start a
  channel. The row has no context menu: the interface has no channel verbs.
- Published order is kept unless a search or category narrows it.

**States.** Loading, empty, a search with no match, and a backend that cannot be reached all show the same
14 skeleton rows; the query and category stay visible. A failed search keeps the last rows and says why on
the notice line.

**Details** — a collapsible section at the foot: the selected channel's `name`, `category`, `number` and
`revision` as mono key and value, a dash where nothing is selected.

There is no footer, no star, no Manage Channels, no Recents and no Now Playing block. Channels are
published elsewhere.

### 3.3 Playback settings (left)

Five collapsible sections (§2.8). Each row is a mono label in a fixed column with its control beside it, and
every choice is a rail select, never chips.

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

Two collapsible sections (§2.8) of one row style, a flat list and not a tree.

| Section | Rows |
|---|---|
| **Views** | All, History, Favorites, in that order |
| **Collections** | every collection, alphabetical |

**Row**

| Element | Behaviour |
|---|---|
| Glyph | a distinct icon for All, History, Favorites and a collection |
| Name | one line, ellipsised |
| Count | appears once that view or collection has been queried; absent before, and never an indefinite skeleton |
| Scan dot | a small progress dot when any folder attached to the collection is being scanned |
| Selected | the accent bar on the row's left edge; selecting a row runs the library query |
| Context menu | on a collection: **Rename** and **Remove**. All, History and Favorites have none; managing History and Favorites is contextual to the body |

- **Footer.** One full-width **Manage collections** button with a folder-cog icon, in a strip under a
  hairline. It opens the Collections window at once; creating a collection is that window's first group. There
  is no separate New collection or Add Folder button.
- **States.** Loading is row skeletons (at least 5). If the list cannot be read, the last rows stay and one
  notice says why.
- Removing a collection is a two-step on its own context item, and states `Original files remain untouched.`

### 4.2 Body (centre)

**Type strip**

A row of four segments, `All · Movies · TV · Local`, in the shared strip surface. Segments have equal widths
and no changing count text. The strip is one row and holds no Search, Sort, View, selection count or batch
verb; those belong to the filters. Existing cards stay while a scope change resolves.

**Continue Watching**

A horizontal strip above the results, on every view except History, with at most 10 cards. Each card has the
poster, a label (a movie, or `Series - Sxx Exx`), a progress bar, a remaining or resume fact, and **Play**
and **Info**. The strip is drawn only when there is progress to show; with none it is absent, since an empty
band would read as a stray strip, and the grid's own skeletons stand for loading.

**Poster grid**

Cards are at least 144px wide at ratio 2:3, six to eight across at 1600px of body width; the grid is
virtualized when the result is large.

| Card element | Behaviour |
|---|---|
| Poster | the same-origin image, with its own fallback if it cannot be shown |
| Favorite | a small persistent mark; a press toggles it |
| Quality | a real value only; never an invented `HD` |
| Progress | a bar on the bottom edge of the poster for a title being watched |
| Watched | a check derived from the watch state |
| Play | an explicit button: a movie or local file plays; a series opens the episode browser |
| Info | an explicit button: opens the Title information work window without stopping playback |
| Title | two lines at most |
| Year | one subdued line |

- A plain press selects; `Enter` on a selected card opens Info. Play and Info are reachable on keyboard
  focus and never exist only on hover.
- Context menu: Play or Open, Info, Favorite or Unfavorite, and `Collections ▸`: a submenu listing every collection with a check mark for its membership. A click toggles membership inline, with no dialog (family standard, Giga Images' `docs/frontend/00`, "Context menu actions").
- Arrow keys move the selection across the cards and scroll it into view.

**List view**

One row per title: thumbnail, title, kind, year, genres, quality, progress, Favorite, Play and Info. The same
commands as the card. Grid, List and Rows only change presentation, never the query or the selection.

**Rows** (a third presentation, owner decision 2026-10-16). The library is a set of shelves, one per group. Each shelf is a
heading and a horizontal row of the same cards as the grid. Shelves appear in this fixed order, each only when it has items:

1. Continue Watching (the strip of §4.2).
2. Favorites.
3. Each collection, alphabetical, as the collections rail lists them.
4. Movies, TV and Local files, by kind.
5. Genres: each genre the facets report with at least three items, most items first, at most six.

A shelf's heading shows its count. Its right end holds **See all**, which switches to the grid with that group applied:
a genre sets the Genre filter; a kind sets the type strip; a collection opens that collection; Favorites opens the
Favorites view. A row scrolls sideways, with chevron buttons at its edges that show while the pointer is over it.
Left and Right move across a row's cards, Up and Down move between rows, and Home and End go to the first and last
card of a row. Selection is single, as in the grid. A shelf whose data is loading shows skeleton cards in its row.
Trending is not a shelf: it is offered only with a real popularity signal (§4.3). Rows offers no tile-size control.

**History**

Rows are watch entries and keep their watch id. A row's context menu adds **Remove from History**. A strip
below the type strip holds **Clear history**, a two-step: the first press arms `Clear all history`, a second
within four seconds clears it. Neither removes favorites, collections or media. The type strip stays
`All · Movies · TV · Local` on every view.

**States**

| Situation | What shows |
|---|---|
| Loading, or nothing found | 12 card skeletons (10 row skeletons in the list) |
| Paging | trailing skeletons, with the cards already shown kept |
| The query fails | the old cards stay, one notice says why, and a retry repeats the exact query |
| An image fails | only that image shows its fallback; the query is not failed |
| The backend cannot be reached | the title cards are skeletons; local files, collections, favorites and history stay usable |

### 4.3 Filters (right)

Two collapsible sections; each setting stacks its label over a 36px control.

| Section | Filter | Control |
|---|---|---|
| Search and view | Search | a field with a search icon and a clear control; combines with the type strip and every filter |
| Search and view | View | Grid / List / Rows, segmented; Grid is the default |
| Search and view | Sort | a select: Newest (the default), Oldest, A to Z, Year, and Trending only when the backend supplies a real current popularity signal |
| Filter | Genre | a populated multi-choice popover of chips, with a search box when there are 12 or more |
| Filter | Year | a populated select |
| Filter | Watched | a select: All, Unwatched, Watching, Watched |
| Filter | Clear filters | clears every filter but keeps the search |

- Genre and Year are populated choices and never free text, with no counts. A selected value stays
  listed until it is removed, so no choice disappears.
- A filter change keeps the previous cards while the next result loads; superseded requests are abandoned.
- There is no tile-size slider.

### 4.4 Title information (a work window)

Opened by a card's Info as a modal work window (`02` section 5): drawn inside the main window over a scrim, centred at its content's size, moved by its header, resized by its edges, closed by its `X` or `Escape`, and focus returns to the Info button.
Favourite and Collections apply at once, so there is no footer and nothing to cancel.

| Region | Content |
|---|---|
| Header | `Title information` and a trailing `X` named `Close Title information` |
| Artwork | a 180px-wide poster, or its fallback |
| Identity | title, year, kind, quality, rating, genres |
| Information | the full plot, cast chips, the runtime or the season and episode counts |
| Watch | progress, watched state or last episode, when there is one |
| Action strip | **Favorite**, **Collections**, flexible space, **Play** (**Open in Player** for a series) |

- The body is a readable two-column layout (the poster beside the information) and stacks on a narrow work
  area. Only the body scrolls; the header and the action strip stay fixed.
- Favorite applies immediately, and so does a collection toggled from **Collections**. `Escape` or `X` closes it and keeps
  what was applied. Focus returns to the opener only if it still exists and no newer target owns focus.
- It holds no video, filmstrip, episode browser, source picker or transport. Only **Play** hands off to
  Player; current Live or Player playback and Library's panes stay usable.

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
| Opening | a title or file opens in place, replacing the current one. The current item's final progress write settles first |
| Reopening | opening the item that is already playing does nothing but show Player |
| Episodes | choosing another episode of the same series loads it in place; the season select starts nothing |
| Closing | **Close** in the stage's context menu empties the Player back to its idle state, after the final progress write settles or a short timeout expires |
| Context menu | the stage's own menu, on a right click on the picture: **Retry**, **Full screen**, **Reveal in Library**; **Favorite**, **Collections ▸**, **Remove from History** when a watch entry exists; **Close** |
| Not here | no tab strip, no tab limit, no channel: a channel plays in Live |

### 5.2 Episode browser (left)

**Series** — a season select (`Season 1`, `Season 2`; the title is Overview's), then episode rows.

| Row element | Behaviour |
|---|---|
| Still | a 16:9 image with a fallback |
| Number | `E1`, `E2`, and so on |
| Title | the episode's title |
| Duration or progress | when known |
| Watch marker | the exact episode's state |
| Activation | loads that exact season and episode in place |

Selected and playing are different states. Changing the season does not start anything. The list is
virtualized and shows 10 row skeletons while it loads.

**Movie** — a compact chapter: the title, its duration and quality when known, and a `Movie` identity. No
invented season rows.

**Local file** — its display name, duration, size, codec and dimensions when known, and the collections and
folder it belongs to. Never a path and never invented chapters.

### 5.3 Stage (centre)

There is no toolbar and no banner (owner, 2026-10-16: two toolbars on the canvas were redundant and repeated the
title). The `<video>` fills the stage on the canvas's dark surface, exactly as on Live (§3.1); the browser's own
controls appear once media has loaded, since with no source they draw a grey layer over the picture. Loading shows
the player alone, a stream that fails shows a centred note with the reason and **Retry**, and the picture is fitted
whole by default. The stage's verbs are its context menu (§5.1).

- **Resume.** When the title was left partway, **Resume** and **Start over** are pinned at the foot of the
  details pane while the video is paused, and hidden while it plays; autoplay may choose Resume itself only
  when that setting is on.
- **Progress** is written about every 30 seconds while playing (never more often) and immediately on pause,
  ended, seek settle and close. Each playback numbers its writes from 1 and a lower number can
  never replace a higher one.
- **Fullscreen** is the stage; `F` toggles it.
- A local file plays through the fileserver's Range route; a title with a stream address (in development,
  the test server) plays from it. Neither is converted or relayed.
- **A provider's title plays in the provider's embedded player**, hosted in the stage in place of the
  `<video>` (owner, 2026-10-16). What the stage shows around it, how Resume, progress, Fullscreen and Retry
  work through the provider's documented parameters and messages, and how the next provider is tried when
  one fails, are written here from the results of `14` before phase 9 of `08` builds it.

### 5.4 Details (right)

Two collapsible blocks (§2.8) of mono key and value facts, skeletons with no title open, and Resume pinned at
the foot while paused (§5.3). Nothing is written twice: the title appears once, in Overview.

| Block | Contents |
|---|---|
| **Overview** | the art at the pane's full width, 16:9 (a poster is cropped from its top), with no words on it; the title, with the episode, year or `Local file` beneath; the year for a series, quality and rating; the plot |
| **Details** | runtime or the season count, genres and cast chips, a local file's duration, dimensions and codec; revision facts in a tooltip, not as noise |

The read-only Watch block is gone (owner, 2026-10-16). Favorite, Collections and Remove from History are the
stage's context menu; the episode marker in the browser shows progress.

There is no Clear History here: it belongs to Library.

### 5.5 Related (bottom)

A band across the full work area. It is Giga LoRA Studio's bottom rail, `components/generate/PastRuns.tsx`, copied
(`23` section 3.4): the same row, the same thumbnail frame, the same selected and hover render, the same skeleton.

| Part | Behaviour |
|---|---|
| Rail | one horizontal row of 4:3 thumbnails that fill the band's height, with no header, no fold, no caption and no tint; the title is each thumbnail's tooltip and accessible name, and the basis (`TMDB`, or `Genre + year`, `Genre`, `Year` over the catalog, `11` section 4) is the rail's accessible label; at most 20 at first |
| Activation | replaces the current item with that title; a movie loads at once, a series waits for an episode to be chosen |
| Loading and empty | the rail's own skeleton (`ThumbnailRailSkeleton`) |
| Failure | the last thumbnails stay and one notice says why |
| Local file | the band shows the rail's skeleton; there is nothing related to a local file |

### 5.6 Opening something

| From | Result |
|---|---|
| a movie card's Play | the Player shows that movie in place, and the title's stream address is given to the player; Library is unchanged |
| a series card's Play or Open | the Player shows the series in place, the episode browser shows the last or resumable season with that episode focused, and **nothing loads** until an exact episode is chosen |
| a local card's Play | the Player shows the file in place and it plays through its Range route |
| a related card | as above, and the current item is replaced |
| **Reveal in Library** (the stage's context menu) | Library is shown with the item selected, in the current collection if it holds the item, otherwise History, All or a collection that does, and scrolled into view; Player stays loaded |

A failed load leaves the item in place with a failed stage and **Retry**; it does not bounce back to Library.

---

## 6. Windows

### 6.1 The frame

Settings, Collections and Title information are modal work windows drawn inside the app: a frameless panel with its own border,
a header holding its title and an `X` named `Close <title>` (never a commit action), eight resize grips, a
scrim over everything below the titlebar (the titlebar slice stays a drag strip), and a body of a 150px icon
rail and a workspace of groups and rows (one column, at most 760px). It opens centred at its content's size,
at most 80% of the window and never below 658 x 412, moves by its header, resizes by its edges, remembers
its place for the run, and is pulled back inside when the window shrinks. A group has a 32px accent-tint icon
tile, a 16px mono title, an info glyph and a filled triangle that folds it. A row is a label in a 252px
column with its info glyph and a 24px control; the label stacks above the control under about 420px. Choices
are 22px pills and accent swatches 20px. One commit sits at the end of the final group; there is no footer or
Cancel.

### 6.2 Settings

| Section | Rows |
|---|---|
| Appearance | Theme (Dark / Light / System), Reduce motion (Follow system / Off / On), Accent (Amber, Blue, Green, Violet, Rose), UI zoom (0.5 to 3, `Ctrl+0` resets) |
| Playback | Autoplay. The stream preferences (quality, fit, audio and caption languages, latency) have one home, Live's playback rail (§3.3) |
| Library | Default view (Grid / List), **Collections** (opens that window), **Open History** (closes Settings and selects History) |
| Admin backend | Address (the `adminUrl` setting, saved like any other row), State (connected or not, the backend's revision, when the channels were last read, the error if any) |
| About | Version and build, runtime mode, links through safe external navigation, licenses, the TMDB logo and notice (`11` section 6) |

There is no credential, admin CRUD or login field, and no provider section: providers are the backend's. A
row with nothing wired yet is disabled in place and its reason is its tooltip.

### 6.3 Collections

The family's index and workspace flow (owner, 2026-10-16), as Giga LoRA Studio's Datasets and Dataset pages:

- **Index, no rail.** The form on top: **New collection** (a name, an optional **Folder** to start from through
  the native dialog, **Create**), or **Edit collection** when a tile's pencil fills it (the name, **Cancel**,
  **Save**). Then the **Collections** group: its first row is search, sort (by name, most items, most folders)
  and Grid / List; then a tile per collection (its glyph with the counts on it, the name, the folders and scan
  state), whose pencil edits it in the form and whose trash is the inline **Remove** / **Keep**
  (`Original files remain untouched.`). A tile opens that collection's workspace.
- **Workspace, with a rail.** The rail is `← Collections`, the name with its totals, and the sections (Folders,
  Members) with their counts; a press jumps there and the rail follows the scroll. The page holds the attached
  folders (name, indexed count, scan state, last scan; **Replace**, **Rescan**, **Cancel scan**, **Remove**)
  with **Attach folder** through the native dialog, then the member table (image, title, year, remove).
  Renaming and removing the collection live on the index.

A token that expires keeps the draft and asks to choose again.

A folder is never more than one press away (owner, 2026-10-16: the button sat under two groups on a view you
had to find first): **Attach folder…** is also the first row of a collection's context menu in Library's rail.

---

## 7. Events drawer

A 160px band above the statusbar. A header with `Events`, the row count, a severity filter, **Clear** and
close; rows of time, a tone icon, an area (Connection, Catalog, Scan, Media, Playback), the normalized sentence
and an optional short identity. It holds at most 200 rows, shows no secret, path, token or stack trace, and
**Clear** empties only the list.

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
| Space, Left, Right, `M`, `F` | the player's play and pause, seek, mute and fullscreen, when it has focus |

Global keys yield to text fields, selects, menus, popups and IME composition.

---

## 9. Building blocks

The ui layer is Giga LoRA Studio's, copied verbatim (`23` section 3.1): `ContextMenu` (the one context menu, summoned
by `openMenu`, with one level of submenu), `Button`, `IconButton`, `Segmented`, `Field` (`Input`, `Select`,
`Textarea`), `Toggle`, `StatusDot`, `Section` (a collapsible rail group), `NumberField` (the rail row), `Form`
(`Workspace`, `Group`, `Row`, `Wide`, `Actions`: a window's page), `NavRail` (`NavGroup`, `NavItem`), `Tooltip`
(`InfoTip`), `SkeletonRows`, `SkeletonCards`, and the rest of that list. Giga Stream keeps its own `DataTable`,
`Swatches`, `PosterImage` and `LogoImage`. Each exists once; a surface uses these and does not build its own, and sets
no arbitrary text size of its own (the `type-scale` rule).

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
whole series presented as an episode; a source or provider control; related titles as text rows.

**Windows:** a centred modal card, a backdrop of a feature's own, a focus trap, a footer Cancel button, a
commit action in a toolbar, a raw path or credential.

**Everywhere:** an empty-state sentence; a sentence under a control; a control that does nothing.
