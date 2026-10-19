import { z } from "zod";
import type { LibraryMediaTypes } from "@/types/library";

const LibraryScopeSchema: z.ZodType<LibraryMediaTypes> = z.union([
  z.tuple([z.literal("movie")]),
  z.tuple([z.literal("tv")]),
  z.tuple([z.literal("local")]),
  z.tuple([z.literal("movie"), z.literal("tv")]),
  z.tuple([z.literal("movie"), z.literal("local")]),
  z.tuple([z.literal("tv"), z.literal("local")]),
  z.tuple([z.literal("movie"), z.literal("tv"), z.literal("local")]),
]);

export const SettingsSchema = z.object({
  autoplay: z.boolean(),
  theme: z.enum(["dark", "light"]),
  themeAccent: z.enum(["amber", "blue", "green", "violet", "rose"]),
  reducedMotion: z.enum(["off", "on"]),
  uiZoom: z.number().min(0.5).max(3),
  videoQuality: z.enum(["auto", "higher", "saver"]),
  audioLanguage: z.string().min(2).max(35).nullable(),
  subtitleLanguage: z.string().min(2).max(35).nullable(),
  lowLatency: z.boolean(),
  pictureFit: z.enum(["fit", "fill", "original"]),
  resumeMode: z.enum(["ask", "resume", "restart"]),
  watchedPercent: z.union([z.literal(90), z.literal(95), z.literal(100)]),
  liveOnOpen: z.enum(["last", "none"]),
  libraryView: z.enum(["grid", "list", "rows"]),
  librarySort: z.enum(["newest", "oldest", "az", "year"]),
  showContinue: z.boolean(),
  pauseHistory: z.boolean(),
  rescanOnStartup: z.boolean(),
  adminUrl: z.string().min(1).max(2048),
  defaultSource: z.string().min(1).max(200).nullable(),
  libraryScope: LibraryScopeSchema,
  librarySource: z.string().regex(/^(all|history|favorites|collection:.{1,100})$/),
  libraryGenres: z.array(z.string().min(1).max(80)).max(40),
  libraryYear: z.string().regex(/^(1[89]\d\d|2[01]\d\d)?$/),
  libraryWatched: z.enum(["all", "unwatched", "watching", "watched"]),
  libraryFilter: z.string().max(200),
});

export const SettingsPatchSchema = SettingsSchema.partial();
export type SettingsAnswer = z.infer<typeof SettingsSchema>;
export type SettingsPatch = z.infer<typeof SettingsPatchSchema>;
