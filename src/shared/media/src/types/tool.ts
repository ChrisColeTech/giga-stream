/** The bundled tools the library finds and runs (docs/09). */
export type Tool = "ffmpeg" | "ffprobe";

export interface LocateOptions {
  env?: NodeJS.ProcessEnv;
  root?: string;
  exists?: (file: string) => boolean;
}

export interface RunOptions {
  cwd?: string;
  signal?: AbortSignal;
  /** Collect stdout and answer it (ffprobe's JSON); off for ffmpeg, whose stdout is unused. */
  captureStdout?: boolean;
}

export interface RunResult {
  stdout: string;
  stderr: string;
}
