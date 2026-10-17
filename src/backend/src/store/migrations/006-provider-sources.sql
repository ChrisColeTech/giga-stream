-- Providers carry the embed templates and the message facts the sources fill needs
-- (docs/03 sections 7.2b and 7.5). `order` is quoted: it is an SQL keyword.
ALTER TABLE providers ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE providers ADD COLUMN family TEXT NOT NULL DEFAULT 'embed';
ALTER TABLE providers ADD COLUMN movie_template TEXT NULL;
ALTER TABLE providers ADD COLUMN episode_template TEXT NULL;
ALTER TABLE providers ADD COLUMN start_param TEXT NULL;
ALTER TABLE providers ADD COLUMN subtitles_param TEXT NULL;
ALTER TABLE providers ADD COLUMN origin TEXT NULL;
ALTER TABLE providers ADD COLUMN frame_origins TEXT NULL;
ALTER TABLE providers ADD COLUMN message_shape TEXT NULL;
