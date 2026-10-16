// Hosts a provider's playable surface in the stage. Embed providers load their embed page in an
// iframe; stream providers are checked by fetching their stream endpoint and reporting whether it
// answers a playable address.
import { $ } from './core/dom.js';
import { FRAME_ALLOW, FRAME_SANDBOX } from './config.js';
import { logEvent } from './event-log.js';
import { findProvider } from './providers.js';

let frame = null;

export const frameWindow = () => frame?.contentWindow ?? null;

export function loadEmbed({ providerId, selection, url, sandboxed, family }) {
  clearEmbed(false);
  if (family === 'stream') {
    checkStream(providerId, selection, url);
    return;
  }
  frame = document.createElement('iframe');
  frame.allow = FRAME_ALLOW;
  frame.allowFullscreen = true;
  frame.referrerPolicy = 'origin';
  if (sandboxed) frame.setAttribute('sandbox', FRAME_SANDBOX);
  const started = performance.now();
  frame.addEventListener('load', () => {
    logEvent('frame load', `${Math.round(performance.now() - started)} ms`, 'ok');
  });
  frame.src = url;
  const stage = $('#stageFrame');
  stage.innerHTML = '';
  stage.append(frame);
  logEvent('load', `${url}${sandboxed ? ' (sandboxed)' : ''}`);
}

async function checkStream(providerId, selection, url) {
  const stage = $('#stageFrame');
  stage.innerHTML = '<div class="stream-check" data-state="loading">checking stream endpoint…</div>';
  logEvent('stream check', url);
  const outcome = await probe(url);
  stage.innerHTML = `<div class="stream-check" data-state="${outcome.ok ? 'ok' : 'fail'}">
    <b class="${outcome.ok ? 'ok' : 'bad'}">${outcome.ok ? 'playable address' : 'no playable address'}</b> · ${outcome.status ?? 'no response'}<br>
    <span class="mono">${outcome.url ?? ''}</span><br>
    <span class="muted">${outcome.note ?? ''}</span>
  </div>`;
  logEvent('stream check', `${outcome.ok ? 'playable' : 'not playable'} (${outcome.status ?? 'no response'})`, outcome.ok ? 'ok' : 'bad');
}

/**
 * Fetch a stream endpoint and report whether it answers a playable address (manifest or file).
 * Some providers require a browser-like User-Agent; the PoC's fetch runs from the page, so the
 * browser sets its own UA and we cannot override it there — the probe goes through the fileserver
 * when available, and directly otherwise.
 */
async function probe(url) {
  try {
    const response = await fetch(url, { method: 'GET', redirect: 'follow' });
    const text = await response.text();
    const type = (response.headers.get('content-type') ?? '').toLowerCase();
    // A JSON answer (like VidApi's stream_urls) may carry playable addresses inside.
    let inner = '';
    if (type.includes('json')) {
      try {
        const data = JSON.parse(text);
        const urls = JSON.stringify(data).match(/https?:\/\/[^"']+\.(?:m3u8|mpd|mp4|mkv|webm)[^"']*/i) ?? [];
        inner = urls[0] ?? '';
      } catch { /* not JSON after all */ }
    }
    const playable =
      /m3u8|mpd|\.mp4|\.mkv|\.webm|\.ts/i.test(url) ||
      /mpegurl|dash\+xml|video\//.test(type) ||
      /#EXTM3U|<MPD/i.test(text.slice(0, 4000)) ||
      inner !== '';
    return {
      ok: response.ok && playable,
      status: response.status,
      url: inner || url,
      note: playable ? `content-type ${type || 'unknown'}` : `content-type ${type || 'unknown'}; body ${text.length} chars`,
    };
  } catch (error) {
    return { ok: false, status: null, url, note: `fetch failed: ${error.message}` };
  }
}

export function clearEmbed(announce = true) {
  if (frame) {
    frame.src = 'about:blank';
    frame.remove();
    frame = null;
  }
  const stage = $('#stageFrame');
  if (stage) stage.innerHTML = '<div class="skel"></div>';
}

document.addEventListener('fullscreenchange', () => {
  logEvent('fullscreen', document.fullscreenElement ? 'entered' : 'left');
});
