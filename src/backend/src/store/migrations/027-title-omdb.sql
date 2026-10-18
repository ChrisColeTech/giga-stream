-- 027-title-omdb (docs/11 section 7.3, docs/47 section 3.1): the Library fill's `details` phase enriches a title from OMDb
-- by its IMDb id. A title OMDb did not know (a miss) records when (`omdb_failed_at`, nullable, so every stored title is
-- kept as it was): the phase leaves it alone until the freshness window has passed, so a miss is never retried forever.
-- The `omdb` block itself lives in the title's payload.

ALTER TABLE titles ADD COLUMN omdb_failed_at INTEGER;
