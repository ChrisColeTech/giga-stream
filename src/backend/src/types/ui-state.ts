import { z } from "zod";

import {
  ADMIN_TABS,
  PANE_WIDTH_MAX,
  PANE_WIDTH_MIN,
  UI_ZOOM_MAX,
  UI_ZOOM_MIN,
  WINDOW_COORDINATE_MAX,
} from "../constants/ui-state.js";

/** A zoom is a whole number of tenths: 1.2 is valid, 1.25 is not (docs/29 section 12.2). */
const isTenth = (value: number): boolean => Math.round(value * 10) / 10 === value;

const coordinate = (min: number) => z.number().int().min(min).max(WINDOW_COORDINATE_MAX);

export const AdminSettingsSchema = z
  .object({
    theme: z.enum(["dark", "light"]),
    themeAccent: z.enum(["amber", "blue", "green", "violet", "rose"]),
    reducedMotion: z.enum(["off", "on"]),
    uiZoom: z.number().min(UI_ZOOM_MIN).max(UI_ZOOM_MAX).refine(isTenth, "is not a step of 0.1"),
  })
  .strict();
export type AdminSettings = z.infer<typeof AdminSettingsSchema>;

const PaneSchema = z
  .object({ open: z.boolean(), width: z.number().int().min(PANE_WIDTH_MIN).max(PANE_WIDTH_MAX) })
  .strict();

const WindowBoxSchema = z
  .object({ x: coordinate(0), y: coordinate(0), width: coordinate(1), height: coordinate(1) })
  .strict();

export const AdminShellSchema = z
  .object({
    tab: z.enum(ADMIN_TABS),
    panes: z
      .object({
        channels: PaneSchema.optional(),
        providers: PaneSchema.optional(),
        titles: PaneSchema.optional(),
        playlists: PaneSchema.optional(),
        jobs: PaneSchema.optional(),
        accounts: PaneSchema.optional(),
      })
      .strict(),
    eventsOpen: z.boolean(),
    windows: z
      .object({ settings: WindowBoxSchema.optional(), preview: WindowBoxSchema.optional() })
      .strict(),
  })
  .strict();
export type AdminShell = z.infer<typeof AdminShellSchema>;

/** `PUT /api/admin/account-state`: each present document replaces the stored one whole; at least one is required. */
export const UiStatePutSchema = z
  .object({ settings: AdminSettingsSchema.optional(), shell: AdminShellSchema.optional() })
  .strict()
  .refine((body) => body.settings !== undefined || body.shell !== undefined, {
    message: "at least one of settings and shell is required",
  });
export type UiStatePut = z.infer<typeof UiStatePutSchema>;

/** What `GET` and `PUT /api/admin/account-state` answer (docs/29 section 5). */
export interface AccountState {
  settings: AdminSettings;
  shell: AdminShell;
  updatedAt?: number;
}
