/* The Providers tab's words (`37` section 3; the mockup's tips, `28` section 7.3): labels, tips, disabled reasons and
 * notices. Copy lives here, never in a component, so a refusal reads the same wherever it shows. */

/** The rows' labels, so each page fixes its label column once. Name first on every form (owner, 2026-10-17). */
export const NEW_PROVIDER_LABELS: readonly string[] = ["Name", "Family", "Source", "Movie template"];
export const PROVIDER_WORKSPACE_LABELS: readonly string[] = [
  "Name",
  "Family",
  "Source",
  "Movie template",
  "Enabled",
  "Order",
  "Created",
  "Episode template",
  "Start parameter",
  "Subtitle parameter",
  "Origin",
  "Frame origins",
  "Message shape",
];

export const PROVIDER_SECTIONS = [
  { id: "pv-details", label: "Details" },
  { id: "pv-templates", label: "Templates" },
  { id: "pv-player", label: "Player" },
] as const;
export const PROVIDER_SECTION_KEYS: readonly string[] = PROVIDER_SECTIONS.map((section) => section.id);

export const FAMILY_OPTIONS = [
  { value: "embed", label: "Embed" },
  { value: "stream", label: "Stream" },
] as const;

export const MESSAGE_SHAPE_OPTIONS = [
  { value: "", label: "None" },
  { value: "vidsrc-status", label: "vidsrc-status" },
  { value: "player-event", label: "player-event" },
] as const;

/** Info tips (the mockup's sentences). */
export const FAMILY_TIP =
  "Embed providers play in their own frame from an address template. Stream providers give a direct stream.";
export const NAME_TIP = "What the provider is called in the list and the picker. 1 to 120 characters.";
export const SOURCE_TIP = "The id of the external service. Unique for each provider.";
export const MOVIE_TEMPLATE_TIP = "The embed address for a movie. Use {tmdbId} where the TMDB id goes.";
export const ENABLED_TIP = "A disabled provider stays in the list but is not used.";
export const ORDER_TIP = "Preference order: the lowest number is tried first and sorts first in the picker.";
export const CREATED_TIP = "When the provider was added.";
export const EPISODE_TEMPLATE_TIP = "The embed address for an episode. Placeholders: {tmdbId}, {season}, {episode}.";
export const START_PARAM_TIP = "The documented query parameter that sets the start position, in seconds.";
export const SUBTITLES_PARAM_TIP = "The documented query parameter that sets the subtitle language.";
export const ORIGIN_TIP = "The origin allowed to post messages to the page.";
export const FRAME_ORIGINS_TIP = "The nested-frame origins the player really uses. Type one and press Enter.";
export const MESSAGE_SHAPE_TIP = "The documented shape of the messages the player posts, if it posts any.";
export const DELETE_PROVIDER_TITLE = "Deletes the provider; titles stop getting sources from it.";

/** Value refusals (`37` section 3.1, mirroring `types/provider.ts`). */
export const TEMPLATE_HTTPS = (label: string): string => `${label} must be an https address.`;
export const TEMPLATE_PLACEHOLDERS = (label: string, needed: string): string => `${label} must contain ${needed}.`;
export const ORIGIN_SHAPE = "Origin must be an https address with no path.";
export const FRAME_ORIGIN_SHAPE = "an https origin with no path";
export const FRAME_ORIGINS_MAX_REFUSAL = "At most 8 frame origins.";
export const TEXT_TOO_LONG = (label: string, max: number): string => `${label} must be at most ${max} characters.`;

/** Disabled reasons and notices. */
export const SAVING_REASON = "Saving.";
export const LOADING_REASON = "Loading.";
export const UNREACHABLE_REASON = "The admin backend cannot be reached.";
export const PROVIDER_GONE = "That provider no longer exists.";
export const REQUEST_FAILED = "The request failed.";
export const providerCreated = (name: string): string => `Created ${name}.`;
export const providerSaved = (name: string): string => `Saved ${name}.`;
export const providerDeleted = (name: string): string => `Deleted ${name}.`;
export const unreadableProviders = (count: number): string =>
  `${count} ${count === 1 ? "provider" : "providers"} could not be read.`;

/** The bulk verbs (`37` section 3.2). */
export const EVERY_ENABLED = "Every ticked provider is already enabled.";
export const EVERY_DISABLED = "Every ticked provider is already disabled.";
export const ALREADY_ENABLED = "Already enabled.";
export const ALREADY_DISABLED = "Already disabled.";
