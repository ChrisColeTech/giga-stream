import { z } from "zod";

/**
 * The signed-in account's settings document (docs/62 sections 3.1 and 3.3): the whole JSON `PUT /settings`
 * stores, replaced on every write and validated against this grammar first. The keys and value shapes are
 * the fileserver's settings wire schema (`src/fileserver/src/types/settings.ts`), so the app's document
 * moves between the two homes unchanged; `adminUrl` rides along as inert text (the account row is storage,
 * and which addresses a device trusts stays that device's fileserver setting).
 */
const libraryScope = z.union([
  z.tuple([z.literal("movie")]),
  z.tuple([z.literal("tv")]),
  z.tuple([z.literal("local")]),
  z.tuple([z.literal("movie"), z.literal("tv")]),
  z.tuple([z.literal("movie"), z.literal("local")]),
  z.tuple([z.literal("tv"), z.literal("local")]),
  z.tuple([z.literal("movie"), z.literal("tv"), z.literal("local")]),
]);

export const UserSettingsSchema = z
  .object({
    autoplay: z.boolean().optional(),
    theme: z.enum(["dark", "light"]).optional(),
    themeAccent: z.enum(["amber", "blue", "green", "violet", "rose"]).optional(),
    reducedMotion: z.enum(["off", "on"]).optional(),
    uiZoom: z.number().min(0.5).max(3).optional(),
    videoQuality: z.enum(["auto", "higher", "saver"]).optional(),
    audioLanguage: z.string().min(2).max(35).nullable().optional(),
    lowLatency: z.boolean().optional(),
    pictureFit: z.enum(["fit", "fill", "original"]).optional(),
    resumeMode: z.enum(["ask", "resume", "restart"]).optional(),
    watchedPercent: z.union([z.literal(90), z.literal(95), z.literal(100)]).optional(),
    liveOnOpen: z.enum(["last", "none"]).optional(),
    libraryView: z.enum(["grid", "list", "rows"]).optional(),
    librarySort: z.enum(["newest", "oldest", "az", "year"]).optional(),
    showContinue: z.boolean().optional(),
    subtitleLanguage: z.string().min(2).max(35).nullable().optional(),
    pauseHistory: z.boolean().optional(),
    rescanOnStartup: z.boolean().optional(),
    adminUrl: z.string().min(1).max(2048).optional(),
    defaultSource: z.string().min(1).max(200).nullable().optional(),
    libraryScope: libraryScope.optional(),
    librarySource: z.string().regex(/^(all|history|favorites|collection:.{1,100})$/).optional(),
    libraryGenres: z.array(z.string().min(1).max(80)).max(40).optional(),
    libraryYear: z.string().regex(/^(1[89]\d\d|2[01]\d\d)?$/).optional(),
    libraryWatched: z.enum(["all", "unwatched", "watching", "watched"]).optional(),
    libraryFilter: z.string().max(200).optional(),
  })
  .strict();
export type UserSettings = z.infer<typeof UserSettingsSchema>;

/** What `GET`/`PUT /settings` answer: the document, and when it was last written (absent before the first write). */
export interface UserSettingsAnswer {
  settings: UserSettings;
  updatedAt?: number;
}
