# 60 - Child-window titlebar controls use the family ghost style (plan v1)

**Status: v1 (2026-10-19).** Owner: "child window title bar buttons are using raised buttons, and not the correct style
of buttons like the collapse buttons in the main windows title bar. can we standardize that in the ui kit and document
it." Scope: shared UI only. Landing (`07` 6.1): one kit worker; every app inherits it.

## 1. Why

- `ChildWindow.tsx` passes `bordered` to Maximize/Restore and Close, producing the raised gradient, edge and shadow.
- Main titlebar pane controls use the default ghost `IconButton`: transparent at rest, hover fill, accent only when a
  toggle is actually on. The same chrome displays two control systems.
- Every child window uses the shared template, so one kit fix covers Settings, all Previews, Collections and Title info.

## 2. Decisions

1. Child-window Maximize/Restore and Close use default ghost `IconButton`; remove `bordered`.
2. Buttons and icons match the main titlebar controls: `size-ctl-md` button, `size-3.75` icon, same hover/active/focus.
3. Maximize/Restore IS a state toggle: `on={maximized}` - Maximize is ghost while normal; Restore gains the active
   outline/accent while maximized, exactly like an open pane toggle. Close remains a plain ghost dismissal action.
4. Caption icons are `VscChromeMaximize`, `VscChromeRestore` and `VscChromeClose` from `react-icons/vsc` - the one
   sanctioned non-Lucide exception for window chrome. Generic Lucide Square/Copy/X and diagonal Maximize2/Minimize2
   are forbidden in window chrome.
5. Labels, tooltips, header ordering, drag exclusion, double-click maximize and keyboard behavior are unchanged.
6. Bordered IconButton remains available for popup headers/standalone body actions, never any titlebar.

## 3. Changes

- `src/shared/ui/src/windows/ChildWindow.tsx`: ghost titlebar controls/icon scale.
- Shared markup/maximize tests: controls have default IconButton classes and no raised border/gradient/shadow; ordering,
  labels, maximize/restore and close stay.
- No app file changes.

## 4. Tests And Acceptance

- Shared markup: no bordered classes on child titlebar buttons; exact labels/order/icon sizes; every existing child
  window gains the same style.
- Gate, then real Settings/channel/provider/title preview windows in frontend/admin, normal/maximized, dark/light.

## 5. Docs

`01` titlebar icon rule and `36` maximize section are amended by this change.
