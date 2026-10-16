#!/usr/bin/env node
// One-shot check of every stream provider in data/providers.json (docs/17), replicating each
// provider's real fetch flow: the API endpoint (not the site page), the headers its frontend sends,
// and the per-provider payload decoding. Written from the providers' own frontends; this is our own
// integration code, kept in one place so the PoC can prove fetch -> decode -> playable for each.
// Usage: node check-streams.mjs [--provider vidrock] [--kind movie|episode|both]

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createCipheriv, createDecipheriv, createHash, webcrypto } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const onlyProvider = flag('--provider', '');
const kindArg = flag('--kind', 'both');

const TITLES = {
  movie: { kind: 'movie', tmdbId: '603', label: 'The Matrix (1999)' },
  episode: { kind: 'episode', tmdbId: '1399', season: '1', episode: '1', label: 'Game of Thrones S01E01' },
};

const UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
];
const ua = () => UAS[Math.floor(Math.random() * UAS.length)];

const timeout = (ms) => AbortSignal.timeout(ms);

async function get(url, headers = {}) {
  const res = await fetch(url, { headers, redirect: 'follow', signal: timeout(20_000) });
  return res;
}

const PLAYABLE_URL = /\.(?:m3u8|mpd|mp4|mkv|webm)(?:[?#]|$)/i;
const PLAYABLE_TYPE = /mpegurl|dash\+xml|video\//i;

function findPlayableUrl(value, depth = 0) {
  if (depth > 6 || value === null || value === undefined) return '';
  if (typeof value === 'string') return PLAYABLE_URL.test(value) ? value : '';
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findPlayableUrl(item, depth + 1);
      if (found) return found;
    }
    return '';
  }
  if (typeof value === 'object') {
    for (const key of ['url', 'src', 'file', 'stream', 'streamUrl', 'playbackUrl', 'playlist', 'link', 'hls_streaming']) {
      const candidate = value[key];
      if (typeof candidate === 'string' && PLAYABLE_URL.test(candidate)) return candidate;
    }
    for (const item of Object.values(value)) {
      const found = findPlayableUrl(item, depth + 1);
      if (found) return found;
    }
  }
  return '';
}

// --- decoders -------------------------------------------------------------

/** VidNest: custom-base64 alphabet taken from the site's own frontend. */
const VIDNEST_ALPHABET = 'RB0fpH8ZEyVLkv7c2i6MAJ5u3IKFDxlS1NTsnGaqmXYdUrtzjwObCgQP94hoeW+/=';
const VIDNEST_REVERSE = new Map([...VIDNEST_ALPHABET].map((c, i) => [c, i]));
function decodeVidnestBase64(input) {
  let padded = input;
  const mod = padded.length % 4;
  if (mod !== 0) padded += '='.repeat(4 - mod);
  const bytes = [];
  for (let i = 0; i < padded.length; i += 4) {
    const chunk = padded.slice(i, i + 4);
    const c0 = VIDNEST_REVERSE.get(chunk[0]) ?? 64;
    const c1 = VIDNEST_REVERSE.get(chunk[1]) ?? 64;
    const c2 = chunk[2] === '=' ? 64 : (VIDNEST_REVERSE.get(chunk[2]) ?? 64);
    const c3 = chunk[3] === '=' ? 64 : (VIDNEST_REVERSE.get(chunk[3]) ?? 64);
    bytes.push(((c0 << 2) | (c1 >> 4)) & 0xff);
    if (c2 !== 64) bytes.push((((c1 & 0x0f) << 4) | (c2 >> 2)) & 0xff);
    if (c3 !== 64) bytes.push((((c2 & 0x03) << 6) | c3) & 0xff);
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

/** VidRock: AES-256-CBC with a fixed key; IV is the key's first 16 bytes; URL-safe base64 out. */
const VIDROCK_PASSPHRASE = 'x7k9mPqT2rWvY8zA5bC3nF6hJ2lK4mN9';
function vidrockEncryptId(itemId) {
  const key = Buffer.from(VIDROCK_PASSPHRASE, 'utf-8');
  const iv = key.subarray(0, 16);
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(itemId, 'utf-8'), cipher.final()]);
  return encrypted.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/** Peachify: AES-256-GCM; payload is base64url(iv).base64url(ciphertext).base64url(authTag). */
const PEACHIFY_KEY = (() => {
  const hex = Buffer.from(
    'YThmMmExYjVlOWM0NzA4MTRmNmIyYzNhNWQ4ZTdmOWMxYTJiM2M0ZDVlM2Y3YThiOGNhZDFlMmQwYTRkNWM1Yg==', 'base64',
  ).toString('utf-8');
  return Buffer.from(hex, 'hex');
})();
function peachifyDecrypt(payload) {
  const [ivB64, dataB64, tagB64] = payload.split('.');
  if (!ivB64 || !dataB64 || !tagB64) throw new Error('payload is not iv.ciphertext.tag');
  const b64 = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.replace(/-/g, '+').replace(/_/g, '/').length / 4) * 4, '='), 'base64');
  const decipher = createDecipheriv('aes-256-gcm', PEACHIFY_KEY, b64(ivB64));
  decipher.setAuthTag(b64(tagB64));
  return JSON.parse(Buffer.concat([decipher.update(b64(dataB64)), decipher.final()]).toString('utf-8'));
}

/** MafiaEmbed: AES-256-GCM; key is SHA-256 of a fixed secret; payload is {iv, tag, data} base64. */
const MAFIA_KEY = createHash('sha256').update('Z9#rL!v2K*5qP&7mXw').digest();
function mafiaDecrypt({ iv, tag, data }) {
  const decipher = createDecipheriv('aes-256-gcm', MAFIA_KEY, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf-8'));
}

// --- per-provider resolvers ------------------------------------------------
// Each returns { ok, status, streams: [{server, url}], note }.

async function resolveVidApi(media) {
  const url = media.kind === 'movie'
    ? `https://streamdata.vaplayer.ru/api.php?tmdb=${media.tmdbId}&type=movie`
    : `https://streamdata.vaplayer.ru/api.php?tmdb=${media.tmdbId}&type=tv&season=${media.season}&episode=${media.episode}`;
  const res = await get(url, { 'User-Agent': ua(), Accept: 'application/json' });
  if (!res.ok) return { ok: false, status: res.status, streams: [], note: `HTTP ${res.status}` };
  const data = await res.json();
  const streams = (data?.data?.stream_urls ?? []).map((u, i) => ({ server: `#${i + 1}`, url: u }));
  return { ok: streams.length > 0, status: 200, streams, note: `${streams.length} streams in JSON` };
}

async function resolveVidRock(media) {
  const itemId = media.kind === 'movie' ? media.tmdbId : `${media.tmdbId}_${media.season}_${media.episode}`;
  const url = `https://vidrock.net/api/${media.kind}/${vidrockEncryptId(itemId)}`;
  const res = await get(url, {
    'User-Agent': ua(),
    Accept: 'application/json, text/javascript, */*; q=0.01',
    Referer: 'https://vidrock.net/',
    Origin: 'https://vidrock.net',
  });
  if (!res.ok) return { ok: false, status: res.status, streams: [], note: `HTTP ${res.status}` };
  const data = await res.json();
  const streams = [];
  for (const entry of Object.values(data)) {
    if (!entry?.url) continue;
    if (entry.url.includes('hls2.vdrk.site')) {
      const second = await get(entry.url, { 'User-Agent': ua(), Referer: 'https://vidrock.net/' });
      if (!second.ok) continue;
      const cdns = await second.json();
      for (const obj of cdns) {
        let final = obj.url;
        if (final.startsWith('https://proxy.vidrock.store/')) {
          final = decodeURIComponent(final.slice('https://proxy.vidrock.store/'.length).replace(/^\//, ''));
        }
        streams.push({ server: `vdrk ${obj.resolution ?? ''}p`.trim(), url: final });
      }
    } else {
      streams.push({ server: entry.language ?? 'main', url: entry.url });
    }
  }
  return { ok: streams.length > 0, status: 200, streams, note: `${streams.length} streams` };
}

const VIDNEST_SERVERS = ['moviebox', 'allmovies', 'catflix', 'purstream', 'hollymoviehd', 'lamda', 'flixhq', 'vidlink', 'onehd', 'klikxxi'];
async function resolveVidNest(media) {
  const headers = {
    'User-Agent': ua(),
    Accept: 'application/json, text/javascript, */*; q=0.01',
    Referer: 'https://vidnest.fun/',
    Origin: 'https://vidnest.fun',
  };
  const pathPart = media.kind === 'movie'
    ? `movie/${media.tmdbId}`
    : `tv/${media.tmdbId}/${media.season}/${media.episode}`;
  const results = await Promise.allSettled(VIDNEST_SERVERS.map(async (server) => {
    const res = await get(`https://new.vidnest.fun/${server}/${pathPart}`, headers);
    if (!res.ok) throw new Error(`${res.status}`);
    const body = await res.json();
    const decoded = body?.encrypted ? decodeVidnestBase64(body.data) : body.data;
    const parsed = JSON.parse(decoded);
    const url = findPlayableUrl(parsed);
    if (!url) throw new Error('no playable url in payload');
    return { server, url };
  }));
  const streams = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  const failed = results.length - streams.length;
  return {
    ok: streams.length > 0,
    status: streams.length > 0 ? 200 : 0,
    streams,
    note: `${streams.length}/${VIDNEST_SERVERS.length} servers answered (${failed} failed)`,
  };
}

const PEACHIFY_SERVERS = [
  'https://uwu.eat-peach.sbs/moviebox',
  'https://usa.eat-peach.sbs/holly',
  'https://usa.eat-peach.sbs/air',
  'https://usa.eat-peach.sbs/multi',
  'https://uwu.eat-peach.sbs/net',
  'https://uwu.eat-peach.sbs/bmb',
];
async function resolvePeachify(media) {
  const agent = ua();
  const headers = {
    'User-Agent': agent,
    Accept: 'application/json, text/javascript, */*; q=0.01',
    Referer: 'https://peachify.top/',
    Origin: 'https://peachify.top',
  };
  const pathPart = media.kind === 'movie' ? `movie/${media.tmdbId}` : `tv/${media.tmdbId}/${media.season}/${media.episode}`;
  const results = await Promise.allSettled(PEACHIFY_SERVERS.map(async (base) => {
    const res = await get(`${base}/${pathPart}`, headers);
    if (!res.ok) throw new Error(`${res.status}`);
    let body = await res.json();
    if (body?.isEncrypted && body.data) body = peachifyDecrypt(body.data);
    const sources = Array.isArray(body?.sources) ? body.sources : [];
    const url = findPlayableUrl(sources);
    if (!url) throw new Error('no playable source');
    return { server: new URL(base).hostname + ' ' + base.split('/').at(-1), url };
  }));
  const streams = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  return {
    ok: streams.length > 0,
    status: streams.length > 0 ? 200 : 0,
    streams,
    note: `${streams.length}/${PEACHIFY_SERVERS.length} servers answered`,
  };
}

async function resolvePopr(media) {
  const serverParam = '';
  const url = media.kind === 'movie'
    ? `https://popr.ink/api/vidnest?id=${media.tmdbId}&type=movie${serverParam}`
    : `https://popr.ink/api/vidnest?id=${media.tmdbId}&type=tv&season=${media.season}&episode=${media.episode}`;
  const res = await get(url, { 'User-Agent': ua(), Referer: 'https://popr.ink/' });
  if (!res.ok) return { ok: false, status: res.status, streams: [], note: `HTTP ${res.status}` };
  const data = await res.json();
  const streams = (data?.results?.[0]?.streams ?? [])
    .filter((s) => s?.url)
    .map((s) => ({ server: s.quality ?? 'main', url: s.url }));
  return { ok: streams.length > 0, status: 200, streams, note: `${streams.length} streams` };
}

async function resolveMafia(media) {
  const agent = ua();
  const headers = {
    'User-Agent': agent,
    Accept: 'application/json, text/javascript, */*; q=0.01',
    Referer: 'https://player.nhdapi.com/',
    Origin: 'https://player.nhdapi.com',
  };
  const session = await get('https://player.nhdapi.com/api/session', { ...headers, method: 'POST' });
  const cookie = (session.headers.getSetCookie?.() ?? [])[0]?.split(';')[0];
  if (cookie) headers.Cookie = cookie;
  const tokenRes = await get('https://player.nhdapi.com/api/token', headers);
  if (!tokenRes.ok) return { ok: false, status: tokenRes.status, streams: [], note: `token HTTP ${tokenRes.status}` };
  const { token } = await tokenRes.json();
  const url = media.kind === 'movie'
    ? `https://player.nhdapi.com/api/movie/?id=${media.tmdbId}`
    : `https://player.nhdapi.com/api/?tv=${media.tmdbId}&season=${media.season}&episode=${media.episode}`;
  const res = await get(url, { ...headers, 'x-api-token': token, 'x-content-id': media.tmdbId });
  if (!res.ok) return { ok: false, status: res.status, streams: [], note: `HTTP ${res.status}` };
  const api = mafiaDecrypt(await res.json());
  const streams = [];
  if (api?.stream?.hls_streaming) streams.push({ server: 'hls', url: api.stream.hls_streaming });
  for (const d of api?.stream?.download ?? []) {
    if (d?.url && PLAYABLE_URL.test(d.url)) streams.push({ server: d.quality ?? 'download', url: d.url });
  }
  return { ok: streams.length > 0, status: 200, streams, note: `${streams.length} streams` };
}

async function resolveIcefy(media) {
  const url = media.kind === 'movie'
    ? `https://streams.icefy.top/movie/${media.tmdbId}`
    : `https://streams.icefy.top/tv/${media.tmdbId}/${media.season}/${media.episode}`;
  const res = await get(url, {
    'User-Agent': ua(),
    Accept: 'application/json, text/javascript, */*; q=0.01',
    Referer: 'https://streams.icefy.top',
    Origin: 'https://streams.icefy.top',
  });
  if (!res.ok) {
    const note = res.status === 403 ? 'HTTP 403 (Cloudflare; the site wants a solved challenge)' : `HTTP ${res.status}`;
    return { ok: false, status: res.status, streams: [], note };
  }
  const data = await res.json();
  return data?.stream
    ? { ok: true, status: 200, streams: [{ server: 'main', url: data.stream }], note: 'stream in JSON' }
    : { ok: false, status: 200, streams: [], note: 'no stream in JSON' };
}

const RESOLVERS = {
  vidapi: resolveVidApi,
  vidrock: resolveVidRock,
  vidnest: resolveVidNest,
  peachify: resolvePeachify,
  popr: resolvePopr,
  streammafia: resolveMafia,
  icefy: resolveIcefy,
};

// --- runner ---------------------------------------------------------------

const { providers } = JSON.parse(await readFile(path.join(root, 'data', 'providers.json'), 'utf-8'));
const under = providers.filter((p) => RESOLVERS[p.id] && (!onlyProvider || p.id === onlyProvider));
const kinds = kindArg === 'both' ? ['movie', 'episode'] : [kindArg];

console.log(`checking ${under.length} stream providers, kinds: ${kinds.join(', ')}\n`);
const results = [];
for (const provider of under) {
  for (const kindName of kinds) {
    const media = TITLES[kindName];
    if (provider.kind === 'movie' && kindName === 'episode') continue;
    const started = Date.now();
    let outcome;
    try {
      outcome = await RESOLVERS[provider.id](media);
    } catch (error) {
      outcome = { ok: false, status: null, streams: [], note: `failed: ${error.cause?.code ?? error.message}` };
    }
    outcome.ms = Date.now() - started;
    outcome.id = provider.id;
    outcome.kind = kindName;
    results.push(outcome);
    const mark = outcome.ok ? 'PASS' : 'FAIL';
    console.log(`${mark}  ${provider.id.padEnd(12)} ${kindName.padEnd(8)} ${String(outcome.status ?? '-').padEnd(5)} ${String(outcome.ms).padStart(6)}ms  ${outcome.note}`);
    for (const stream of outcome.streams.slice(0, 3)) {
      console.log(`         [${stream.server}] ${stream.url.slice(0, 110)}${stream.url.length > 110 ? '…' : ''}`);
    }
  }
}

const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} provider-kind pairs resolved a playable stream`);
await mkdir(path.join(root, 'results'), { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
await writeFile(path.join(root, 'results', `stream-check-${stamp}.json`), JSON.stringify(results, null, 2));
console.log(`saved results/stream-check-${stamp}.json`);
