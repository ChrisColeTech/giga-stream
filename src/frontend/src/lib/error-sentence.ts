import { errorSentence as sentenceFor } from "@giga/http/error-sentence";

/** The interface's user sentences by dotted code (`01` section 4.1). The shared request layer reads this table. */
export const SENTENCES: Readonly<Record<string, string>> = {
  "auth.unauthorized": "Sign in to do that.",
  "auth.invalid_credentials": "The username or password is wrong.",
  "auth.refresh_invalid": "That session has ended; sign in again.",
  "route.not_found": "There is nothing at that address.",
  "request.invalid": "That request was not understood.",
  "settings.invalid": "Those settings could not be saved.",
  "library.invalid": "That library request was not understood.",
  "title.not_found": "That title could not be found.",
  "backend.invalid_url": "The admin address is not valid.",
  "backend.tls_required": "The admin address must use HTTPS away from this computer.",
  "backend.unreachable": "Could not reach the admin backend.",
  "backend.bad_response": "The admin backend returned an unreadable answer.",
  "channel.not_found": "That channel could not be found.",
  "fs.desktop_required": "This action is available in the desktop app.",
  "fs.cancelled": "No folder was selected.",
  "fs.invalid_selection": "That folder could not be selected.",
  "job.not_found": "That job could not be found.",
  "job.not_running": "That job is no longer running.",
  "job.not_settled": "That job has not finished yet.",
  "collection.not_found": "That collection could not be found.",
  "collection.invalid": "That collection could not be saved.",
  "job.running": "That folder still has work running.",
  "image.not_found": "That image could not be found.",
  "watch.not_found": "That history entry could not be found.",
  "media.not_found": "That media file could not be found.",
  "playback.range_invalid": "That part of the media is not available.",
  "store.open": "The local store could not be opened.",
  "store.newer_schema": "The local store was made by a newer version.",
  "store.migrate": "The local store could not be upgraded.",
  "store.failed": "The local store could not be read.",
  "internal.failure": "Something went wrong on the server.",
  "response.invalid": "The fileserver returned an unreadable answer.",
  "fileserver.unreachable": "Could not reach the fileserver.",
};

export function errorSentence(code: string, serverSentence?: string): string {
  return sentenceFor(SENTENCES, code, serverSentence);
}
