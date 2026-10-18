# 04-NAVIGATION-FLOW.md

Status: **2026-10-15.** The surface model, the window and popup flows, and every transition. What is
inside each surface is `06`'s.

---

## 1. The model

- **Three surfaces, always mounted** — Live, Library and Player. The titlebar's **Live / Library /
  Player** switch is the only navigation between them. Switching changes which surface is visible;
  nothing unmounts, so each keeps its selection, scroll, pane sizes and any playing media.
- **No router.** There are no URL segments, no page history and no Back command.
- **One flow at a time.** A modal work window (Settings, Collections) or an anchored popup is open or it
  is not; opening one replaces the open one. There is no stack and no history.
- **The events drawer is a utility,** not a flow. It sits above the statusbar and can be open beside
  anything.
- Authored modals, confirmation dialogs, centred cards, backdrops of a feature's own and focus traps are
  banned. A native OS dialog exists for one thing, choosing a folder. Floating UI is limited to menus,
  tooltips and popups anchored to their controls. Confirmations are inline two-steps.
- **Live is not a Player tab.** A channel plays in Live's own stage. Starting a title in Player and
  starting a channel in Live never play at once: starting one stops the other.

## 2. Surface table

| Task | Surface | Opened by | Closed by |
|---|---|---|---|
| Live · Library · Player | the surface stack | titlebar switch · `Ctrl+1` / `Ctrl+2` / `Ctrl+3` | switching to another |
| Settings | work window | statusbar **Settings** · `Ctrl+,` | its `X` · `Escape` · the statusbar button again |
| Collections | work window | Library rail footer **Manage collections** | its `X` · `Escape` |
| Title information | work window | a card's **Info**, or a Search titles row's **Info** (over the spotlight, `01` section 9's exception) | `Escape` · its `X` |
| Search titles | spotlight bar (`06` section 4.6) | the Library type strip's **Search titles** | `Escape` · an outside press · a row's **Play** · leaving Library |
| Add to collection | `Collections ▸` submenu of the one context menu | a card's menu, Title information's Collections button, the Player's Watch block | a click toggles membership · outside press · `Escape` |
| Events | drawer | statusbar **Events** | statusbar **Events** · `Escape` · its `X` |
| Choose a folder | native dialog | **Attach folder** in Collections | the OS dialog |

Destructive actions (removing a collection, clearing history) are two-steps on their own control, not
flows.

## 3. Transitions

| Trigger | Effect |
|---|---|
| Launch | the window opens invisible, then shows the **tab you left it on** with your pane layout, once the first `hello` has restored them (`02` §2.3); if the fileserver is slow the defaults show, and the saved tab and layout apply when it answers |
| Switch surface | the new surface shows; the old one keeps its state; playing media keeps playing |
| Choose a channel (click or `Enter`) | Live's player loads that channel's stream address at once; the channel is remembered as the last one |
| Arrow keys in the channel list | the selection moves; nothing starts |
| Refresh | the channel list is read again from the backend and every stream's status refreshed; the playing channel is not interrupted |
| Backend lost | after a short grace period the channel and title lists clear to skeletons; the player, the shell and local data are unaffected |
| Backend back | the lists fill again; nothing is replaced under the cursor except the rows |
| Play a title or a local file | the Player shows it in place, replacing the current item, and Player is shown; Library keeps its state |
| Open a window or popup | menus and other popups close; Player and Live fullscreen exit; pane toggles and the surface switch sleep under a window's scrim; playback continues |
| Close a window or popup | focus returns to the control that opened it, if it still exists |
| Collapse or reopen a pane | the pane slides; the new visibility is saved |

## 4. Navigation versus saved state

- Nothing is lost by navigating: the layout and the active tab are written back a moment after they
  change (`02` §2.3), and the last channel the moment you choose one.
- What survives a restart is only what the fileserver stores: the active surface, pane visibility and
  sizes, the last channel, settings, collections, favorites and watch history.
- What never survives: an open window or popup, the events drawer, a text draft, a selection, playback,
  and the channel and title lists, which are read live every time.
- A native folder dialog that is cancelled leaves the form as it was.

> Owner, 2026-10-15: *"the only thing we should cache from the backend is images. everything else is
> live. the refresh button should actually work and refresh the streams and statuses"*

## 5. The way back

- A window closes by its `X` and by `Escape`. A popup closes by an outside press, `Escape` or its `X`.
- `Escape` is owned in this order: an IME composition, a text field's uncommitted edit, the open window or
  popup, an open menu, an armed destructive action, a fullscreen player, the events drawer. Otherwise it
  does nothing.
- Player has no Escape-to-Library step; there is nowhere "back" to go. Switching surface is the only way
  across.
- No breadcrumbs.

## 6. Guards and honesty

- A control is disabled only when there is nothing for it to act on, with the reason as its tooltip.
  Nothing is gated on the backend being reachable: a control stays enabled and a press that fails says so
  once on the notice line.
- A verb in a window runs single-flight: its control is disabled while it works, and the outcome lands once
  on the statusbar's notice line. A result that arrives after its window closed is dropped.
- A request that fails says so once: the server's own sentence, or `could not reach the fileserver`.
- A frame from the fileserver that the interface cannot read says so once; it never leaves the interface
  quietly waiting.
- Opening a flow never discards committed work. An uncommitted field draft is discarded when another flow
  replaces its window, unless the field cannot safely revert, in which case it refuses with its own line.
