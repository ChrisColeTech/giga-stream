// Event log: one row per event.

import { $ } from './core/dom.js';
import { MAX_LOG_ROWS } from './config.js';

export function logEvent(kind, detail, level = 'info') {
  const rows = $('#logRows');
  if (!rows) return;
  const row = document.createElement('div');
  row.className = 'log-row';
  const time = new Date().toLocaleTimeString();
  row.innerHTML = `<span class="muted">${time}</span> <span class="${level}">${kind}</span> <span class="mono">${detail}</span>`;
  rows.prepend(row);
  while (rows.children.length > MAX_LOG_ROWS) rows.lastChild.remove();
}
