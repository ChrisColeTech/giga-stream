import type { z } from "zod";
import { api } from "./api";
import { FolderSchema, RemovedSchema } from "./schemas/collection-schema";

export type FolderAnswer = z.infer<typeof FolderSchema>;

const part = (value: string): string => encodeURIComponent(value);

export function attachFolder(collectionId: string, token: string): Promise<FolderAnswer> {
  return api(`/api/collections/${part(collectionId)}/folders`, FolderSchema, {
    method: "POST",
    body: { token },
    area: "Scan",
  });
}

export function replaceFolder(folderId: string, token: string): Promise<FolderAnswer> {
  return api(`/api/folders/${part(folderId)}`, FolderSchema, { method: "PUT", body: { token }, area: "Scan" });
}

export function rescanFolder(folderId: string): Promise<FolderAnswer> {
  return api(`/api/folders/${part(folderId)}/rescan`, FolderSchema, { method: "POST", area: "Scan" });
}

export function detachFolder(folderId: string): Promise<z.infer<typeof RemovedSchema>> {
  return api(`/api/folders/${part(folderId)}`, RemovedSchema, { method: "DELETE", area: "Scan" });
}
