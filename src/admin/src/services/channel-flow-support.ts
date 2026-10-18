import { ApiError } from "@giga/http/api-error";
import { REQUEST_FAILED } from "@/constants/channel-copy";
import { FAILURE_CODES } from "@/constants/api-sentences";
import { channelField, type ChannelField } from "@/lib/channel-check";
import type { AppState } from "@/store/app-store";
import type { ChannelsService } from "./channels";

/* What the channel flows share (`36` section 4): the injected store view and service, the typed results, and how a
 * failure becomes one warn notice plus, when the backend named a field, a refusal under that row. */

/** The part of the store the flows read and write. `useAppStore.getState` satisfies it; a test passes the same. */
export type ChannelStore = Pick<
  AppState,
  | "serial"
  | "signedIn"
  | "channels"
  | "workspaces"
  | "channelsStartLoad"
  | "channelsPageLoaded"
  | "channelsLiveLoaded"
  | "channelsSetQuery"
  | "channelsInvalidate"
  | "channelsResolving"
  | "channelsTickRows"
  | "channelsLoadFailed"
  | "channelUpsert"
  | "channelRemove"
  | "channelsMarkUnreachable"
  | "closeWorkspace"
  | "markStale"
  | "say"
>;

export interface ChannelFlowDeps {
  readonly service: ChannelsService;
  readonly store: () => ChannelStore;
}

export interface FlowOk<T> {
  readonly ok: true;
  readonly value: T;
}

export interface FlowRefused {
  readonly ok: false;
  readonly sentence: string;
  readonly field?: ChannelField;
  /** The answer belonged to an earlier session and was thrown away: nothing was written, nothing is said. */
  readonly dropped?: true;
}

export type FlowResult<T = undefined> = FlowOk<T> | FlowRefused;

export const DROPPED: FlowRefused = { ok: false, sentence: "", dropped: true };

export const done = <T>(value: T): FlowOk<T> => ({ ok: true, value });

/** True while the session that started a flow is still the session. */
export const stillSession = (store: () => ChannelStore, serial: number): boolean =>
  store().signedIn && store().serial === serial;

export const codeOf = (error: unknown): string | null => (error instanceof ApiError ? error.code : null);

/** A failure, said once on the notice line (`warn`) and, when the backend named one of the form's rows, returned with
 *  that field. There is no number, so no `channel.taken` refusal under one (owner, 2026-10-17). A transport failure also
 *  marks the backend unreachable, which disables every write until a read works. */
export function refusal(store: ChannelStore, error: unknown): FlowRefused {
  const api = error instanceof ApiError ? error : null;
  const sentence = api?.message ?? REQUEST_FAILED;
  const unreachable = api?.code === FAILURE_CODES.unreachable;
  if (unreachable) store.channelsMarkUnreachable(true);
  store.say(sentence, "warn", unreachable ? "Connection" : "Channel");
  const field = channelField(api?.field);
  return { ok: false, sentence, ...(field !== undefined && { field }) };
}

/** A refusal the page made itself (a value rule), said once and returned with its row. */
export function rejected(store: ChannelStore, sentence: string, field?: ChannelField): FlowRefused {
  store.say(sentence, "warn", "Channel");
  return { ok: false, sentence, ...(field !== undefined && { field }) };
}
