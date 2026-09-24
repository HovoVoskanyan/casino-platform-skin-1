// Internal QA: scripted journeys against the real pages inside the board's iframe.
(function () {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const F = () => document.getElementById('qa');
  const D = () => F().contentDocument, W = () => F().contentWindow;
  function load(url, w) {
    return new Promise(res => {
      const f = F(); f.style.width = (w || 390) + 'px'; f.style.height = '800px';
      f.onload = async () => { await wait(2600); res(); };
      f.onload = null; f.src = 'about:blank';
      setTimeout(() => { f.onload = async () => { await wait(2600); res(); }; f.src = url; }, 150);
    });
  }
  async function waitNav(ms) { await new Promise(r => { const f = F(); const t = setTimeout(r, ms || 4000); f.onload = () => { clearTimeout(t); setTimeout(r, 2600); }; }); }
  const q = s => D().querySelector(s), qa = s => [...D().querySelectorAll(s)];
  const btn = txt => qa('button,a').find(b => (b.textContent || '').trim() === txt && b.getBoundingClientRect().width > 0);
  const file = () => decodeURIComponent(W().location.pathname.split('/').pop()) + W().location.search + W().location.hash;
  const vis = e => !!e && e.getBoundingClientRect().width > 0;
  const hdrState = () => btn('Sign in') ? 'guest' : (qa('a[aria-label="My Account"]').find(vis) || {}).textContent;
  const res = [];
  const ok = (name, cond, info) => { res.push((cond ? 'PASS ' : 'FAIL ') + name + (info ? '  [' + info + ']' : '')); out(); };
  const out = () => { document.getElementById('qa-out').textContent = res.join('\n'); };

  window.qaPart = async function (width) {
    const w = width || 390;
    res.length = 0; res.push('Part @' + w); out();
    try { localStorage.setItem('chocho:previewSession', 'guest'); } catch (e) {}
    await load('ChoCho My Account.dc.html', w);
    ok('Guest direct entry: gate, no personal data, sign-in open', /Sign in to view My Account/.test(D().body.textContent) && !/Jaypee/.test(D().body.textContent) && qa('[data-reg-dialog]').length === 1, [/Sign in to view My Account/.test(D().body.textContent), /Jaypee/.test(D().body.textContent), qa('[data-reg-dialog]').length].join('/'));

    await load('ChoCho Games.dc.html?category=Slots', w);
    ok('Games ?category=Slots: honest notice', /“Slots” results aren’t connected/.test(D().body.textContent));
    const inp = qa('input').find(i => /search/i.test(i.placeholder || '')) || q('input');
    res.push('  input: ' + inp.placeholder);
    const setter = Object.getOwnPropertyDescriptor(W().HTMLInputElement.prototype, 'value').set;
    setter.call(inp, 'anubis'); inp.dispatchEvent(new (W().Event)('input', { bubbles: true })); await wait(500);
    const gridNames = () => { const h = qa('span').find(s => s.textContent.trim() === 'All Games' && s.getAttribute('style') && /scroll-margin/.test(s.getAttribute('style'))); const sec = h && h.closest('section'); return sec ? [...sec.querySelectorAll('span')].filter(s => /font-weight: 800/.test(s.getAttribute('style') || '') && s.children.length === 0).map(s => s.textContent.trim()) : []; };
    const gt = () => { const h = qa('span').find(s => s.textContent.trim() === 'All Games' && /scroll-margin/.test(s.getAttribute('style') || '')); return h ? h.closest('section').textContent : ''; };
    ok('Search filters the grid', /Hand of Anubis/.test(gt()) && !/Book of Dead/.test(gt()), gt().slice(0, 120));
    ok('Search kept in URL', /q=anubis/.test(file()), file());
    setter.call(inp, ''); inp.dispatchEvent(new (W().Event)('input', { bubbles: true })); await wait(400);
    const sb = qa('div').find(d => d.getAttribute('style') && /cursor: pointer/.test(d.getAttribute('style')) && /^Sweet Bonanza/.test((d.textContent || '').trim().replace(/[♥♡]/g, '').trim()));
    if (sb) sb.click();
    await waitNav(5000);
    ok('Sweet Bonanza card opens game detail', /Sweet Bonanza/.test(file()), file());
    const back = qa('button,a').find(b => /Back/.test(b.textContent) && vis(b));
    if (back) back.click();
    await waitNav(5000);
    ok('Game Back returns to originating Games view', /Games/.test(file()) && /category=Slots/.test(file()), file());


    await load('ChoCho Home.dc.html', w);
    const card = qa('[data-promo="reload"]')[0]; card.click();
    await waitNav(5000);
    const titles = qa('span').filter(s => ['Welcome Bonus','Reload Bonus','Weekly Cashback','Deposit Boost','Free Spins','VIP Rewards'].includes(s.textContent.trim())).map(s => s.textContent.trim());
    ok('Home Reload card → Promotions filtered', /Promotions/.test(file()) && titles.includes('Reload Bonus') && !titles.includes('Weekly Cashback'), file() + ' ' + titles.join(','));


    res.push('DONE'); out();
  };

  window.qaJourneys = async function (width) {
    const w = width || 390;
    res.length = 0; res.push('Journeys @' + w + 'px'); out();
    try { localStorage.setItem('chocho:previewSession', 'guest'); sessionStorage.removeItem('chocho:returnTo'); } catch (e) {}

    await load('ChoCho Home.dc.html', w);
    ok('Home: one header, footer, bottom nav, mascot', qa('header.chocho-hd').length === 1 && qa('footer').length === 1 && qa('.chocho-bn').length === 1 && qa('[data-support-mascot]').length <= 1, [qa('header.chocho-hd').length, qa('footer').length, qa('.chocho-bn').length, qa('[data-support-mascot]').length].join('/'));
    ok('Home: guest header', hdrState() === 'guest');
    btn('Sign in').click(); await wait(500);
    ok('Sign in opens one dialog in signin mode', qa('[data-reg-dialog]').length === 1 && /welcome back/i.test(q('[data-reg-dialog]').textContent));
    D().dispatchEvent(new (W().KeyboardEvent)('keydown', { key: 'Escape', bubbles: true })); await wait(400);
    ok('Escape closes dialog, still on Home', qa('[data-reg-dialog]').length === 0 && /Home/.test(file()), file());
    btn('Register').click(); await wait(500);
    ok('Register reopens without reload (register mode)', qa('[data-reg-dialog]').length === 1 && /create your/i.test(q('[data-reg-dialog]').textContent));
    D().dispatchEvent(new (W().KeyboardEvent)('keydown', { key: 'Escape', bubbles: true })); await wait(400);
    ok('Scroll not locked after close', W().getComputedStyle(D().body).overflow !== 'hidden' && W().getComputedStyle(D().documentElement).overflow !== 'hidden');

    const bnWallet = qa('.chocho-bn button').find(b => /Wallet/.test(b.textContent));
    bnWallet.click(); await wait(600);
    ok('Guest bottom-nav Wallet → sign-in over Home, no navigation', qa('[data-reg-dialog]').length === 1 && /Home/.test(file()), file() + ' rt=' + sessionStorage.getItem('chocho:returnTo'));
    W().ChoChoSite.setSession('signed-in');
    await waitNav(5000);
    ok('Selecting signed-in preview continues to retained Wallet', /Wallet/.test(file()), file());
    ok('Wallet: authed header initials JR', hdrState() === 'JR', hdrState());
    ok('Wallet: personal content visible', /WALLET BALANCE/.test(D().body.textContent) && !/Sign in to view your Wallet/.test(D().body.textContent));
    const dets = qa('button').filter(b => b.textContent.trim() === 'View details' && vis(b));
    if (dets[0]) { dets[0].click(); await wait(500); }
    ok('Transaction details opens', !!q('[data-tx-detail], [role="dialog"][aria-modal="true"]'));
    W().ChoChoSite.setSession('guest'); await wait(700);
    ok('Switch to guest while mounted: gate + guest header + detail closed', /Sign in to view your Wallet/.test(D().body.textContent) && !/WALLET BALANCE/.test(D().body.textContent) && hdrState() === 'guest' && !q('[role="dialog"][aria-modal="true"]:not([data-reg-dialog])'), hdrState());

    W().ChoChoSite.setSession('signed-in');
    await load('ChoCho Wallet.dc.html#deposit', w);
    ok('Wallet#deposit shows Deposit state', /Deposits are currently unavailable/.test(D().body.textContent));

    await load('ChoCho My Account.dc.html', w);
    ok('My Account: header JR matches profile', hdrState() === 'JR' && /Jaypee/.test(D().body.textContent), hdrState());
    const bal = qa('[data-balance-trigger]').find(vis);
    if (bal) { bal.click(); await wait(1200); }
    ok('Header balance dropdown opens in place', !!q('[data-balance-panel]') && /My Account/.test(file()));
    const vb = btn('View my bonuses'); if (vb) { vb.click(); await wait(1500); }
    ok('Personal bonuses drawer opens', !!q('[data-bonus-drawer]') && /Weekend Reload/.test(q('[data-bonus-drawer]').textContent));
    D().dispatchEvent(new (W().KeyboardEvent)('keydown', { key: 'Escape', bubbles: true })); await wait(400);
    ok('Drawer closes', !q('[data-bonus-drawer]'));
    const tb = qa('[role=tab]').find(t => t.textContent.trim() === 'Bonuses'); if (tb) { tb.click(); await wait(1500); }
    ok('My Account → Bonuses tab shows same bonuses', /Weekend Reload/.test((q('#panel-bonuses') || {}).textContent || ''));

    try { localStorage.setItem('chocho:previewSession', 'guest'); } catch (e) {}
    await load('ChoCho My Account.dc.html', w);
    ok('Guest direct entry: gate, no personal data, sign-in open', /Sign in to view My Account/.test(D().body.textContent) && !/Jaypee/.test(D().body.textContent) && qa('[data-reg-dialog]').length === 1, [/Sign in to view My Account/.test(D().body.textContent), /Jaypee/.test(D().body.textContent), qa('[data-reg-dialog]').length].join('/'));

    await load('ChoCho Games.dc.html?category=Slots', w);
    ok('Games ?category=Slots: honest notice', /“Slots” results aren’t connected/.test(D().body.textContent));
    const inp = qa('input').find(i => /search/i.test(i.placeholder || '')) || q('input');
    res.push('  input: ' + inp.placeholder);
    const setter = Object.getOwnPropertyDescriptor(W().HTMLInputElement.prototype, 'value').set;
    setter.call(inp, 'anubis'); inp.dispatchEvent(new (W().Event)('input', { bubbles: true })); await wait(500);
    const gridNames = () => { const h = qa('span').find(s => s.textContent.trim() === 'All Games' && s.getAttribute('style') && /scroll-margin/.test(s.getAttribute('style'))); const sec = h && h.closest('section'); return sec ? [...sec.querySelectorAll('span')].filter(s => /font-weight: 800/.test(s.getAttribute('style') || '') && s.children.length === 0).map(s => s.textContent.trim()) : []; };
    const gt = () => { const h = qa('span').find(s => s.textContent.trim() === 'All Games' && /scroll-margin/.test(s.getAttribute('style') || '')); return h ? h.closest('section').textContent : ''; };
    ok('Search filters the grid', /Hand of Anubis/.test(gt()) && !/Book of Dead/.test(gt()));
    ok('Search kept in URL', /q=anubis/.test(file()), file());
    setter.call(inp, ''); inp.dispatchEvent(new (W().Event)('input', { bubbles: true })); await wait(400);
    const sb = qa('div').find(d => d.getAttribute('style') && /cursor: pointer/.test(d.getAttribute('style')) && /^Sweet Bonanza/.test((d.textContent || '').trim().replace(/[♥♡]/g, '').trim()));
    if (sb) sb.click();
    await waitNav(5000);
    ok('Sweet Bonanza card opens game detail', /Sweet Bonanza/.test(file()), file());
    const back = qa('button,a').find(b => /Back/.test(b.textContent) && vis(b));
    if (back) back.click();
    await waitNav(5000);
    ok('Game Back returns to originating Games view', /Games/.test(file()) && /category=Slots/.test(file()), file());

    await load('ChoCho Home.dc.html#wheel', w);
    ok('Home#wheel opens Lucky Wheel', !!q('#home-wheel-title'));
    btn('Spin').click(); await wait(400);
    ok('Spin gives no prize', /no prize was awarded/.test(D().body.textContent) && !/You won/.test(D().body.textContent));
    q('button[aria-label="Close Lucky Wheel"]').click(); await wait(300);
    ok('Wheel closes', !q('#home-wheel-title'));
    const sup = qa('footer a').find(a => a.textContent.trim() === 'Support');
    sup.click(); await wait(500);
    ok('Footer Support opens shared support', !!q('[role=dialog][aria-label="ChoCho support"]'));
    q('button[aria-label="Close support"]').click(); await wait(400);
    ok('Support closes', !q('[role=dialog][aria-label="ChoCho support"]'));
    const terms = qa('footer a').find(a => a.textContent.trim() === 'Terms'); terms.click(); await wait(400);
    ok('Footer Terms → truthful notice, no jump', /Terms isn’t available/.test(D().body.textContent) && W().location.hash === '');
    const card = qa('[data-promo="reload"]')[0]; card.click();
    await waitNav(5000);
    const titles = qa('span').filter(s => ['Welcome Bonus','Reload Bonus','Weekly Cashback','Deposit Boost','Free Spins','VIP Rewards'].includes(s.textContent.trim())).map(s => s.textContent.trim());
    ok('Home Reload card → Promotions filtered', /Promotions/.test(file()) && titles.includes('Reload Bonus') && !titles.includes('Weekly Cashback'), file() + ' ' + titles.join(','));

    await load('ChoCho Registration.dc.html#register', w);
    await wait(2500);
    ok('Old Registration link → Home with register dialog', /Home/.test(file()) && qa('[data-reg-dialog]').length === 1, file());
    res.push('DONE'); out();
  };
})();
