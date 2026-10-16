# 02 - Frontend Specification

**Status: governing interface specification.** It defines the window, the three surfaces, state,
and how the interface talks to the fileserver. The rules every file follows are in `01`; the
fileserver's routes and frames are in `03`.

## 1. The window

```text
+-----------------------------------------------------------------------+
| Titlebar (40px)                                                       |
+-----------------------------------------------------------------------+
| Active surface: Live, Library or Player                               |
+-----------------------------------------------------------------------+
| Events drawer (optional, 160px)                                       |
+-----------------------------------------------------------------------+
| Statusbar (24px)                                                      |
+-----------------------------------------------------------------------+
```

The minimum window is 900 x 640 CSS pixels; the design is verified at 1600 x 1000. The desktop app
opens at 1440 x 900, or the primary display's work area if that is smaller (the minimum is clamped the
same way, since a high-DPI display can have a small desktop in device-independent pixels). The window's
size, position and maximized state are not remembered between launches. The titlebar and statusbar never
scroll. The three surfaces stay mounted; the inactive ones are hidden, so selection,
scroll and playback survive a switch.

### 1.1 Titlebar

| Position | Control |
|---|---|
| Left | the left-pane toggle for the active surface (pressed while the pane is shown) |
| Left | the brand: a small accent icon tile, the name in spaced capitals, a mono subtitle |
| Centre | the **Live / Library / Player** switch: a recessed rounded track with a sliding chip, the only navigation between surfaces |
| Right | the bottom-pane toggle, then the right-pane toggle (a surface without that pane keeps the toggle in place, disabled) |
| Right edge | minimize, maximize or restore, close, drawn in the platform's own caption metrics |

There is no account, search field, Settings gear or media control in the titlebar.

### 1.2 Statusbar

| Element | Behaviour |
|---|---|
| Connection | a status dot and a lowercase mono word: `connecting`, `ready`, `reconnecting` |
| Notice | exactly one latest sentence, an outcome or a refusal |
| Events | opens and closes the events drawer; highlighted while open |
| Settings | opens and closes the Settings window; highlighted while open |

### 1.3 Panes

Widths are CSS pixels at zoom 1. A pane restores its *preferred* size after a collapse. Centre stages
absorb the remaining space and never collapse.

| Pane | Axis | Min | Preferred | Max |
|---|---|---:|---:|---:|
| Live: settings (left) | width | 240 | 288 | 400 |
| Live: stage (centre) | width | 480 | flex | - |
| Live: channels (right) | width | 260 | 320 | 440 |
| Library: collections (left) | width | 248 | 288 | 420 |
| Library: body (centre) | width | 520 | flex | - |
| Library: filters (right) | width | 260 | 300 | 420 |
| Player: browser (left) | width | 240 | 288 | 420 |
| Player: stage (centre) | width | 520 | flex | - |
| Player: inspector (right) | width | 288 | 344 | 480 |
| Player: related (bottom) | height | 148 | 188 | 280 |

Allotment owns the sashes and the sizes. Collapsing commits the new visibility at once, then a short
tween paints the travel by writing each frame into Allotment, so the pane visibly slides out and the
centre follows. Reduced motion makes it instant.

## 2. State

### 2.1 The store

One Zustand store, composed of slices:

| Slice | Holds |
|---|---|
| shell | active surface, pane visibility and sizes, the events drawer, the open window or popup and its anchor, window bounds for the run, folded groups, theme, accent, motion, the notice |
| live | the channel list as received, the rows on show, search and category, the selected and the playing channel, the stage state, the connection |
| playback | what the player reports (levels, tracks, size, latency) and the user's playback choices |

The store performs no I/O and holds no promise, timer, DOM node or media element.

### 2.2 Services

- `services/api.ts` is the only `fetch`: relative URLs, the envelope decoded and validated, aborts
  supported, a refusal turned into an error carrying the server's code and sentence.
- `services/events.ts` is the only WebSocket: it dials `/ws`, validates each frame, reports a frame of
  a known type it cannot read, ignores a frame of an unknown type, and reconnects with exponential
  backoff (250 ms doubling, capped at 10 s, jittered).
- Resource modules (`channels`, `shell-state`) hold one call each.

### 2.3 Hydration

1. The interface mounts invisible; the panes need their boxes measured.
2. The first `hello` frame arrives. It carries the saved shell, the settings, the backend's state and
   the channel list. Its parts are validated separately: a channel list that cannot be read becomes
   "no list" and one notice, and never costs the saved shell.
3. The saved shell is applied once: the active surface, pane visibility and sizes (a size is clamped to
   its pane's limits). The events drawer is never restored.
4. The panes snap to the restored state without a tween, then the interface becomes visible two
   animation frames later, once the panes have settled.
5. If no hello arrives within 1.5 seconds the interface is shown with its defaults. Nothing is written
   back until the saved shell has been restored, so the defaults can never replace what was saved; the
   hello still restores the saved shell whenever it arrives.
6. Later changes to the surface, pane visibility or pane sizes are written back with
   `PATCH /api/shell-state`, 400 ms after the last change.
7. A reconnect's hello does not re-apply the saved shell; it would undo what changed since.

The interface never reads or writes browser storage.

## 3. Live

```text
+----------------------+--------------------------------+----------------------+
| Playback settings    | Player                         | Channels             |
+----------------------+--------------------------------+----------------------+
```

### 3.1 The player

- A `<video>` fills the stage, with the picture fitted whole inside it by default. It is always there,
  and nothing is drawn over it while a channel loads.
- It plays with the browser's own controls.
- Choosing a channel hands the channel's `streamUrl` to the player. The player loads that address
  directly; nothing resolves or proxies it. hls.js drives playback whenever the browser can run it; the
  browser's own HLS is only a fallback, since it exposes no levels or tracks.
- The stage counts as ready once the first frame is there. If the browser will not start the stream
  unasked, the loaded player stays paused with its own Play control.
- A stream that fails shows a centred note over the player's picture area, clear of its control bar: an
  icon, a title, the reason in one sentence and a Retry that loads the same address again. The same
  note, with a Refresh action, appears when the channel list is empty.
- A stream that is playing keeps playing even if the list under it is cleared.

### 3.2 The channels pane

- A heading row: `Channels`, the total, and a Refresh icon. Refresh calls `POST /api/channels/refresh`:
  the fileserver reads the channels again and re-probes every stream, and the answer replaces the list.
- A search field and a category select under it. Search asks `GET /api/channels` after a 250 ms pause;
  a newer keystroke abandons the older request; a failed request keeps the last rows and says why.
- Rows, each with: a 56px 4:3 logo with a glyph fallback, the number, the name on one line, the
  category with a status dot before it (live, offline or not yet probed), and a marker on the channel
  that is playing. Selected is a bar on the row's left edge; selected and playing are different.
- A click or Enter plays the channel and remembers it as the last channel
  (`PATCH /api/channels/last`). The arrow keys, Home and End only move the selection.
- A list that is loading, empty, or whose backend cannot be reached is skeleton rows (at least 14),
  never stale channels and never a sentence.
- Live opens on the last channel you chose if it is still listed, otherwise the first.
- At the foot, a collapsible Details section: the selected channel's name, category, number and
  revision, a dash where nothing is selected.

### 3.3 The playback settings pane

Five collapsible sections, each a header with a triangle that folds the body; the whole header row
folds it:

| Section | Rows |
|---|---|
| Video | quality, resolution, bitrate |
| Display | fit (Fit, Fill, Original), aspect |
| Audio | track, language |
| Captions | captions |
| Playback | latency (Normal, Low), live edge |

Each row is a mono label beside its control. A row that cannot be used is disabled in place, and its
reason is its tooltip; no text is printed under any control. Fit, Fill and Original is always usable and
changes how the picture sits in the stage without touching the stream. Volume, mute and fullscreen are on
the player, not here.

## 4. Library and Player

**Library** is where titles and the user's own video files are browsed, with collections, favorites and
watch history. **Player** is where a title or a local file plays. Their panes and sizes are in 1.3; their
contents are in `06`.

## 5. Windows and popups

Settings opens as a modal work window drawn inside the app, from the statusbar or `Ctrl+,`; Collections
opens the same way from the Library rail's `Manage collections` button. A work window has a header with
its title and an `X` that closes it, a scrim over everything below the titlebar, and a form of groups and
rows. It is movable by its header and resizable by its edges, opens centred at its content's size (never
more than 80% of the window, never below 658 x 412), and returns focus to its opener when it closes.
Escape closes it. Only one window or popup is open at a time.

An information explanation is a tooltip on an info glyph, shown on hover and focus, placed against the
window so it is never clipped by a pane.

## 6. Keyboard and motion

| Key | Does |
|---|---|
| `Ctrl+1` / `Ctrl+2` / `Ctrl+3` | Live / Library / Player |
| `Ctrl+,` | open Settings |
| `Escape` | closes the open window or popup first; otherwise the events drawer |
| Up, Down, Home, End | move the selection in the channel list |

Global keys yield to text fields, selects and open popups.

Motion: a pane collapse travels 100 ms, a folding group 110 ms, window and popup entrances 200 ms,
everything else 140 ms. The reduce-motion setting (follow system, off, on) makes every one of them
instant.

## 7. Loading, empty and failure

- Loading and empty regions are skeletons in the shape of their content, never text.
- A recoverable failure keeps the last good content and says one sentence in the statusbar.
- A frame the interface cannot read is one statusbar notice.
- With the backend unreachable, the channel and title regions are skeletons and the player stays;
  local data and the shell stay usable.
