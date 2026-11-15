// Gera as imagens SVG do README (tema aquário) a partir da API do GitHub.
// Uso: node scripts/generate.js   (Node 18+, sem dependências)
// Variáveis: GH_USER (padrão ph-fre1tas), GITHUB_TOKEN (necessário p/ contribuições), MOCK=1 (dados de teste)

const fs = require('fs');
const path = require('path');

const USER = process.env.GH_USER || 'ph-fre1tas';
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const OUT = path.join(__dirname, '..', 'assets');
const W = 900;
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const SANS = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const FISH_COLORS = ['#f7dc4a', '#2f7fd1', '#ff9a52', '#e86a8a', '#6fd3a1', '#a78bfa', '#4fd1e0', '#f2a65a'];
const LANG_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', CSS: '#a78bd8', HTML: '#e44d26',
  Python: '#3572a5', Java: '#b07219', 'C#': '#178600', C: '#888', 'C++': '#f34b7d',
  Shell: '#89e051', PHP: '#8892bf', Go: '#00add8', Rust: '#dea584', Vue: '#41b883',
};

// ---------- utilidades ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const pad = (n) => String(n).padStart(2, '0');
function rng(seed) { // gerador determinístico: o SVG só muda quando os dados mudam
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- dados ----------
async function gh(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      'User-Agent': 'aquarium-readme',
      Accept: 'application/vnd.github+json',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res;
}

function mockData() {
  const r = rng(7);
  const weeks = Array.from({ length: 53 }, () => Array.from({ length: 7 }, () => (r() < 0.35 ? Math.floor(r() * 7) : 0)));
  return {
    user: { name: 'Paulo Henrique', bio: 'JavaScript developer. Working on Node right now.', followers: 3, public_repos: 3 },
    avatar: null,
    repos: [
      { name: 'Node', description: 'estudos node.js', stargazers_count: 0, forks_count: 0, language: 'JavaScript' },
      { name: 'Calculadora-React', description: null, stargazers_count: 0, forks_count: 0, language: 'TypeScript' },
      { name: 'ph-fre1tas', description: null, stargazers_count: 0, forks_count: 0, language: null },
    ],
    langs: { JavaScript: 49, TypeScript: 41, CSS: 7, HTML: 3 },
    weeks,
  };
}

async function loadData() {
  if (process.env.MOCK === '1') return mockData();

  const user = await (await gh(`https://api.github.com/users/${USER}`)).json();
  const all = await (await gh(`https://api.github.com/users/${USER}/repos?per_page=100&type=owner`)).json();
  const repos = all.filter((r) => !r.fork);

  const langs = {};
  for (const r of repos) {
    try {
      const l = await (await gh(r.languages_url)).json();
      for (const [k, v] of Object.entries(l)) langs[k] = (langs[k] || 0) + v;
    } catch (e) { console.warn('languages:', r.name, e.message); }
  }

  let avatar = null;
  try {
    const url = user.avatar_url + (user.avatar_url.includes('?') ? '&' : '?') + 's=200';
    const res = await gh(url);
    const type = res.headers.get('content-type') || 'image/png';
    avatar = `data:${type};base64,` + Buffer.from(await res.arrayBuffer()).toString('base64');
  } catch (e) { console.warn('avatar:', e.message); }

  let weeks = Array.from({ length: 53 }, () => Array(7).fill(0));
  if (TOKEN) {
    try {
      const query = `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{weeks{contributionDays{contributionCount}}}}}}`;
      const res = await gh('https://api.github.com/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { login: USER } }),
      });
      const j = await res.json();
      weeks = j.data.user.contributionsCollection.contributionCalendar.weeks.map((w) => w.contributionDays.map((d) => d.contributionCount));
    } catch (e) { console.warn('contribuições:', e.message); }
  } else {
    console.warn('Sem GITHUB_TOKEN: contribuições ficarão zeradas.');
  }
  return { user, avatar, repos, langs, weeks };
}

// ---------- blocos visuais ----------
function fish(color, s = 1) {
  return `<g transform="scale(${s})">
    <path d="M-22 0 L-32 -9 L-32 9Z" fill="${color}"/>
    <path d="M-24 0 C-16 -13 8 -13 18 0 C8 13 -16 13 -24 0Z" fill="${color}"/>
    <path d="M-4 -9 L2 -17 L8 -9Z" fill="${color}" opacity=".85"/>
    <circle cx="10" cy="-2.5" r="2.4" fill="#fff"/><circle cx="10.7" cy="-2.5" r="1.2" fill="#0b1c2c"/>
  </g>`;
}

const svgWrap = (h, body, defs = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}" role="img">
<defs>
  <linearGradient id="card" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0f5176"/><stop offset="1" stop-color="#05202f"/></linearGradient>
  ${defs}
</defs>
${body}
</svg>`;

const cardBg = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="url(#card)" stroke="#1d4d68"/>
<rect x="${x + 14}" y="${y + 1.5}" width="${Math.round(w * 0.38)}" height="3" rx="1.5" fill="#7fa8c0" opacity=".55"/>`;

const label = (x, y, t) => `<text x="${x}" y="${y}" font-family="${MONO}" font-size="11" letter-spacing="2" fill="#4fd1e0">${esc(t)}</text>`;

// ---------- aquário ----------
function aquarium({ repos, weeks }) {
  const H = 340, sandY = 300;
  const r = rng(42);
  const flat = weeks.flat();
  const last30 = flat.slice(-30).reduce((a, b) => a + b, 0);

  // peixes = repositórios (maiores = mais estrelas)
  const sorted = [...repos].sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, 14);
  const fishSvg = sorted.map((repo, i) => {
    const size = 0.75 + Math.min(Math.sqrt(repo.stargazers_count), 8) * 0.18;
    const y = 55 + ((i * 53) % 170) + r() * 10;
    const dur = 26 + ((i * 7) % 16);
    const delay = -Math.round(r() * dur);
    const left = i % 2 === 1;
    const color = FISH_COLORS[i % FISH_COLORS.length];
    const flip = left ? '<g transform="scale(-1,1)">' + fish(color, size) + '</g>' : fish(color, size);
    return `<g transform="translate(0,${y.toFixed(1)})"><g class="${left ? 'swl' : 'swr'}" style="animation-duration:${dur}s;animation-delay:${delay}s"><g class="bob" style="animation-delay:${(-r() * 3).toFixed(1)}s">${flip}</g></g></g>`;
  }).join('\n');

  // alga = semanas de contribuição (últimas 45)
  const recent = weeks.slice(-45);
  const step = (W - 80) / (recent.length - 1 || 1);
  const weedSvg = recent.map((w, i) => {
    const total = w.reduce((a, b) => a + b, 0);
    const x = 40 + i * step;
    const h = total === 0 ? 12 : 26 + Math.min(total, 40) * 2.6;
    const lean = (i % 2 ? 1 : -1) * 6;
    const shade = total === 0 ? '#2b8a62' : '#3fbf86';
    return `<path class="sw" style="animation-delay:${(-(i % 7) * 0.6).toFixed(1)}s" d="M${x.toFixed(1)} ${sandY + 4} Q${(x + lean * 1.6).toFixed(1)} ${sandY - h * 0.5} ${(x - lean).toFixed(1)} ${sandY - h}" stroke="${shade}" stroke-width="${total === 0 ? 3 : 4.5}" stroke-linecap="round" fill="none"/>`;
  }).join('\n');

  // bolhas = contribuições dos últimos 30 dias (mín. 4 decorativas)
  const bubbleCount = Math.max(4, Math.min(last30, 30));
  const bubbleSvg = Array.from({ length: bubbleCount }, () => {
    const x = 30 + r() * (W - 60), size = 2 + r() * 3.5, dur = 7 + r() * 9, delay = -r() * dur;
    return `<circle class="bub" cx="${x.toFixed(1)}" cy="${sandY - 10}" r="${size.toFixed(1)}" style="animation-duration:${dur.toFixed(1)}s;animation-delay:${delay.toFixed(1)}s"/>`;
  }).join('\n');

  const rays = [90, 260, 470, 650].map((x, i) => `<polygon points="${x},0 ${x + 60},0 ${x + 200 - i * 20},${sandY} ${x - 40},${sandY}" fill="url(#ray)"/>`).join('');

  const defs = `<linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c3a5e"/><stop offset="1" stop-color="#041a2d"/></linearGradient>
  <linearGradient id="ray" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fd8ff" stop-opacity=".16"/><stop offset="1" stop-color="#9fd8ff" stop-opacity="0"/></linearGradient>
  <clipPath id="tank"><rect width="${W}" height="${H}" rx="18"/></clipPath>
  <style>
    .swr{animation:swr linear infinite}.swl{animation:swl linear infinite}
    @keyframes swr{from{transform:translateX(-70px)}to{transform:translateX(${W + 70}px)}}
    @keyframes swl{from{transform:translateX(${W + 70}px)}to{transform:translateX(-70px)}}
    .bob{animation:bob 3.2s ease-in-out infinite alternate}
    @keyframes bob{from{transform:translateY(-5px)}to{transform:translateY(5px)}}
    .sw{transform-box:fill-box;transform-origin:50% 100%;animation:sway 4.5s ease-in-out infinite alternate}
    @keyframes sway{from{transform:rotate(-5deg)}to{transform:rotate(5deg)}}
    .bub{fill:none;stroke:#bfe8ff;stroke-opacity:.55;stroke-width:1;animation:rise linear infinite}
    @keyframes rise{0%{transform:translateY(0);opacity:0}10%{opacity:1}100%{transform:translateY(-${sandY - 30}px);opacity:0}}
  </style>`;

  const body = `<g clip-path="url(#tank)">
  <rect width="${W}" height="${H}" fill="url(#water)"/>
  ${rays}
  ${bubbleSvg}
  ${fishSvg}
  <path d="M0 ${sandY + 6} Q220 ${sandY - 6} 450 ${sandY + 2} T${W} ${sandY - 2} L${W} ${H} L0 ${H}Z" fill="#7a6648"/>
  ${weedSvg}
  <path d="M0 ${sandY + 6} Q220 ${sandY - 6} 450 ${sandY + 2} T${W} ${sandY - 2} L${W} ${H} L0 ${H}Z" fill="#7a6648"/>
  <text x="24" y="34" font-family="${MONO}" font-size="12" letter-spacing="2" fill="#d6ecf7" fill-opacity=".85">AQUARIUM · @${esc(USER.toUpperCase())}</text>
  <text x="${W - 24}" y="${H - 14}" text-anchor="end" font-family="${MONO}" font-size="11" fill="#f1e9d8">fish = repos, by stars · seaweed = contributions · bubbles = last 30 days</text>
  </g>`;
  return svgWrap(H, body, defs);
}

// ---------- cartão do perfil ----------
function profile({ user, avatar, repos }) {
  const H = 190;
  const stars = repos.reduce((a, r) => a + r.stargazers_count, 0);
  const bio = trunc(user.bio || 'Developer.', 60);
  const av = avatar
    ? `<clipPath id="av"><circle cx="790" cy="95" r="50"/></clipPath>
       <image href="${avatar}" x="740" y="45" width="100" height="100" clip-path="url(#av)" preserveAspectRatio="xMidYMid slice"/>
       <circle cx="790" cy="95" r="52" fill="none" stroke="#4fd1e0" stroke-width="3"/>`
    : `<circle cx="790" cy="95" r="52" fill="#0b2c40" stroke="#4fd1e0" stroke-width="3"/>`;
  return svgWrap(H, `${cardBg(2, 2, W - 4, H - 4)}
  ${label(32, 48, 'TANK KEEPER')}
  <text x="32" y="92" font-family="${SANS}" font-size="32" font-weight="700" fill="#fff">${esc(user.name || USER)}</text>
  <text x="32" y="124" font-family="${SANS}" font-size="15" fill="#cfe3ee">${esc(bio)}</text>
  <text x="32" y="160" font-family="${MONO}" font-size="12" fill="#8fb4c8">${user.followers} followers · ${user.public_repos} repositories · ★ ${stars} stars</text>
  ${av}`);
}

// ---------- espécimes (repositórios) ----------
function specimens({ repos }) {
  const list = [...repos].sort((a, b) => b.stargazers_count - a.stargazers_count || 0).slice(0, 6);
  const cw = 440, ch = 130, gap = 16;
  const rows = Math.ceil(list.length / 2);
  const H = rows * ch + (rows - 1) * gap + 4;
  const cards = list.map((r, i) => {
    const x = 2 + (i % 2) * (cw + gap), y = 2 + Math.floor(i / 2) * (ch + gap);
    const lang = r.language;
    const dot = lang ? `<circle cx="${x + 130}" cy="${y + 104}" r="5" fill="${LANG_COLORS[lang] || '#9ab'}"/><text x="${x + 142}" y="${y + 108}" font-family="${MONO}" font-size="11" fill="#cfe3ee">${esc(lang)}</text>` : '';
    return `${cardBg(x, y, cw, ch)}
    ${label(x + 24, y + 38, 'SPECIMEN ' + pad(i + 1))}
    <g transform="translate(${x + cw - 50},${y + 34})">${fish(FISH_COLORS[i % FISH_COLORS.length], 0.9)}</g>
    <text x="${x + 24}" y="${y + 66}" font-family="${MONO}" font-size="16" font-weight="700" fill="#fff">${esc(trunc(r.name, 30))}</text>
    <text x="${x + 24}" y="${y + 88}" font-family="${SANS}" font-size="12.5" fill="#b9d3e1">${esc(trunc(r.description || 'A project in progress.', 56))}</text>
    <text x="${x + 24}" y="${y + 108}" font-family="${MONO}" font-size="11" fill="#cfe3ee">★ ${r.stargazers_count}   forks ${r.forks_count}</text>
    ${dot}`;
  }).join('\n');
  return svgWrap(H, cards);
}

// ---------- química da água (linguagens) ----------
function chemistry({ langs }) {
  const entries = Object.entries(langs).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const total = entries.reduce((a, [, v]) => a + v, 0) || 1;
  const H = 72 + entries.length * 34 + 14;
  const rows = entries.map(([name, v], i) => {
    const y = 78 + i * 34, pct = Math.round((v / total) * 100), bw = 430;
    return `<circle cx="42" cy="${y - 4}" r="6" fill="${LANG_COLORS[name] || '#9ab'}"/>
    <text x="58" y="${y}" font-family="${SANS}" font-size="14" font-weight="600" fill="#fff">${esc(name)}</text>
    <rect x="200" y="${y - 14}" width="${bw}" height="14" rx="7" fill="#1f4357"/>
    <rect x="200" y="${y - 14}" width="${Math.max(10, (bw * v) / total).toFixed(1)}" height="14" rx="7" fill="#4fd1e0"/>
    <text x="${W - 40}" y="${y - 2}" text-anchor="end" font-family="${MONO}" font-size="12" fill="#cfe3ee">${pct}%</text>`;
  }).join('\n');
  return svgWrap(H, `${cardBg(2, 2, W - 4, H - 4)}${label(32, 42, 'WATER CHEMISTRY')}${rows}`);
}

// ---------- maré (contribuições) ----------
function tide({ weeks }) {
  const H = 210;
  const grid = weeks.slice(-26);
  const flat = weeks.flat();
  const max = Math.max(1, ...grid.flat());
  const colors = ['#17435a', '#1f7a96', '#2fa3bf', '#4fd1e0', '#c2f6ff'];
  const cells = grid.map((w, wi) => w.map((c, di) => {
    const lvl = c === 0 ? 0 : Math.min(4, Math.ceil((c / max) * 4));
    return `<rect x="${32 + wi * 16}" y="${62 + di * 16}" width="13" height="13" rx="3.5" fill="${colors[lvl]}"/>`;
  }).join('')).join('');

  // sequências (dias seguidos com contribuição)
  let longest = 0, run = 0;
  for (const c of flat) { run = c > 0 ? run + 1 : 0; longest = Math.max(longest, run); }
  let current = 0, i = flat.length - 1;
  if (flat[i] === 0) i--; // hoje ainda pode não ter contribuído
  for (; i >= 0 && flat[i] > 0; i--) current++;
  const total = flat.reduce((a, b) => a + b, 0);

  const stat = (y, name, value) => `<text x="530" y="${y}" font-family="${MONO}" font-size="11" letter-spacing="1.5" fill="#8fb4c8">${name}</text>
    <text x="530" y="${y + 28}" font-family="${SANS}" font-size="26" font-weight="700" fill="#fff">${value}</text>`;
  return svgWrap(H, `${cardBg(2, 2, W - 4, H - 4)}${label(32, 42, 'TIDE CHART')}${cells}
  ${stat(66, 'DAYS SWIMMING', current + ' days')}
  ${stat(116, 'LONGEST SWIM', longest + ' days')}
  ${stat(166, 'BUBBLES THIS YEAR', total)}`);
}

// ---------- main ----------
(async () => {
  const data = await loadData();
  fs.mkdirSync(OUT, { recursive: true });
  const files = { 'aquarium.svg': aquarium, 'profile.svg': profile, 'specimens.svg': specimens, 'chemistry.svg': chemistry, 'tide.svg': tide };
  for (const [name, fn] of Object.entries(files)) {
    fs.writeFileSync(path.join(OUT, name), fn(data));
    console.log('gerado', name);
  }
})().catch((e) => { console.error(e); process.exit(1); });
