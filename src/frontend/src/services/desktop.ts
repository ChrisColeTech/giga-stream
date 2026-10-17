import type { z } from "zod";
import { errorSentence } from "@/lib/error-sentence";
import { ApiError, api } from "./api";
import { FolderSelectionSchema } from "./schemas/collection-schema";

export interface DesktopCapability {
  readonly runtime: "electron";
}

export type FolderSelection = z.infer<typeof FolderSelectionSchema>;

function installedCapability(): DesktopCapability | null {
  if (typeof window === "undefined" || window.pocHost?.runtime !== "electron") return null;
  return window.pocHost;
}

export function hasDesktopPicker(capability: DesktopCapability | null = installedCapability()): boolean {
  return capability?.runtime === "electron";
}

export function chooseFolder(capability: DesktopCapability | null = installedCapability()): Promise<FolderSelection> {
  if (!hasDesktopPicker(capability)) {
    return Promise.reject(new ApiError("fs.desktop_required", errorSentence("fs.desktop_required"), 409));
  }
  return api("/api/fs/dialog", FolderSelectionSchema, { method: "POST", area: "Scan" });
}

declare global {
  interface Window {
    readonly pocHost?: DesktopCapability & {
      readonly onGuard: (callback: (report: unknown) => void) => void;
      readonly setPlayerPolicy: (policy: { origin: string; frameOrigins: string[] }) => void;
      readonly clearPlayerPolicy: () => void;
    };
  }
}
