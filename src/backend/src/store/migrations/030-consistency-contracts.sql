-- 030-consistency-contracts (docs/56 decisions 7-8; docs/57 decision 8): remove meaningless catalog config keys
-- and rewrite legacy appearance choices before strict runtime schemas read them.

UPDATE sync_jobs
SET config = json_object('scope', json_extract(config, '$.scope'))
WHERE type = 'catalog' AND json_valid(config)
  AND json_extract(config, '$.scope') IN ('discover', 'recent');

UPDATE sync_jobs
SET config = json_object(
  'scope', json_extract(config, '$.scope'),
  'kind', CASE
    WHEN json_extract(config, '$.kind') IN ('all', 'movie', 'tv') THEN json_extract(config, '$.kind')
    ELSE 'movie'
  END,
  'pages', CASE
    WHEN json_type(config, '$.pages') = 'integer' AND json_extract(config, '$.pages') BETWEEN 1 AND 500
      THEN json_extract(config, '$.pages')
    ELSE 5
  END
)
WHERE type = 'catalog' AND json_valid(config)
  AND json_extract(config, '$.scope') IN ('trending', 'popular');

UPDATE admin_ui_state
SET settings = json_set(settings, '$.theme', 'dark')
WHERE json_valid(settings) AND json_extract(settings, '$.theme') = 'system';

UPDATE admin_ui_state
SET settings = json_set(settings, '$.reducedMotion', 'off')
WHERE json_valid(settings) AND json_extract(settings, '$.reducedMotion') = 'system';
