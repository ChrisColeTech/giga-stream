import { UNREADABLE_SENTENCE } from "../constants/media.ts";
import { locateTool } from "../ffmpeg/locate-tool.ts";
import { runTool } from "../ffmpeg/run-tool.ts";
import type { MediaFacts } from "../types/media-facts.ts";
import { factsFromProbe } from "./facts-from-probe.ts";

/** Reads a file's facts with the bundled ffprobe. A file ffprobe cannot read is unplayable, with why. */
export async function probeFile(file: string, signal?: AbortSignal): Promise<MediaFacts> {
  const args = ["-v", "error", "-show_format", "-show_streams", "-of", "json", file];
  try {
    const { stdout } = await runTool(locateTool("ffprobe"), args, { captureStdout: true, ...(signal && { signal }) });
    return factsFromProbe(JSON.parse(stdout));
  } catch (error) {
    if (signal?.aborted) throw error;
    return { playable: false, problem: UNREADABLE_SENTENCE };
  }
}
