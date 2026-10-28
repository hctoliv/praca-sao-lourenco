(() => {
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const map = (v, a, b) => clamp((v - a) / (b - a));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;

/* intro, uma vez por sessão (?intro força) */
let seen = false;
try { seen = sessionStorage.getItem('praca-intro') === '1'; } catch (e) {}
if (location.search.includes('intro')) seen = false;
if (!seen && !reduce) {
  root.classList.add('intro-on');
  const done = () => { root.classList.add('intro-done'); try { sessionStorage.setItem('praca-intro', '1'); } catch (e) {} };
  setTimeout(done, 2300);
  $('#intro').addEventListener('click', done);
  addEventListener('keydown', done, { once: true });
}

/* horário de funcionamento (hora de São Paulo) */
const HOURS = { 0: [[12, 16]], 1: [], 2: [[12, 15], [18, 22]], 3: [[12, 15], [18, 22]], 4: [[12, 15], [18, 22]], 5: [[12, 15], [18, 22]], 6: [[12, 16], [18, 22.5]] };
const fmt = h => { const m = Math.round((h % 1) * 60); return Math.floor(h) + 'h' + (m ? String(m).padStart(2, '0') : ''); };
function spNow() {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date());
  const g = t => p.find(x => x.type === t).value;
  const d = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(g('weekday'));
  return { d, h: (+g('hour') % 24) + (+g('minute')) / 60 };
}
function status() {
  const { d, h } = spNow();
  let open = false, txt = '';
  const today = HOURS[d];
  const cur = today.find(([a, b]) => h >= a && h < b);
  if (cur) { open = true; txt = 'aberto agora · até ' + fmt(cur[1]); }
  else {
    const next = today.find(([a]) => h < a);
    if (next) txt = 'fechado · abre às ' + fmt(next[0]);
    else {
      for (let i = 1; i <= 7; i++) {
        const nd = (d + i) % 7;
        if (HOURS[nd].length) { txt = 'fechado · abre ' + (i === 1 ? 'amanhã' : ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][nd]) + ' às ' + fmt(HOURS[nd][0][0]); break; }
      }
    }
  }
  $$('[data-status]').forEach(el => { el.classList.toggle('is-open', open); el.querySelector('span').textContent = txt; });
  $$('#hours tr').forEach(tr => tr.classList.toggle('today', tr.dataset.d.split(' ').includes(String(d))));
}
status(); setInterval(status, 60000);

/* header + menu */
const hd = $('#hd'), burger = $('#burger');
burger.addEventListener('click', () => {
  const o = !root.classList.contains('menu-open');
  root.classList.toggle('menu-open', o); burger.setAttribute('aria-expanded', o);
});
$$('#nav a').forEach(a => a.addEventListener('click', () => { root.classList.remove('menu-open'); burger.setAttribute('aria-expanded', false); }));

/* palavras do manifesto */
$$('[data-words]').forEach(el => {
  el.innerHTML = el.textContent.trim().split(/\s+/).map(w => `<span class="w">${w}</span>`).join(' ');
});
const words = $$('.manifest .w');

/* reveals */
$$('.collage__text, .facts li, .cozinha__head > div, .dish, .bar__intro > *, .drinks__menu, .vinhos > *, .eventos__head, .space, .fda__in > *, .visite__in > *').forEach(el => el.classList.add('rv'));
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
$$('.rv').forEach(el => io.observe(el));

/* contadores */
const cio = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return; cio.unobserve(e.target);
  const el = e.target, to = +el.dataset.count, t0 = performance.now();
  const step = t => { const k = clamp((t - t0) / 1600); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))).toLocaleString('pt-BR'); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}), { threshold: .6 });
$$('[data-count]').forEach(el => cio.observe(el));

/* vídeos: tocam só perto da tela */
const vio = new IntersectionObserver(es => es.forEach(e => {
  const v = e.target;
  if (e.isIntersecting) { if (v.preload === 'none') v.preload = 'auto'; v.play().catch(() => {}); } else v.pause();
}), { rootMargin: '200px' });
$$('video[data-auto]').forEach(v => vio.observe(v));

/* canvas helper: só anima quando visível */
function canvasLoop(cv, init, draw) {
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1, vis = false, raf = 0, state;
  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state = init(W, H, state);
  };
  const tick = t => { draw(ctx, W, H, t, state); if (vis) raf = requestAnimationFrame(tick); };
  new IntersectionObserver(es => {
    vis = es[0].isIntersecting;
    if (vis) { if (!W) resize(); cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); }
  }).observe(cv);
  addEventListener('resize', () => { if (W) resize(); });
  return { get state() { return state; } };
}

/* vaga-lumes na hero */
canvasLoop($('#fireflies'), (W, H) => Array.from({ length: Math.round(W * H / 26000) }, () => ({
  x: Math.random() * W, y: Math.random() * H, r: .8 + Math.random() * 2.2, a: Math.random() * 6.28, s: .15 + Math.random() * .35, ph: Math.random() * 6.28
})), (c, W, H, t, ps) => {
  c.clearRect(0, 0, W, H);
  for (const p of ps) {
    p.a += (Math.random() - .5) * .2; p.x += Math.cos(p.a) * p.s; p.y += Math.sin(p.a) * p.s - .05;
    if (p.x < -10) p.x = W + 10; if (p.x > W + 10) p.x = -10; if (p.y < -10) p.y = H + 10; if (p.y > H + 10) p.y = -10;
    const k = .35 + .65 * Math.max(0, Math.sin(t / 900 + p.ph));
    const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
    g.addColorStop(0, `rgba(255,214,140,${.9 * k})`); g.addColorStop(.25, `rgba(255,190,100,${.35 * k})`); g.addColorStop(1, 'rgba(255,180,90,0)');
    c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, p.r * 6, 0, 6.29); c.fill();
  }
});

/* brasas na cozinha */
canvasLoop($('#embers'), (W, H) => Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: .3 + Math.random() * 1.1, r: .6 + Math.random() * 1.8, w: Math.random() * 6.28, l: Math.random() })),
(c, W, H, t, ps) => {
  c.clearRect(0, 0, W, H);
  for (const p of ps) {
    p.y -= p.v; p.w += .03; p.x += Math.sin(p.w) * .5; p.l -= .0016;
    if (p.y < -10 || p.l <= 0) { p.y = H + 10; p.x = Math.random() * W; p.l = 1; }
    c.fillStyle = `rgba(255,${120 + 80 * p.l | 0},40,${.75 * p.l})`;
    c.shadowColor = 'rgba(255,120,30,.9)'; c.shadowBlur = 8;
    c.beginPath(); c.arc(p.x, p.y, p.r, 0, 6.29); c.fill();
  }
  c.shadowBlur = 0;
});

/* luzinhas do fim de ano */
canvasLoop($('#twinkle'), (W, H) => Array.from({ length: 90 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: .6 + Math.random() * 1.6, ph: Math.random() * 6.28, sp: .5 + Math.random() * 1.5 })),
(c, W, H, t, ps) => {
  c.clearRect(0, 0, W, H);
  for (const p of ps) {
    const k = Math.max(0, Math.sin(t / 1000 * p.sp + p.ph));
    c.fillStyle = `rgba(255,220,150,${k * .9})`;
    c.beginPath(); c.arc(p.x, p.y, p.r * (1 + k), 0, 6.29); c.fill();
    if (k > .9) { c.strokeStyle = `rgba(255,230,170,${(k - .9) * 6})`; c.lineWidth = .6; c.beginPath(); c.moveTo(p.x - 8, p.y); c.lineTo(p.x + 8, p.y); c.moveTo(p.x, p.y - 8); c.lineTo(p.x, p.y + 8); c.stroke(); }
  }
});

/* lago das carpas */
const pond = $('#pond');
const pointer = { x: -1, y: -1, t: 0 };
const ripples = [];
const KOI = [
  ['#f2f0ea', '#e8642c', '#e8642c', '#f2f0ea', '#f2f0ea', '#e8642c', '#f2f0ea'],
  ['#ef7b2a', '#ef7b2a', '#f6a443', '#ef7b2a', '#f6a443', '#ef7b2a', '#ef7b2a'],
  ['#f4f1e8', '#f4f1e8', '#222', '#d9452b', '#f4f1e8', '#222', '#f4f1e8'],
  ['#f7c35a', '#f7c35a', '#f2d78a', '#f7c35a', '#f2d78a', '#f7c35a', '#f7c35a'],
  ['#e9e6dc', '#c93a24', '#e9e6dc', '#e9e6dc', '#c93a24', '#c93a24', '#e9e6dc'],
  ['#2c2c2a', '#e8642c', '#2c2c2a', '#2c2c2a', '#f2f0ea', '#2c2c2a', '#2c2c2a']
];
canvasLoop(pond, (W, H, prev) => {
  const n = W < 700 ? 7 : 11, S = W < 700 ? .8 : 1;
  const fish = Array.from({ length: n }, (_, i) => {
    const x = Math.random() * W, y = Math.random() * H, a = Math.random() * 6.28;
    const len = (46 + Math.random() * 34) * S;
    return { x, y, a, v: .6 + Math.random() * .5, len, col: KOI[i % KOI.length], seg: Array.from({ length: 10 }, () => ({ x, y })), wob: Math.random() * 6, turn: 0 };
  });
  const pads = Array.from({ length: W < 700 ? 4 : 7 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: (30 + Math.random() * 46) * S, a: Math.random() * 6.28, s: (Math.random() - .5) * .0008 }));
  const lights = Array.from({ length: 14 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: 80 + Math.random() * 160, ph: Math.random() * 6.28 }));
  return { fish, pads, lights };
}, (c, W, H, t, S) => {
  // água
  const g = c.createRadialGradient(W * .5, H * .45, 0, W * .5, H * .5, Math.max(W, H) * .75);
  g.addColorStop(0, '#1d3b30'); g.addColorStop(.6, '#11261f'); g.addColorStop(1, '#08130f');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // luz no fundo
  c.globalCompositeOperation = 'lighter';
  for (const l of S.lights) {
    const k = .5 + .5 * Math.sin(t / 2400 + l.ph);
    const lx = l.x + Math.sin(t / 3000 + l.ph) * 30, ly = l.y + Math.cos(t / 3600 + l.ph) * 20;
    const rg = c.createRadialGradient(lx, ly, 0, lx, ly, l.r);
    rg.addColorStop(0, `rgba(120,170,120,${.06 * k})`); rg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = rg; c.fillRect(lx - l.r, ly - l.r, l.r * 2, l.r * 2);
  }
  c.globalCompositeOperation = 'source-over';

  const hasP = pointer.x >= 0 && t - pointer.t < 4000;
  // carpas
  for (const f of S.fish) {
    let tx, ty, want;
    if (hasP) { tx = pointer.x; ty = pointer.y; }
    if (hasP && Math.hypot(tx - f.x, ty - f.y) < Math.max(W, H) * .6) {
      want = Math.atan2(ty - f.y, tx - f.x) + Math.sin(t / 700 + f.wob) * .5;
      f.v = lerp(f.v, Math.hypot(tx - f.x, ty - f.y) < 60 ? .5 : 1.7, .03);
    } else {
      f.turn += (Math.random() - .5) * .06; f.turn *= .96;
      want = f.a + f.turn;
      f.v = lerp(f.v, .7, .01);
    }
    const m = 80;
    if (f.x < m) want = lerp(want, 0, .1); if (f.x > W - m) want = Math.PI;
    if (f.y < m) want = Math.PI / 2; if (f.y > H - m) want = -Math.PI / 2;
    for (const o of S.fish) { if (o === f) continue; const d = Math.hypot(o.x - f.x, o.y - f.y); if (d < f.len * .8) want = Math.atan2(f.y - o.y, f.x - o.x); }
    let da = ((want - f.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    f.a += clamp(da, -.045, .045);
    f.x += Math.cos(f.a) * f.v; f.y += Math.sin(f.a) * f.v;
    // espinha
    const sl = f.len / f.seg.length, sw = Math.sin(t / (140 / f.v) + f.wob) * .22;
    f.seg[0].x = f.x; f.seg[0].y = f.y;
    for (let i = 1; i < f.seg.length; i++) {
      const p = f.seg[i - 1], s = f.seg[i];
      const ang = Math.atan2(s.y - p.y, s.x - p.x) + sw * (i / f.seg.length) * .4;
      s.x = p.x + Math.cos(ang) * sl; s.y = p.y + Math.sin(ang) * sl;
    }
    // sombra
    c.fillStyle = 'rgba(0,0,0,.28)';
    for (let i = 0; i < f.seg.length; i++) { const s = f.seg[i], w = bodyW(i, f.len); c.beginPath(); c.arc(s.x + 8, s.y + 12, w, 0, 6.29); c.fill(); }
    // nadadeiras
    const s1 = f.seg[2], s0 = f.seg[1], fa = Math.atan2(s1.y - s0.y, s1.x - s0.x);
    c.fillStyle = 'rgba(245,235,220,.55)';
    for (const side of [-1, 1]) {
      c.save(); c.translate(s1.x, s1.y); c.rotate(fa + side * (1.9 + Math.sin(t / 200 + f.wob) * .25));
      c.beginPath(); c.ellipse(f.len * .12, 0, f.len * .14, f.len * .05, 0, 0, 6.29); c.fill(); c.restore();
    }
    // cauda
    const tl = f.seg[f.seg.length - 1], tp = f.seg[f.seg.length - 2], ta = Math.atan2(tl.y - tp.y, tl.x - tp.x);
    c.save(); c.translate(tl.x, tl.y); c.rotate(ta + Math.sin(t / 160 + f.wob) * .3);
    c.fillStyle = 'rgba(245,225,200,.6)';
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(f.len * .2, -f.len * .16, f.len * .26, -f.len * .1); c.quadraticCurveTo(f.len * .14, 0, f.len * .26, f.len * .1); c.quadraticCurveTo(f.len * .2, f.len * .16, 0, 0); c.fill(); c.restore();
    // corpo
    for (let i = f.seg.length - 1; i >= 0; i--) {
      const s = f.seg[i], w = bodyW(i, f.len);
      c.fillStyle = f.col[Math.min(f.col.length - 1, Math.floor(i / f.seg.length * f.col.length))];
      c.beginPath(); c.arc(s.x, s.y, w, 0, 6.29); c.fill();
    }
    // brilho
    c.fillStyle = 'rgba(255,255,255,.18)';
    c.beginPath(); c.arc(f.seg[1].x, f.seg[1].y, bodyW(1, f.len) * .5, 0, 6.29); c.fill();
  }
  // vitórias-régias
  for (const p of S.pads) {
    p.a += p.s; p.x += Math.sin(t / 5000 + p.r) * .08;
    c.save(); c.translate(p.x, p.y); c.rotate(p.a);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.arc(6, 10, p.r, .25, 6.03); c.lineTo(6, 10); c.fill();
    const lg = c.createRadialGradient(-p.r * .3, -p.r * .3, 0, 0, 0, p.r);
    lg.addColorStop(0, '#6f9a4e'); lg.addColorStop(1, '#3d6330');
    c.fillStyle = lg; c.beginPath(); c.arc(0, 0, p.r, .25, 6.03); c.lineTo(0, 0); c.fill();
    c.strokeStyle = 'rgba(20,40,15,.35)'; c.lineWidth = 1;
    for (let k = 0; k < 7; k++) { const a = .6 + k * .8; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * p.r * .9, Math.sin(a) * p.r * .9); c.stroke(); }
    c.restore();
  }
  // ondas
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i], age = (t - r.t) / 1600;
    if (age > 1) { ripples.splice(i, 1); continue; }
    for (let k = 0; k < 3; k++) {
      const a = age - k * .12; if (a <= 0) continue;
      c.strokeStyle = `rgba(220,235,210,${(1 - a) * .45 * r.s})`; c.lineWidth = 1.4;
      c.beginPath(); c.ellipse(r.x, r.y, a * 120 * r.s, a * 84 * r.s, 0, 0, 6.29); c.stroke();
    }
  }
});
function bodyW(i, len) { const k = i / 9; return len * (.13 * Math.sin(Math.PI * Math.min(1, .25 + k * .85)) + .015); }
let lastRip = 0;
function poke(e, strong) {
  const r = pond.getBoundingClientRect();
  const p = e.touches ? e.touches[0] : e;
  pointer.x = p.clientX - r.left; pointer.y = p.clientY - r.top; pointer.t = performance.now();
  if (strong || pointer.t - lastRip > 260) { ripples.push({ x: pointer.x, y: pointer.y, t: pointer.t, s: strong ? 1.4 : .6 }); lastRip = pointer.t; }
}
pond.addEventListener('pointermove', e => poke(e));
pond.addEventListener('pointerdown', e => poke(e, true));
pond.addEventListener('touchstart', e => poke(e, true), { passive: true });

/* bar: coquetéis com filtro de sabor */
const DRINKS = [
  ['Flor de Eli', 53, 'Bem-me-quer amburana fernet, mel e alecrim, limão cravo e bitter de cacau.', 'cítrico + especiado', 'autoral'],
  ['Jardim Secreto', 56, 'Vodka Ketel One, limão siciliano, aquafaba e xarope de capim santo.', 'cítrico + refrescante', 'autoral'],
  ['Rabo de Galo', 53, 'Cachaça, vermute tinto, aperitivo de alcachofra e figo na lenha.', 'intenso + seco', ''],
  ['Renovação', 50, 'Rum, limão cravo, chá mate, folhas de hortelã e xarope de açúcar.', 'cítrico + herbal', ''],
  ['Espresso Martini', 56, 'Rum Havana 7 anos, duplo espresso, amarula e cacau.', 'intenso + aveludado', ''],
  ['Sombra Fresca', 44, 'Gim com infusão de chá preto, hibisco, bitter, limão siciliano, amaro, tônica e licor de sabugueiro.', 'floral + defumado', ''],
  ['Cajú Querido', 44, 'Primeiro Beijo, suco de cajú, limão siciliano e xarope de açúcar.', 'tropical + doce', ''],
  ['Penicillin', 53, 'Bourbon, white duck defumado, limão siciliano, xarope de mel e gengibre.', 'intenso + defumado', ''],
  ['Spritz', 53, 'Aperol, espumante, água com gás e laranja.', 'refrescante + amargo', ''],
  ['Caipirinha Seu Dino', 48, 'Cajú, gengibre e rapadura, com a cachaça ideal pra receita.', 'tropical + especiado', 'caipirinha'],
  ['Caipirinha Picada', 48, 'Limão taiti e capim santo.', 'cítrico + herbal', 'caipirinha'],
  ['Melina', 26, 'Calda de mel e alecrim, limão siciliano e água com gás.', 'herbal + refrescante', 'sem álcool'],
  ['Borbulha de Caju', 29, 'Suco de caju natural, limão siciliano, açúcar e água com gás.', 'tropical + refrescante', 'sem álcool'],
  ['Tônica com café', 29, 'Fava de baunilha, açúcar, limão siciliano, tônica premium e café coado.', 'vivaz + delicado', 'sem álcool'],
  ['Jardim Verde', 26, 'Xarope de capim santo, limão taiti e água de coco.', 'herbal + refrescante', 'sem álcool']
];
const dlist = $('#dlist');
dlist.innerHTML = DRINKS.map(([n, p, d, tag, k]) => `<li data-tags="${tag} ${k === 'sem álcool' ? 'sem' : ''}"><h4>${n}</h4><b>R$${p}</b><p>${d}</p><small>${tag}${k ? ' · ' + k : ''}</small></li>`).join('');
const photos = $$('#dphotos img');
$$('#chips button').forEach(b => b.addEventListener('click', () => {
  $$('#chips button').forEach(x => x.classList.toggle('is-on', x === b));
  const f = b.dataset.f;
  $$('#dlist li').forEach(li => li.classList.toggle('off', f !== '*' && !li.dataset.tags.includes(f)));
  const idx = { '*': 0, refrescante: 2, 'cítrico': 0, intenso: 1, herbal: 3, sem: 2 }[f] || 0;
  photos.forEach((im, i) => im.classList.toggle('is-on', i === idx));
}));
let pIdx = 0;
setInterval(() => {
  if (document.hidden || $('#chips .is-on').dataset.f !== '*') return;
  pIdx = (pIdx + 1) % photos.length; photos.forEach((im, i) => im.classList.toggle('is-on', i === pIdx));
}, 4200);

/* eventos: planejador */
const form = $('#planner'), guests = $('#guests'), gout = $('#gout'), hint = $('#phint');
function plan() {
  const n = +guests.value, tipo = form.tipo.value;
  gout.textContent = n >= 300 ? '300+' : n;
  let fits = 0;
  $$('.space').forEach(s => {
    const ok = s.dataset.for.split(' ').includes(tipo) && n <= +s.dataset.cap && n >= +(s.dataset.min || 0);
    s.classList.toggle('fit', ok); s.classList.toggle('dim', !ok); if (ok) fits++;
  });
  hint.textContent = fits
    ? `${fits} ${fits > 1 ? 'espaços recebem' : 'espaço recebe'} ${n} convidados para ${tipo === 'aniversário' ? 'um aniversário' : tipo === 'corporativo' ? 'um evento corporativo' : 'um ' + tipo}.`
    : `Para ${n} convidados a coordenação monta a casa sob medida. Chama no WhatsApp.`;
}
form.addEventListener('input', plan); plan();
form.addEventListener('submit', e => {
  e.preventDefault();
  const n = +guests.value, tipo = form.tipo.value;
  const esp = $$('.space.fit h3').map(h => h.textContent).join(', ');
  const tel = tipo === 'corporativo' ? '5511992461937' : '5511976921767';
  const msg = `Olá! Gostaria de falar com a coordenação de eventos do Praça São Lourenço. Estou planejando ${tipo === 'corporativo' ? 'um evento corporativo' : tipo === 'aniversário' ? 'um aniversário' : 'um ' + tipo} para cerca de ${n} convidados${esp ? ' (vi que ' + esp + ' pode atender)' : ''}.`;
  open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
});

/* contagem do réveillon */
const target = Date.parse('2027-01-01T00:00:00-03:00');
const cd = Object.fromEntries($$('[data-cd]').map(el => [el.dataset.cd, el]));
function countdown() {
  let s = Math.max(0, Math.floor((target - Date.now()) / 1000));
  const v = { d: Math.floor(s / 86400), h: Math.floor(s % 86400 / 3600), m: Math.floor(s % 3600 / 60), s: s % 60 };
  for (const k in v) cd[k].textContent = String(v[k]).padStart(2, '0');
}
countdown(); setInterval(countdown, 1000);

/* marquee: duplica para o loop */
const mq = $('#mq'); mq.innerHTML += mq.innerHTML;

/* scroll */
const hero = $('#inicio'), heroMask = $('.hero__mask'), heroPhoto = $('.hero__photo'), heroFull = $('.hero__full');
const heroA = $('.hero__a'), heroB = $('.hero__b'), heroHint = $('.hero__hint'), veil = $('.hero__veil');
const track = $('#track'), rail = $('#rail'), bar = $('#trackbar');
const dia = $('#dia'), sun = $('#sun'), hh = $('#hh'), mm = $('#mm'), sky = $('#sky');
const dDay = $('.dia__img--day'), dDusk = $('.dia__img--dusk'), dNight = $('.dia__img--night');
const panels = $$('.panel');
const pars = $$('[data-par]');
const fdaBg = $('.fda__bg');
let mx = 0, my = 0, cmx = 0, cmy = 0;
addEventListener('pointermove', e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; }, { passive: true });

function sizeTrack() {
  const extra = rail.scrollWidth - innerWidth;
  track.style.setProperty('--th', (innerHeight + Math.max(0, extra)) + 'px');
}
sizeTrack(); addEventListener('resize', sizeTrack); addEventListener('load', sizeTrack);

const prog = el => { const r = el.getBoundingClientRect(); return clamp(-r.top / (r.height - innerHeight)); };
const ease = t => t * t * t;
let lastY = 0;

function frame() {
  const y = scrollY, vh = innerHeight;
  cmx = lerp(cmx, mx, .06); cmy = lerp(cmy, my, .06);

  // header
  hd.classList.toggle('is-solid', y > vh * 2.2);
  hd.classList.toggle('is-hidden', y > lastY + 2 && y > vh * 2.6 && !root.classList.contains('menu-open'));
  if (y < lastY - 2) hd.classList.remove('is-hidden');
  lastY = y;

  // hero: entrar pela árvore
  const r = hero.getBoundingClientRect();
  if (r.bottom > 0) {
    const p = clamp(-r.top / (r.height - vh));
    const base = Math.min(innerWidth, vh) * .62;
    const s = base * (1 + ease(map(p, .02, .75)) * 46);
    heroMask.style.setProperty('--ms', s + 'px');
    heroMask.style.visibility = p > .8 ? 'hidden' : '';
    const z = 1.12 - .1 * map(p, 0, .8);
    heroPhoto.style.transform = `translate3d(${cmx * -24}px,${cmy * -18}px,0) scale(${z})`;
    heroFull.style.transform = heroPhoto.style.transform;
    heroFull.style.opacity = map(p, .5, .72);
    heroA.style.opacity = 1 - map(p, .04, .22);
    heroA.style.transform = `translateY(${-60 * map(p, 0, .3)}px)`;
    heroHint.style.opacity = 1 - map(p, .02, .1);
    veil.style.setProperty('--veil', map(p, .55, .85));
    heroB.style.opacity = map(p, .72, .9);
    heroB.style.transform = `translateY(${40 * (1 - map(p, .72, .95))}px)`;
  }

  // manifesto
  if (words.length) {
    const mr = words[0].parentElement.getBoundingClientRect();
    const k = map(vh * .8 - mr.top, 0, mr.height + vh * .35);
    const n = Math.round(k * words.length);
    words.forEach((w, i) => w.classList.toggle('on', i < n));
  }

  // parallax colagem
  for (const el of pars) {
    const b = el.getBoundingClientRect(); if (b.bottom < -200 || b.top > vh + 200) continue;
    const c = (b.top + b.height / 2 - vh / 2);
    el.style.transform = `translate3d(0,${c * +el.dataset.par}px,0)`;
  }

  // trilho horizontal
  const tp = prog(track);
  const extra = rail.scrollWidth - innerWidth;
  rail.style.transform = `translate3d(${-extra * tp}px,0,0)`;
  bar.style.transform = `scaleX(${tp})`;

  // do almoço ao jantar
  const dr = dia.getBoundingClientRect();
  if (dr.bottom > 0 && dr.top < vh) {
    const p = clamp(-dr.top / (dr.height - vh));
    const minutes = 12 * 60 + p * (10.5 * 60);
    const H = Math.floor(minutes / 60), M = Math.floor(minutes % 60 / 5) * 5;
    hh.textContent = String(H).padStart(2, '0'); mm.textContent = String(M).padStart(2, '0');
    const ang = Math.PI * (1 - p);
    sun.setAttribute('cx', 100 + Math.cos(ang) * 90); sun.setAttribute('cy', 100 - Math.sin(ang) * 90);
    sun.style.fill = p < .55 ? '#ffd27a' : p < .7 ? '#ff9a52' : '#f2efe0';
    sun.style.filter = p < .7 ? 'drop-shadow(0 0 10px #ffc35a)' : 'drop-shadow(0 0 8px #e9f0ff)';
    dDusk.style.opacity = map(p, .42, .6);
    dNight.style.opacity = map(p, .66, .82);
    const i = p < .3 ? 0 : p < .6 ? 1 : 2;
    panels.forEach((el, k) => el.classList.toggle('is-on', k === i));
  }

  // fundo do fim de ano
  const fr = fdaBg.parentElement.getBoundingClientRect();
  if (fr.bottom > 0 && fr.top < vh) fdaBg.style.transform = `translate3d(0,${(fr.top + fr.height / 2 - vh / 2) * -.12}px,0) scale(1.05)`;

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
})();
