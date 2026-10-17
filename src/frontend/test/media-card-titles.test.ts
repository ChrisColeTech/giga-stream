import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PosterCard } from "@/components/library/PosterCard";
import { RelatedCard } from "@/components/player/RelatedCard";
import type { ResolvedItem } from "@/lib/library-marks";

const item: ResolvedItem = {
  ref: { kind: "title", id: "movie-603" }, kind: "movie", title: "The Matrix",
  genres: [], favorite: false, collectionIds: [], collectionSources: {},
  posterUrl: "/api/images/matrix",
};

describe("visible media card titles", () => {
  it("renders a title below Library artwork as well as its accessible name", () => {
    const html = renderToStaticMarkup(createElement(PosterCard, {
      item, selected: false, inHistory: false, collections: [], onSelect: () => undefined,
      onRemoveWatch: () => undefined,
    }));
    assert.match(html, /aria-label="The Matrix"/);
    assert.match(html, /<span[^>]*truncate[^>]*>The Matrix<\/span>/);
    assert.match(html, /aria-label="Play The Matrix"/);
    assert.match(html, /aria-label="Info The Matrix"/);
  });

  it("renders the recommendation title even without an image", () => {
    const html = renderToStaticMarkup(createElement(RelatedCard, {
      item: { ...item, posterUrl: undefined }, selected: false, onOpen: () => undefined,
    }));
    assert.match(html, /aria-label="The Matrix"/);
    assert.match(html, /<span[^>]*truncate[^>]*>The Matrix<\/span>/);
    assert.doesNotMatch(html, /<img/);
  });
});
