// Internal QA helper for the review board — measures a real rendered page inside an iframe.
(function () {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  function rect(e) { const b = e.getBoundingClientRect(); return b; }
  function label(e) {
    const t = (e.getAttribute && (e.getAttribute('aria-label') || e.getAttribute('alt'))) || (e.textContent || '').trim();
    return e.tagName.toLowerCase() + '"' + t.replace(/\s+/g, ' ').slice(0, 22) + '"';
  }
  function inScroller(e, w) {
    for (let p = e.parentElement; p; p = p.parentElement) {
      const cs = w.getComputedStyle(p);
      if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll' || cs.overflowX === 'hidden' || cs.overflowX === 'clip') && p.tagName !== 'HTML' && p.tagName !== 'BODY') return true;
    }
    return false;
  }
  function visible(e, w) {
    const cs = w.getComputedStyle(e);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return false;
    const b = rect(e); return b.width > 0 && b.height > 0;
  }
  async function audit(frame, opts) {
    const d = frame.contentDocument, w = frame.contentWindow;
    const cw = d.documentElement.clientWidth, vh = w.innerHeight;
    const out = [];
    out.push('W=' + w.innerWidth + ' docSW=' + d.documentElement.scrollWidth + (d.documentElement.scrollWidth > cw + 1 ? ' ⚠PAGE-OVERFLOW' : ''));
    const all = [...d.querySelectorAll('body *')];
    const over = all.filter(e => { const b = rect(e); return b.width > 0 && (b.right > cw + 1 || b.left < -1) && !inScroller(e, w) && w.getComputedStyle(e).position !== 'fixed'; });
    if (over.length) out.push('⚠beyond-viewport: ' + over.slice(0, 6).map(label).join(', '));
    const clipped = all.filter(e => e.children.length === 0 && (e.textContent || '').trim() && visible(e, w) && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 2) && e.clientWidth > 0 && ['hidden', 'clip'].includes(w.getComputedStyle(e).overflowX));
    if (clipped.length) out.push('⚠clipped-text: ' + clipped.slice(0, 8).map(label).join(', '));
    const spill = all.filter(e => e.children.length === 0 && (e.textContent || '').trim() && visible(e, w) && e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 0 && w.getComputedStyle(e).overflowX === 'visible' && w.getComputedStyle(e).display !== 'inline');
    if (spill.length) out.push('⚠text-spills-box: ' + spill.slice(0, 8).map(label).join(', '));
    const arrows = all.filter(e => (e.tagName === 'BUTTON') && visible(e, w) && (/^(Previous|Next)\b/.test(e.getAttribute('aria-label') || '') || /^[‹›]$/.test((e.textContent || '').trim())));
    out.push('arrows visible: ' + arrows.length + (arrows.length ? ' [' + arrows.slice(0, 6).map(label).join(', ') + ']' : ''));
    // overlapping controls in the header row
    const hdr = d.querySelector('header');
    if (hdr) {
      const ctrls = [...hdr.querySelectorAll('a,button')].filter(e => visible(e, w) && !e.closest('[role=dialog]') && !e.closest('nav[aria-label=Menu]'));
      const ov = [];
      for (let i = 0; i < ctrls.length; i++) for (let j = i + 1; j < ctrls.length; j++) {
        if (ctrls[i].contains(ctrls[j]) || ctrls[j].contains(ctrls[i])) continue;
        const a = rect(ctrls[i]), b = rect(ctrls[j]);
        if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) ov.push(label(ctrls[i]) + '×' + label(ctrls[j]));
      }
      const hb = rect(hdr.firstElementChild);
      out.push('header h=' + Math.round(hb.height) + (ov.length ? ' ⚠overlap ' + ov.slice(0, 3).join('; ') : ' ok') + ' | ' + ctrls.filter(e => rect(e).top < hb.bottom).map(e => label(e).slice(0, 14) + '@' + Math.round(rect(e).left) + '-' + Math.round(rect(e).right)).join(' '));
    }
    const nav = d.querySelector('.chocho-bn');
    const masc = d.querySelector('button[aria-label="ChoCho 24/7 support"]');
    w.scrollTo(0, 1e6); await wait(250);
    const nb = nav && visible(nav, w) ? rect(nav) : null;
    const mb = masc && visible(masc, w) ? rect(masc) : null;
    const ft = d.querySelector('footer');
    const fb = ft ? rect(ft) : null;
    // last real content bottom
    const content = all.filter(e => visible(e, w) && !e.closest('.chocho-bn') && !(masc && masc.contains(e)) && w.getComputedStyle(e).position !== 'fixed' && e.children.length === 0 && ((e.textContent || '').trim() || e.tagName === 'IMG'));
    const lastBottom = Math.max(...content.map(e => rect(e).bottom));
    out.push('end: contentBottom=' + Math.round(lastBottom) + (nb ? ' navTop=' + Math.round(nb.top) : ' no-nav') + (mb ? ' mascot=' + Math.round(mb.left) + ',' + Math.round(mb.top) + ' ' + Math.round(mb.width) + 'x' + Math.round(mb.height) : '') + ' vh=' + vh + (nb && lastBottom > nb.top + 1 ? ' ⚠CONTENT-UNDER-NAV' : '') + (nb ? ' gapBelowContent=' + Math.round(nb.top - lastBottom) : ''));
    if (mb) {
      const hits = content.filter(e => { const b = rect(e); return b.right > mb.left + 4 && b.left < mb.right - 4 && b.bottom > mb.top + 4 && b.top < mb.bottom - 4; });
      if (hits.length) out.push('⚠mascot-over-end-content: ' + hits.slice(0, 5).map(label).join(', '));
      // mid-page: controls the mascot can never be scrolled clear of
      if (nb && mb.bottom > nb.top) out.push('⚠mascot overlaps nav');
    }
    w.scrollTo(0, 0); await wait(80);
    // small tap targets (mobile only)
    if (w.innerWidth < 600) {
      const small = all.filter(e => (e.tagName === 'BUTTON' || e.tagName === 'A' || e.tagName === 'INPUT' || e.tagName === 'SELECT') && visible(e, w) && !e.closest('[aria-hidden=true]')).filter(e => { const b = rect(e); return b.height < 40 || b.width < 40; });
      out.push('small targets(<40): ' + small.length + ' ' + small.slice(0, 8).map(e => label(e).slice(0, 18) + ' ' + Math.round(rect(e).width) + 'x' + Math.round(rect(e).height)).join(', '));
    }
    return out.join('\n');
  }
  // Freeze a rendered viewport of the frame into the board (computed styles inlined) so it can be captured.
  function cloneNode(src, fw, scrollY, isRoot) {
    if (src.nodeType === 3) return document.createTextNode(src.nodeValue);
    if (src.nodeType !== 1) return null;
    const tag = src.tagName.toLowerCase();
    if (['script', 'style', 'link', 'meta', 'iframe', 'noscript', 'template'].includes(tag)) return null;
    const cs = fw.getComputedStyle(src);
    if (cs.display === 'none') return null;
    const svg = src instanceof fw.SVGElement;
    const el = svg ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag.includes('-') || tag === 'helmet' ? 'div' : tag);
    for (const a of src.attributes) { if (a.name === 'style' || a.name === 'class' || a.name === 'id' || a.name.startsWith('on')) continue; try { el.setAttribute(a.name, a.value); } catch (e) {} }
    if (tag === 'img') el.src = src.currentSrc || src.src;
    if (tag === 'input') el.value = src.value;
    for (let i = 0; i < cs.length; i++) { const p = cs[i]; if (p.startsWith('animation') || p.startsWith('transition')) continue; el.style.setProperty(p, cs.getPropertyValue(p)); }
    el.style.setProperty('animation', 'none'); el.style.setProperty('transition', 'none');
    if (/auto|scroll/.test(cs.overflowX + cs.overflowY)) { el.style.overflowX = cs.overflowX === 'visible' ? 'visible' : 'hidden'; el.style.overflowY = cs.overflowY === 'visible' ? 'visible' : 'hidden'; el.style.scrollbarWidth = 'none'; }
    if (cs.position === 'sticky') {
      const b = src.getBoundingClientRect();
      const prev = src.style.position; src.style.position = 'static';
      const nb = src.getBoundingClientRect(); src.style.position = prev;
      el.style.position = 'relative'; el.style.top = (b.top - nb.top) + 'px'; el.style.zIndex = '40';
    } else if (cs.position === 'fixed') {
      const b = src.getBoundingClientRect();
      el.style.position = 'absolute'; el.style.top = (b.top + scrollY) + 'px'; el.style.left = b.left + 'px';
      el.style.right = 'auto'; el.style.bottom = 'auto'; el.style.transform = 'none'; el.style.margin = '0';
      el.style.width = b.width + 'px'; el.style.height = b.height + 'px'; el.style.boxSizing = 'border-box';
    }
    for (const c of src.childNodes) { const k = cloneNode(c, fw, scrollY); if (k) el.appendChild(k); }
    // Keep single-line text single-line in the frozen copy (guards against sub-pixel font differences).
    if (!svg && src.children.length === 0 && (src.textContent || '').trim()) {
      const rg = src.ownerDocument.createRange(); rg.selectNodeContents(src);
      const tops = new Set([...rg.getClientRects()].map(q => Math.round(q.top)));
      if (tops.size <= 1) el.style.whiteSpace = 'nowrap';
    }
    if (src.scrollLeft && el.style) el.dataset.sl = src.scrollLeft;
    return el;
  }
  window.qaSnap = async function (shots, h) {
    const frame = document.getElementById('qa');
    const wrap = document.getElementById('qa-snaps');
    wrap.innerHTML = '';
    document.getElementById('qa-out').textContent = 'snapping…';
    try { await Promise.all([400, 500, 600, 700, 800].map(x => document.fonts.load(x + ' 16px Manrope')).concat([document.fonts.load('700 16px Caveat')])); } catch (e) {}
    for (const s of shots) {
      const hh = s.h || h || 800;
      if (s.page === '__break') { const br = document.createElement('div'); br.style.cssText = 'flex-basis:100%;height:0'; wrap.appendChild(br); continue; }
      frame.style.width = s.w + 'px'; frame.style.height = hh + 'px';
      frame.src = s.page + '.dc.html';
      await new Promise(r => { frame.onload = r; });
      await wait(2200);
      const fd = frame.contentDocument, fw = frame.contentWindow;
      if (s.before) { try { await s.before(fd, fw); } catch (e) {} await wait(500); }
      const y = s.y === 'end' ? fd.documentElement.scrollHeight : (s.y || 0);
      fw.scrollTo(0, y); await wait(400);
      if (s.settle) await wait(s.settle);
      const sy = fw.scrollY;
      const card = document.createElement('div');
      card.style.cssText = 'display:flex;flex-direction:column;gap:6px;flex:none;';
      const cap = document.createElement('div');
      cap.textContent = s.label || (s.page + ' @' + s.w);
      cap.style.cssText = 'font:700 12px monospace;color:#ffc93c;';
      const vp = document.createElement('div');
      vp.style.cssText = 'position:relative;overflow:hidden;width:' + fd.documentElement.clientWidth + 'px;height:' + hh + 'px;border:1px solid #555;border-radius:12px;background:#130124;';
      const body = cloneNode(fd.body, fw, sy, true);
      body.style.position = 'absolute'; body.style.left = '0'; body.style.top = (-sy) + 'px'; body.style.width = fd.documentElement.clientWidth + 'px'; body.style.margin = '0';
      vp.appendChild(body);
      card.appendChild(cap); card.appendChild(vp); wrap.appendChild(card);
      vp.querySelectorAll('[data-sl]').forEach(n => { n.scrollLeft = +n.dataset.sl; });
    }
    document.getElementById('qa-out').textContent = 'SNAPS DONE';
  };
  window.qaWhy = function () {
    const f = document.getElementById('qa'), d = f.contentDocument;
    const b = d.querySelector('[data-support-mascot]'); if (!b) return 'no mascot';
    const r = b.getBoundingClientRect(); const pe = b.style.pointerEvents; b.style.pointerEvents = 'none';
    const out = [];
    for (const [fx, fy] of [[.1, .1], [.5, .5], [.9, .9], [.1, .9], [.9, .1]]) {
      const els = d.elementsFromPoint(r.left + r.width * fx, r.top + r.height * fy).slice(0, 4).map(e => e.tagName + (e.getAttribute('aria-label') ? '[' + e.getAttribute('aria-label') + ']' : '') + ':' + f.contentWindow.getComputedStyle(e).cursor + ':' + (e.textContent || '').trim().slice(0, 12));
      out.push(fx + ',' + fy + ' ' + els.join(' | '));
    }
    b.style.pointerEvents = pe;
    return 'op ' + f.contentWindow.getComputedStyle(b).opacity + '\n' + out.join('\n');
  };
  window.qaRun = async function (pages, widths, h) {
    const frame = document.getElementById('qa');
    const box = document.getElementById('qa-out');
    box.textContent = 'running…';
    const res = [];
    for (const p of pages) for (const wd of widths) {
      frame.style.width = wd + 'px'; frame.style.height = (h || 800) + 'px';
      frame.src = p + '.dc.html' + (p.includes('#') ? '' : '');
      await new Promise(r => { frame.onload = r; });
      await wait(1800);
      try { const t = await audit(frame); res.push('■ ' + p + ' @' + wd + ' ' + t.split('\n').filter((l, i) => i === 0 || /⚠|arrows visible: [1-9]|^end/.test(l)).join('\n  ')); } catch (e) { res.push('■ ' + p + ' @' + wd + ' ERROR ' + e.message); }
      box.textContent = res.join('\n\n');
    }
    box.textContent = res.join('\n\n') + '\n\nDONE';
  };
})();
