// Internal QA: checks Wallet transaction cards for overlap/clipping at several widths.
window.qaWallet = function (widths) {
  const o = document.getElementById('qa-out'), f = document.getElementById('qa');
  document.getElementById('qa-snaps').style.display = 'none';
  o.style.display = 'block'; o.textContent = 'running';
  const out = [];
  const vis = (e, w) => w.getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 1 && !/clip: rect/.test(e.getAttribute('style') || '');
  const step = i => {
    if (i >= widths.length) { o.textContent = out.join('\n') + '\nDONE'; return; }
    f.style.width = widths[i] + 'px'; f.style.height = '800px';
    f.onload = () => setTimeout(() => {
      try {
        const d = f.contentDocument, w = f.contentWindow;
        const list = d.querySelector('[aria-label="Recent transactions"]');
        if (!list) { out.push(widths[i] + ': no list'); return step(i + 1); }
        // longer amount on the first card
        const amt = [...list.querySelectorAll('span')].find(s => s.textContent.includes('Amount: ') && s.children.length === 1) || [...list.querySelectorAll('span')].find(s => /₱/.test(s.textContent) && s.children.length === 0);
        if (amt && amt.lastChild && amt.lastChild.nodeType === 3) amt.lastChild.nodeValue = '+₱1,250,480.50';
        setTimeout(() => {
          const cards = [...list.children].filter(c => c.getAttribute('aria-hidden') !== 'true' && c.getBoundingClientRect().height > 0);
          const issues = [];
          cards.forEach((c, ci) => {
            const cb = c.getBoundingClientRect();
            const leaves = [...c.querySelectorAll('span,button')].filter(e => vis(e, w) && (e.tagName === 'BUTTON' || [...e.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim())));
            leaves.forEach(e => { const b = e.getBoundingClientRect(); if (b.right > cb.right + 1 || b.left < cb.left - 1) issues.push('c' + ci + ' outside:' + e.textContent.trim().slice(0, 14)); });
            for (let a = 0; a < leaves.length; a++) for (let b = a + 1; b < leaves.length; b++) {
              if (leaves[a].contains(leaves[b]) || leaves[b].contains(leaves[a])) continue;
              const x = leaves[a].getBoundingClientRect(), y = leaves[b].getBoundingClientRect();
              if (x.left < y.right - 1 && y.left < x.right - 1 && x.top < y.bottom - 1 && y.top < x.bottom - 1) issues.push('c' + ci + ' overlap:' + leaves[a].textContent.trim().slice(0, 12) + '×' + leaves[b].textContent.trim().slice(0, 12));
            }
          });
          const statuses = [...new Set([...list.querySelectorAll('span')].map(s => s.textContent.trim().replace('Status: ', '')).filter(t => /^(COMPLETED|PENDING|FAILED|PROCESSING|CANCELLED|Completed|Pending|Failed|Processing|Cancelled)$/i.test(t)))];
          let align = '';
          const hdr = list.firstElementChild;
          if (w.getComputedStyle(hdr).display === 'grid') {
            const hc = [...hdr.children].map(c => Math.round(c.getBoundingClientRect().left));
            const rows = cards.filter(c => w.getComputedStyle(c).display === 'grid');
            // last column: button is right-aligned in its cell, so compare right edges there
            const edge = (c, k, n) => Math.round(k === n - 1 ? c.getBoundingClientRect().right : c.getBoundingClientRect().left);
            const hcE = [...hdr.children].map((c, k, a) => edge(c, k, a.length));
            const bad = rows.filter(r => [...r.children].map((c, k, a) => edge(c, k, a.length)).some((x, k) => Math.abs(x - hcE[k]) > 1)).length;
            align = ' hdrCols=' + hc.join(',') + ' misalignedRows=' + bad + '/' + rows.length + ' row1=' + (rows[1] ? [...rows[1].children].map(c => Math.round(c.getBoundingClientRect().left)).join(',') + ' hdrPad=' + w.getComputedStyle(hdr).padding + ' rowPad=' + w.getComputedStyle(rows[1]).padding + ' hdrGap=' + w.getComputedStyle(hdr).columnGap + ' rowGap=' + w.getComputedStyle(rows[1]).columnGap + ' hdrTpl=' + w.getComputedStyle(hdr).gridTemplateColumns + ' rowTpl=' + w.getComputedStyle(rows[1]).gridTemplateColumns : '');
          }
          out.push(widths[i] + 'px:' + align + ' listW=' + Math.round(list.getBoundingClientRect().width) + ' dateLines=' + (() => { const ds = [...list.querySelectorAll('span')].filter(s => /\d{4}/.test(s.textContent) && s.children.length === 2 && s.textContent.includes('·') && s.getBoundingClientRect().width > 0); return ds.map(s => { const rg = d.createRange(); rg.selectNodeContents(s); return new Set([...rg.getClientRects()].map(q => Math.round(q.top))).size; }).join(','); })() + ' cards=' + cards.length + ' layout=' + (cards[0] ? w.getComputedStyle(cards[0]).display : '-') + ' headerRow=' + w.getComputedStyle(list.firstElementChild).display + ' docSW=' + d.documentElement.scrollWidth + ' statuses=' + statuses.join('/') + ' issues=' + (issues.length ? issues.slice(0, 6).join('; ') : 'none'));
        }, 300);
      } catch (e) { out.push(widths[i] + ' ERR ' + e.message); }
      setTimeout(() => { o.textContent = out.join('\n'); step(i + 1); }, 700);
    }, 2600);
    f.src = 'ChoCho Wallet.dc.html?w=' + widths[i];
  };
  step(0);
};
