import { api } from "./api";
import { RelatedSchema, SeasonSchema, TitleSchema } from "./schemas/title-schema";

const part = (value: string | number): string => encodeURIComponent(String(value));

export function readTitle(titleId: string, signal?: AbortSignal) {
  return api(`/api/titles/${part(titleId)}`, TitleSchema, { signal, area: "Catalog" });
}

export function readSeason(titleId: string, season: number, signal?: AbortSignal) {
  return api(`/api/titles/${part(titleId)}/seasons/${part(season)}`, SeasonSchema, { signal, area: "Catalog" });
}

export function readRelated(titleId: string, signal?: AbortSignal) {
  return api(`/api/titles/${part(titleId)}/related`, RelatedSchema, { signal, area: "Catalog" });
}
