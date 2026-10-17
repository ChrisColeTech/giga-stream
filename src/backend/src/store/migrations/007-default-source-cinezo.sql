-- Cinezo is the owner's default source for movies and TV (owner, 2026-10-17): the lowest `order`
-- wins the first slot in every sources answer, so already-seeded databases move it to 0.
-- `order` is quoted: it is an SQL keyword.
UPDATE providers SET "order" = 0 WHERE name = 'Cinezo';
