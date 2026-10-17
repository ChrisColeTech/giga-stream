import type { z } from "zod";
import { api } from "./api";
import {
  ShellStateSchema,
  StatePartSchemas,
  StateWireSchema,
} from "./schemas/state-schema";

export interface StateSnapshot {
  readonly version?: z.infer<typeof StatePartSchemas.version>;
  readonly host?: z.infer<typeof StatePartSchemas.host>;
  readonly settings?: z.infer<typeof StatePartSchemas.settings>;
  readonly shell?: z.infer<typeof ShellStateSchema>;
  readonly backend?: z.infer<typeof StatePartSchemas.backend>;
  readonly channels?: z.infer<typeof StatePartSchemas.channels>;
  readonly lastChannelId?: string;
  readonly collections?: z.infer<typeof StatePartSchemas.collections>;
  readonly jobs?: z.infer<typeof StatePartSchemas.jobs>;
  readonly unreadable: readonly string[];
}

function part<T>(name: string, schema: z.ZodType<T>, wire: Record<string, unknown>, unreadable: string[]): T | undefined {
  const parsed = schema.safeParse(wire[name]);
  if (parsed.success) return parsed.data;
  unreadable.push(name);
  return undefined;
}

export function decodeState(wire: Record<string, unknown>): StateSnapshot {
  const unreadable: string[] = [];
  return {
    version: part("version", StatePartSchemas.version, wire, unreadable),
    host: part("host", StatePartSchemas.host, wire, unreadable),
    settings: part("settings", StatePartSchemas.settings, wire, unreadable),
    shell: part("shell", StatePartSchemas.shell, wire, unreadable),
    backend: part("backend", StatePartSchemas.backend, wire, unreadable),
    channels: part("channels", StatePartSchemas.channels, wire, unreadable),
    lastChannelId: part("lastChannelId", StatePartSchemas.lastChannelId, wire, unreadable),
    collections: part("collections", StatePartSchemas.collections, wire, unreadable),
    jobs: part("jobs", StatePartSchemas.jobs, wire, unreadable),
    unreadable,
  };
}

export async function readState(signal?: AbortSignal): Promise<StateSnapshot> {
  return decodeState(await api("/api/state", StateWireSchema, { signal, area: "Connection" }));
}
