import { z } from "zod";

export const SettingsSchema = z.object({
  autoplay: z.boolean(),
  theme: z.enum(["dark", "light", "system"]),
  themeAccent: z.enum(["amber", "blue", "green", "violet", "rose"]),
  reducedMotion: z.enum(["system", "off", "on"]),
  uiZoom: z.number().min(0.5).max(3),
  videoQuality: z.enum(["auto", "higher", "saver"]),
  audioLanguage: z.string().min(2).max(35).nullable(),
  subtitleLanguage: z.string().min(2).max(35).nullable(),
  lowLatency: z.boolean(),
  pictureFit: z.enum(["fit", "fill", "original"]),
  resumeMode: z.enum(["ask", "resume", "restart"]),
  watchedPercent: z.union([z.literal(90), z.literal(95), z.literal(100)]),
  liveOnOpen: z.enum(["last", "none"]),
  libraryView: z.enum(["grid", "list"]),
  librarySort: z.enum(["newest", "oldest", "az", "year"]),
  showContinue: z.boolean(),
  pauseHistory: z.boolean(),
  rescanOnStartup: z.boolean(),
  adminUrl: z.string().min(1).max(2048),
});

export const SettingsPatchSchema = SettingsSchema.partial();
export type SettingsAnswer = z.infer<typeof SettingsSchema>;
export type SettingsPatch = z.infer<typeof SettingsPatchSchema>;
