# 17 - Mockup V2 Provider Loading

## Overview

Mockup V2 loads providers from the backend API instead of a static JSON file. This allows testing the same provider records that will be used in the final product.

## Provider Loading

1. On startup, the mockup calls `GET /api/providers` on the backend
2. The response is a list of provider records with the same shape as the PoC's `BackendProvider` interface
3. The provider list replaces the static JSON loading in `providers.js`

## Provider Record Shape

The backend provider record:
```json
{
  "id": 1,
  "name": "VidSrc",
  "source": "vidsrc",
  "api_key": "",
  "is_active": true,
  "created_at": "2026-10-16T12:00:00.000Z"
}
```

The mockup maps this to the PoC's internal provider format. The `source` field corresponds to the provider's family (embed or stream) and template.

## Embed Providers

For embed providers (vidsrc, vixsrc, vidzee), the mockup uses the documented embed URL templates. These are hardcoded in the mockup's provider configuration since the backend only stores the provider name and source identifier.

## Stream Providers

For stream providers, the mockup must get a playable URL. The mockup calls the stream provider's API endpoint directly, passes the TMDB ID, and checks if the response contains a playable address.

The working stream provider endpoints that have been verified:
- VidApi: `https://streamdata.vaplayer.ru/api.php?tmdb={tmdbId}&type=movie`
- VidRock: `https://vidrock.net/movie/{tmdbId}`
- Icefy: `https://streams.icefy.top/movie/{tmdbId}`
- Peachify: `https://peachify.top/embed/movie/{tmdbId}`
- Popr: `https://popr.ink/api/vidnest?id={tmdbId}&type=movie`
- MafiaEmbed: `https://player.nhdapi.com/api/movie/?id={tmdbId}`
- VidNest: `https://new.vidnest.fun/moviebox/{tmdbId}`

The mockup probes these endpoints and checks if the response contains a playable address (manifest or video file).

## Implementation Notes

- Mockup V2 uses the same provider list that the seeded backend has (14 providers)
- The mockup tests each provider with the standard test titles (The Matrix, Game of Thrones S01E01)
- Results will be saved to `results/` just like Mockup V1
- The mockup must send proper User-Agent headers when probing stream endpoints, as some providers check them
