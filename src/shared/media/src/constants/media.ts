/** Named values of the shared media library (`01` section 5: no configuration literals where they are used). */

/** The video files a scan looks for (docs/03 section 3.8). */
export const VIDEO_EXTENSIONS: readonly string[] = [".mp4", ".m4v", ".mkv", ".webm", ".mov", ".avi", ".ts"];

/** Files probed at once: ffprobe is quick, and the disk is the limit. */
export const SCAN_CONCURRENCY = 2;

/** How much of a tool's stderr is kept for an error message. */
export const STDERR_TAIL_CHARS = 4000;

/** Where the bundled tools live, under the repository root (docs/09). */
export const TOOLS_BIN_DIR: readonly string[] = ["tools", "ffmpeg", "bin"];

/** Overrides the tools folder, for a build kept somewhere else. */
export const TOOLS_DIR_ENV = "GIGA_STREAM_FFMPEG_DIR";

export const UNREADABLE_SENTENCE = "The file could not be read as video.";
export const NO_VIDEO_SENTENCE = "The file has no video stream.";
export const NO_LENGTH_SENTENCE = "The file has no length.";
