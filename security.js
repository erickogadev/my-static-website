(() => {
  'use strict';

  const selfOrigin = location.origin;
  const allowedScript = src => {
    if (!src) return true;
    try {
      const url = new URL(src, location.href);
      return url.origin === selfOrigin ||
        url.hostname === 'cdn.tailwindcss.com' ||
        url.hostname === 'cdnjs.cloudflare.com' ||
        url.hostname === 'wa.me';
    } catch (_) {
      return false;
    }
  };
  const attempts = [];
  let toast;
  const warn = reason => {
    const now = Date.now();
    attempts.push(now);
    while (attempts[0] < now - 10000) attempts.shift();
    console.warn(`[${new Date(now).toISOString()}] Security: ${reason}`);
    if (attempts.length >= 3 && !toast) {
      toast = document.createElement('div');
      toast.textContent = 'Security: external modification blocked';
      toast.setAttribute('role', 'status');
      toast.style.cssText =
        'position:fixed;z-index:2147483647;right:16px;bottom:16px;padding:8px 12px;' +
        'border-radius:8px;background:#111827;color:#fff;font:12px system-ui;opacity:.92';
      (document.body || document.documentElement).appendChild(toast);
      setTimeout(() => { if (toast) { toast.remove(); toast = null; } }, 3500);
    }
  };
  ['eval', 'Function'].forEach(name => {
    try {
      Object.defineProperty(window, name, {
        configurable: false, writable: false, value: window[name]
      });
    } catch (_) { warn(`${name} override could not be locked`); }
  });

  const csp = document.createElement('meta');
  csp.httpEquiv = 'Content-Security-Policy';
  csp.content =
    "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com; object-src 'none'";
  (document.head || document.documentElement).appendChild(csp);

  const links = new Map();
  const cards = new Map();
  const remember = () => {
    document.querySelectorAll('a[href*="wa.me"]').forEach(link => {
      if (links.has(link)) return;
      const href = link.getAttribute('href');
      links.set(link, href);
      try {
        Object.defineProperty(link, 'href', {
          configurable: false, enumerable: true,
          get: () => new URL(href, location.href).href,
          set: () => warn('WhatsApp link assignment blocked')
        });
      } catch (_) { /* Some browsers do not allow an own href descriptor. */ }
    });
    document.querySelectorAll('.pricing-card').forEach(card => {
      if (!cards.has(card)) cards.set(card, card.innerHTML);
    });
  };
  const restore = () => {
    links.forEach((href, link) => {
      if (!link.isConnected) return;
      if (link.getAttribute('href') !== href) {
        link.setAttribute('href', href);
        warn('WhatsApp link mutation blocked');
      }
    });
    cards.forEach((html, card) => {
      if (card.isConnected && card.innerHTML !== html) {
        card.innerHTML = html;
        warn('Pricing content mutation blocked');
      }
    });
  };
  const suspicious = node => {
    if (node.nodeType !== 1) return false;
    const el = node;
    const text = `${el.id} ${el.className}`.toLowerCase();
    return /\b(ad|ads|advert|sponsor|popup|pop-up|overlay|injected|banner)\b/.test(text) ||
      (getComputedStyle(el).position === 'fixed' && el !== toast && !el.closest('header'));
  };
  const inspect = records => records.forEach(record => {
    if (record.type === 'attributes' && /^on/i.test(record.attributeName || '')) {
      record.target.removeAttribute(record.attributeName);
      warn('Inline event handler injection blocked');
    }
    record.addedNodes.forEach(node => {
      if (node.nodeType !== 1) return;
      const el = node;
      if (el.tagName === 'SCRIPT' && !allowedScript(el.src)) {
        el.remove(); warn('External script injection blocked');
      } else if (el.tagName === 'IFRAME' || suspicious(el)) {
        el.remove(); warn('Suspicious overlay or frame blocked');
      }
      el.querySelectorAll?.('script, iframe').forEach(child => {
        if (child.tagName === 'SCRIPT' && !allowedScript(child.src) ||
            child.tagName === 'IFRAME') {
          child.remove(); warn('Nested injection blocked');
        }
      });
    });
    record.target.querySelectorAll?.('[onclick],[onload],[onerror]').forEach(el => {
      el.removeAttribute('onclick'); el.removeAttribute('onload'); el.removeAttribute('onerror');
      warn('Inline event handler injection blocked');
    });
  });
  const start = () => {
    remember();
    const observer = new MutationObserver(records => {
      inspect(records); remember(); restore();
    });
    observer.observe(document.head, { childList: true, subtree: true, attributes: true });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    setInterval(restore, 1000);
  };
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
