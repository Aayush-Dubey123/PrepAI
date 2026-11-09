// Platform navigation benchmark harness (see docs/perf-plan-revisions.md §0).
// Usage: production build (`next build && next start`), signed in, on /dashboard.
// Paste this file into the DevTools console, then: `await __bench.cycle()`.
// For mobile width, open any same-origin page, put /dashboard in a 390x844 iframe,
// and run `iframe.contentWindow.eval(<this file>)` inside it.
window.__bench = (() => {
  const lt = [];
  try { new PerformanceObserver((l) => lt.push(...l.getEntries())).observe({ type: 'longtask', buffered: true }); } catch {}

  // Track DOM mutations and in-flight fetches so "done" waits for real work.
  let lastMut = performance.now();
  let inflight = 0;
  let lastFetchEnd = 0;
  if (!window.__origFetch) window.__origFetch = window.fetch;
  window.fetch = function (...a) {
    inflight++;
    return window.__origFetch.apply(this, a).finally(() => { inflight--; lastFetchEnd = performance.now(); });
  };
  new MutationObserver(() => { lastMut = performance.now(); })
    .observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });

  const lastResourceEnd = () => {
    const r = performance.getEntriesByType('resource');
    return r.length ? Math.max(...r.map((e) => e.responseEnd)) : 0;
  };

  // Resolves once DOM, fetches and resources have been quiet for `quiet` ms (capped at `max`).
  const settle = (t0, quiet = 800, max = 15000) => new Promise((res) => {
    const tick = () => {
      const now = performance.now();
      const last = Math.max(lastMut, lastResourceEnd(), lastFetchEnd, t0);
      if ((inflight === 0 && now - last >= quiet) || now - t0 > max) res({ end: last, capped: now - t0 > max });
      else setTimeout(tick, 100);
    };
    setTimeout(tick, 100);
  });

  const summarize = (t0, t1) => {
    const tasks = lt.filter((e) => e.startTime >= t0 && e.startTime <= t1 + 1000);
    const res = performance.getEntriesByType('resource').filter((e) => e.startTime >= t0);
    const slow = res.reduce((a, e) => (e.duration > (a ? a.duration : -1) ? e : a), null);
    const fetches = res.filter((e) => e.initiatorType === 'fetch' || e.initiatorType === 'xmlhttprequest');
    const urls = res.map((e) => { const u = new URL(e.name); return u.origin + u.pathname + u.search; });
    return {
      ms: Math.round(t1 - t0),
      lt: tasks.length,
      ltMs: Math.round(tasks.reduce((s, e) => s + e.duration, 0)),
      maxLt: Math.round(Math.max(0, ...tasks.map((e) => e.duration))),
      tbt: Math.round(tasks.reduce((s, e) => s + Math.max(0, e.duration - 50), 0)),
      req: res.length,
      fetch: fetches.length,
      kb: Math.round(res.reduce((s, e) => s + (e.transferSize || 0), 0) / 1024),
      slow: slow ? new URL(slow.name).pathname.slice(-30) + ' ' + Math.round(slow.duration) : '-',
      dup: urls.length - new Set(urls).size,
      heap: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
    };
  };

  const initial = async () => {
    const s = await settle(0, 1000, 20000);
    const nav = performance.getEntriesByType('navigation')[0];
    const paint = Object.fromEntries(performance.getEntriesByType('paint').map((p) => [p.name, Math.round(p.startTime)]));
    let lcp = null;
    await new Promise((r) => {
      try {
        new PerformanceObserver((l) => { const e = l.getEntries(); lcp = Math.round(e[e.length - 1].startTime); r(); })
          .observe({ type: 'largest-contentful-paint', buffered: true });
      } catch { r(); }
      setTimeout(r, 300);
    });
    return { r: 'init', ttfb: Math.round(nav.responseStart), fcp: paint['first-contentful-paint'], lcp,
      load: Math.round(nav.loadEventEnd), capped: s.capped, ...summarize(0, s.end) };
  };

  const nav = async (href) => {
    const a = [...document.querySelectorAll('a[href="' + href + '"]')].find((x) => x.offsetParent !== null);
    if (!a) return { r: href, error: 'no visible link' };
    const from = location.pathname;
    performance.clearResourceTimings();
    const t0 = performance.now();
    a.click();
    while (location.pathname === from && performance.now() - t0 < 10000) await new Promise((r) => setTimeout(r, 20));
    const url = Math.round(performance.now() - t0);
    const s = await settle(t0);
    return { r: from.slice(1, 4) + '>' + href.slice(1, 4), url, capped: s.capped, ...summarize(t0, s.end) };
  };

  // Run right after a full load of /dashboard.
  const cycle = async () => {
    const o = [await initial()];
    for (const h of ['/analytics', '/practice', '/dashboard']) o.push(await nav(h));
    return o.map((x) => Object.entries(x).map(([k, v]) => k + '=' + v).join(' ')).join('\n');
  };

  return { initial, nav, cycle };
})();
