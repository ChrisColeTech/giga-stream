const FRAME_GUARD = `(function () {
  if (window.__gigaFrameGuard) return;
  window.__gigaFrameGuard = true;
  try {
    var allowed = (window.__gigaFrameOrigins || []).map(function (origin) {
      try { return new URL(origin).hostname; } catch (error) { return null; }
    }).filter(Boolean);
    function hostOf(value) { try { return new URL(value).hostname; } catch (error) { return ''; } }
    function sameHost(a, b) {
      if (!a || !b || a === b) return true;
      return a.endsWith('.' + b) || b.endsWith('.' + a);
    }
    function allowedHost(value) {
      var host = hostOf(value);
      if (!host || sameHost(host, location.hostname)) return true;
      return allowed.some(function (entry) { return sameHost(host, entry); });
    }
    document.addEventListener('DOMSubtreeModified', function (event) {
      var frame = event.target;
      if (!frame || frame.tagName !== 'IFRAME' && frame.tagName !== 'FRAME') return;
      var src = frame.getAttribute('src') || '';
      if (src && (src.indexOf('http') === 0 || src.indexOf('//') === 0) && !allowedHost(src)) {
        try { frame.src = 'about:blank'; } catch (error) {}
      }
    }, true);
    window.alert = function () { return undefined; };
    window.confirm = function () { return true; };
    window.prompt = function () { return null; };
  } catch (error) {}
})();`;

interface GuardWindow extends Window {
  __gigaFrameGuard?: boolean;
  __gigaFrameOrigins?: readonly string[];
}

/** Best-effort DOM guard. Cross-origin frames are instead contained by sandbox or Electron's host guards. */
export function installFrameGuard(frame: HTMLIFrameElement, origins: readonly string[]): boolean {
  const target: GuardWindow | null = frame.contentWindow;
  const document = frame.contentDocument;
  if (target === null || document === null) return false;
  try {
    target.__gigaFrameOrigins = origins;
    const script = document.createElement("script");
    script.textContent = FRAME_GUARD;
    document.documentElement.append(script);
    script.remove();
    return target.__gigaFrameGuard === true;
  } catch {
    return false;
  }
}
