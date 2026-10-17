# 00 - Requirements

**Status: governing product specification.** This document says what Giga Stream is and what it
must do. Documents written after it add detail and never contradict it.

## 1. What Giga Stream is

Giga Stream is a desktop application for watching live channels, browsing and playing titles, and
playing video files from your own computer. It runs as an Electron app. The same interface also runs
in an ordinary browser, which is how it is tested.

It is non-commercial: no accounts, no sign-in, no billing and no ads of its own. A provider's embedded
player can show the provider's ads (`14` check 14).

## 2. The programs

```text
 Interface (the screen you use)
   |  talks only to the fileserver
   v
 Fileserver (on your computer)
   |  passes the backend's data through, live
   v
 Admin backend (a server)

 The video player in the interface loads the stream address it is given.
 The admin backend streams channels of real video files as live HLS: the test channels in development, or your own videos.
```

- **The interface** shows things and plays video. It never talks to the admin backend.
- **The fileserver** holds everything that belongs to your computer: your local video files, your
  settings, your layout, your favorites, your watch history and your collections. It passes the admin
  backend's channels, titles and providers through to the interface as they are, live. It keeps
  nothing from the backend except images.
- **The admin backend** owns channels, titles and providers, including each stream's address.
  Providers are its business alone: the fileserver and the interface do not know what a provider is.
- **The player** is given a stream address and loads it. Nothing converts, resolves or relays a
  channel or title first. A channel and a local file always play in the app's own player. **A title
  plays through its provider's embedded player** inside the Player stage, because the providers offer
  only embed pages (owner, 2026-10-16; `12` section 7). How that works is proved first by `14`.
- **The live engine** inside the admin backend runs channels of real video files as continuous live streams, each a
  looping playlist, managed through the backend's routes (`10`, `26`; there is no separate live server). The seeded test
  channels are live channels of the backend; it can as well run a channel of your own videos around the clock.

## 3. The three surfaces

The window has three tabs.

- **Live.** The channels on the right, the player in the centre and the playback settings on the
  left.
- **Library.** Titles and your own video files to browse, with collections, favorites and watch
  history.
- **Player.** Where a title or a local file plays.

## 4. How it behaves

1. The interface opens on the tab you left it on, with your layout (pane sizes and which panes are
   open) as you left it. Live opens on the last channel you chose.
2. The player on Live is always on the stage. Nothing is drawn over it while a channel loads.
3. Channels and titles are read live. Nothing from the backend is saved except images. If the backend
   cannot be reached, those lists are empty and show skeletons, and your own data stays usable.
4. A Refresh control re-reads the channel list and refreshes every channel's stream and status.
5. A region that is waiting or empty shows skeletons in the shape of its content. No sentence is
   pasted over a skeleton.
6. No explanatory text is printed under a control. A control that cannot be used shows why as a
   tooltip.
7. A control either works or is visibly disabled. Nothing on screen does nothing.

## 5. What is not part of Giga Stream

- Accounts, sign-in, billing or ads.
- Provider code in the fileserver or the interface.
- A step that resolves a channel or title into a stream, and any relay or proxy of video.
- Saving a copy of the backend's channels, titles or providers.
- Any playback window outside the app.

## 6. The documents

| Document | Owns |
|---|---|
| `00-REQUIREMENTS.md` | what Giga Stream is and how it behaves |
| `01-ARCHITECTURE-AND-STYLE-GUIDE.md` | the programs, who owns what, the stack, and the rules every file follows |
| `02-FRONTEND-SPEC.md` | the window, the three surfaces, state and how the interface talks to the fileserver |
| `03-SERVER-SPEC.md` | the two servers: the fileserver's routes, socket and storage, then the admin backend's |
| `04-NAVIGATION-FLOW.md` | how you move between surfaces, windows and popups, and what survives a restart |
| `05-END-TO-END-FLOW.md` | the whole product walked through: first launch, a Live session, Library and Player, local folders, a second launch, and what goes wrong |
| `06-PAGES-AND-PANES.md` | what is inside every surface, pane, window and control |
| `07-WORKING-PROTOCOL.md` | how the work is done: roles, editing, running things, verification, delegation |
| `08-IMPLEMENTATION-PLAN.md` | the build phases, in order, and how each is accepted |
| `09-FFMPEG-BUILD.md` | the bundled FFmpeg: what is in it, rebuilding and verifying it |
| `10-LIVE-STREAM-SERVER.md` | the live engine (now inside the admin backend): channels of real videos as live HLS, its store and CRUD routes |
| `11-TMDB-API.md` | how title metadata comes from TMDB: the decisions, the terms and the API as observed |
| `12-PROVIDER-RESEARCH.md` | the provider API reference: VidSrc, VixSrc and VidZee, verified live |
| `13-GO-LIVE-PLAN.md` | the stages from seeded data to real channels and titles |
| `14-PROVIDER-POC.md` | the proof of concept that plays titles through the providers' embedded players |
