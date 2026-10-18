import { ApiError } from "@giga/http/api-error";
import type { PlaylistField } from "./playlist-draft";
import { fieldOf } from "./playlist-flow-result";

const FIELDS: readonly PlaylistField[] = ["name", "address", "enabled", "file"];

/** The form row a playlist refusal sits under. The backend names a web playlist's address `url`; the form's row is
 *  `Address`. A refusal that names no row of the form sits on the notice line alone. */
export const playlistRowOf = (error: unknown): PlaylistField | undefined =>
  fieldOf(error, FIELDS, error instanceof ApiError && error.field === "url" ? "address" : undefined);
