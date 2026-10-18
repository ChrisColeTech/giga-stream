import { z } from "zod";

/* The signed-in account's saved appearance and layout (`29` sections 5 and 12.2): `GET /api/auth/me/state`. Strict on
 * the way out (the request), tolerant per part on the way in (the page applies what it can read). */
const TabId = z.enum(["channels", "providers", "titles", "playlists", "jobs", "accounts"]);

export const SettingsSchema = z.object({
  theme: z.enum(["dark", "light", "system"]),
  themeAccent: z.enum(["amber", "blue", "green", "violet", "rose"]),
  reducedMotion: z.enum(["system", "off", "on"]),
  uiZoom: z.number(),
});

const PaneState = z.object({ open: z.boolean(), width: z.number() });
const WindowBox = z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() });

export const ShellSchema = z.object({
  tab: TabId,
  panes: z.partialRecord(TabId, PaneState),
  eventsOpen: z.boolean(),
  windows: z.partialRecord(z.enum(["settings", "preview"]), WindowBox),
});

export const AccountStateSchema = z.object({
  settings: SettingsSchema,
  shell: ShellSchema,
  updatedAt: z.number().optional(),
});

export type AdminSettings = z.infer<typeof SettingsSchema>;
export type AdminShell = z.infer<typeof ShellSchema>;
export type AccountState = z.infer<typeof AccountStateSchema>;
