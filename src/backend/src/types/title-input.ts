import { z } from "zod";

import { ADDRESS_MAX } from "../constants/limits.js";

const TITLE_MAX = 200;
const PLOT_MAX = 5_000;
const NAME_MAX = 120;
const GENRES_MAX = 20;
const CAST_MAX = 50;
const SEASONS_MAX = 100;
const EPISODES_MAX = 500;

const text = (max: number) => z.string().trim().min(1).max(max);
const address = z.string().trim().min(1).max(ADDRESS_MAX);

/** One episode of a manual series; its season is the season it sits in. */
const EpisodeSchema = z
  .object({
    episode: z.number().int().min(0).max(10_000),
    title: text(TITLE_MAX).optional(),
    airDate: text(40).optional(),
    runtimeMs: z.number().int().min(0).optional(),
    stillUrl: address.optional(),
    streamUrl: address.optional(),
  })
  .strict();
const SeasonSchema = z
  .object({ season: z.number().int().min(0).max(SEASONS_MAX), episodes: z.array(EpisodeSchema).max(EPISODES_MAX) })
  .strict();
export type SeasonInput = z.infer<typeof SeasonSchema>;

/** The editable fields, all optional; the address rule (docs/03 section 7.3) is checked by the service. */
const fields = {
  title: text(TITLE_MAX),
  year: z.number().int().min(1800).max(2200),
  genres: z.array(text(60)).max(GENRES_MAX),
  rating: z.number().min(0).max(10),
  posterUrl: address,
  backdropUrl: address,
  plot: z.string().trim().min(1).max(PLOT_MAX),
  cast: z.array(text(NAME_MAX)).max(CAST_MAX),
  runtimeMs: z.number().int().min(0),
  seasons: z.array(SeasonSchema).max(SEASONS_MAX),
  streamUrl: address,
  tmdbId: z.number().int().positive(),
};

/** `POST /api/admin/titles`: a title made by hand (docs/26 decision D20). A TMDB id lets the providers produce sources. */
export const TitleInputSchema = z
  .object({
    kind: z.enum(["movie", "tv"]),
    title: fields.title,
    year: fields.year.optional(),
    genres: fields.genres.optional(),
    rating: fields.rating.optional(),
    posterUrl: fields.posterUrl.optional(),
    backdropUrl: fields.backdropUrl.optional(),
    plot: fields.plot.optional(),
    cast: fields.cast.optional(),
    runtimeMs: fields.runtimeMs.optional(),
    seasons: fields.seasons.optional(),
    streamUrl: fields.streamUrl.optional(),
    tmdbId: fields.tmdbId.optional(),
  })
  .strict();
export type TitleInput = z.infer<typeof TitleInputSchema>;

const nullable = <T extends z.ZodTypeAny>(schema: T) => schema.nullable().optional();

/**
 * `PATCH /api/admin/titles/:titleId`: any editable field; `null` clears an optional one. The kind and the id never change.
 * `tmdbId` belongs to a manual title only (the service refuses it on a synced one).
 */
export const TitlePatchSchema = z
  .object({
    title: fields.title.optional(),
    year: nullable(fields.year),
    genres: nullable(fields.genres),
    rating: nullable(fields.rating),
    posterUrl: nullable(fields.posterUrl),
    backdropUrl: nullable(fields.backdropUrl),
    plot: nullable(fields.plot),
    cast: nullable(fields.cast),
    runtimeMs: nullable(fields.runtimeMs),
    seasons: nullable(fields.seasons),
    streamUrl: nullable(fields.streamUrl),
    tmdbId: nullable(fields.tmdbId),
    // A field of the record, not of the payload: a disabled title leaves the public reads, and no sync changes it.
    enabled: z.boolean().optional(),
  })
  .strict();
export type TitlePatch = z.infer<typeof TitlePatchSchema>;
