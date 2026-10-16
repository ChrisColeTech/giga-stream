// App entry: loads providers, wires the picker, loads the stage.

import { $ } from './core/dom.js';
import { loadProviders, allProviders, findProvider, embedUrl, resolveUrl, describe } from './providers.js';
import { loadEmbed, clearEmbed } from './embed.js';
import { logEvent } from './event-log.js';

function selection() {
  const kind = $('#kindSelect').value;
  return {
    kind,
    tmdbId: $('#tmdbInput').value.trim(),
    season: $('#seasonInput').value.trim() || '1',
    episode: $('#episodeInput').value.trim() || '1',
    startAt: 0,
  };
}

function wirePicker() {
  const providerSelect = $('#providerSelect');
  for (const p of allProviders()) {
    const option = document.createElement('option');
    option.value = p.id;
    option.textContent = `${p.name} (${p.family})`;
    providerSelect.append(option);
  }
  $('#kindSelect').addEventListener('change', () => {
    const episode = $('#kindSelect').value === 'episode';
    for (const row of document.querySelectorAll('[data-kind="episode"]')) {
      row.style.display = episode ? '' : 'none';
    }
  });
  $('#loadBtn').addEventListener('click', () => {
    const provider = findProvider(providerSelect.value);
    const sel = selection();
    if (!provider) return logEvent('picker', 'no provider chosen', 'bad');
    if (!sel.tmdbId) return logEvent('picker', 'no TMDB id', 'bad');
    const sandboxed = new URLSearchParams(location.search).has('sandbox');
    const url = provider.family === 'stream' ? resolveUrl(provider, sel) : embedUrl(provider, sel);
    if (!url) return logEvent('picker', 'provider has no template for this kind', 'bad');
    logEvent('picker', `${provider.id} ${describe(sel)}`);
    loadEmbed({ providerId: provider.id, selection: sel, url, sandboxed, family: provider.family });
  });
}

// Query autoload: ?provider=vidsrc&kind=movie&tmdb=603&autoload=1
function autoload() {
  const params = new URLSearchParams(location.search);
  if (!params.has('autoload')) return;
  if (params.has('provider')) $('#providerSelect').value = params.get('provider');
  if (params.has('kind')) {
    $('#kindSelect').value = params.get('kind');
    $('#kindSelect').dispatchEvent(new Event('change'));
  }
  if (params.has('tmdb')) $('#tmdbInput').value = params.get('tmdb');
  if (params.has('season')) $('#seasonInput').value = params.get('season');
  if (params.has('episode')) $('#episodeInput').value = params.get('episode');
  $('#loadBtn').click();
}

export async function init() {
  try {
    await loadProviders();
    logEvent('providers', `${allProviders().length} loaded`, 'ok');
    wirePicker();
    autoload();
  } catch (error) {
    logEvent('providers', String(error), 'bad');
  }
}
