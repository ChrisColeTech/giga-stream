// Load all partials into their slots.

import { load } from './core/fetch.js';

async function main() {
  const slots = [
    { id: 'titlebar', src: 'html/titlebar.html' },
    { id: 'picker', src: 'html/picker.html' },
    { id: 'stage', src: 'html/stage.html' },
    { id: 'logs', src: 'html/logs.html' },
    { id: 'checklist', src: 'html/checklist.html' },
    { id: 'statusbar', src: 'html/statusbar.html' },
  ];

  for (const slot of slots) {
    try {
      const html = await load(slot.src);
      const el = document.getElementById(slot.id);
      if (el) el.innerHTML = html;
    } catch (e) {
      console.error(`Failed to load ${slot.src}`, e);
    }
  }

  // Now load the app
  const { init } = await import('./app.js');
  init();
}

main().catch(e => console.error('Failed to load app', e));
