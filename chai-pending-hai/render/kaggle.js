// Minimal Kaggle API client: run a python script as a GPU kernel and pull its outputs.
// node kaggle.js run <script.py> <slug> [--src user/kernel,...] [--sub KEY=file ...]   push, wait, download to kaggle_out/<slug>
// node kaggle.js status <slug> | node kaggle.js pull <slug> | node kaggle.js whoami
const fs = require('fs'), path = require('path'), os = require('os');
const API = 'https://www.kaggle.com/api/v1';
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

function creds() {
  if (process.env.KAGGLE_USERNAME && process.env.KAGGLE_KEY) return { username: process.env.KAGGLE_USERNAME, key: process.env.KAGGLE_KEY };
  const f = path.join(os.homedir(), '.kaggle', 'kaggle.json');
  if (!fs.existsSync(f)) throw new Error('missing ' + f);
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}
const C = creds();
const AUTH = C.key.startsWith('KGAT_') ? 'Bearer ' + C.key : 'Basic ' + Buffer.from(`${C.username}:${C.key}`).toString('base64');

async function api(method, url, body) {
  for (let a = 1; ; a++) {
    try {
      const r = await fetch(API + url, { method, headers: { Authorization: AUTH, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body), signal: AbortSignal.timeout(120000) });
      const t = await r.text();
      if (!r.ok) throw Object.assign(new Error(`${method} ${url} -> HTTP ${r.status}: ${t.slice(0, 500)}`), { status: r.status });
      return t ? JSON.parse(t) : {};
    } catch (e) {
      if (a >= 5 || (e.status && e.status < 500 && e.status !== 429)) throw e;
      log('retry', a, e.message); await new Promise(s => setTimeout(s, 15000 * a));
    }
  }
}

async function push(script, slug, sources, subs) {
  let text = fs.readFileSync(script, 'utf8');
  for (const [k, f] of Object.entries(subs)) text = text.split(`__${k}__`).join(fs.readFileSync(f, 'utf8'));
  const r = await api('POST', '/kernels/push', {
    slug: `${C.username}/${slug}`, newTitle: slug, text, language: 'python', kernelType: 'script',
    isPrivate: true, enableGpu: process.env.KAGGLE_GPU !== 'none', enableTpu: false, enableInternet: true, ...(process.env.KAGGLE_GPU !== 'none' && { machineShape: process.env.KAGGLE_GPU || 'NvidiaTeslaT4' }),
    datasetDataSources: [], competitionDataSources: [], kernelDataSources: sources, modelDataSources: [], categoryIds: [],
  });
  if (r.error) throw new Error('push error: ' + r.error);
  log('pushed', r.url || slug, 'version', r.versionNumber);
}

const status = slug => api('GET', `/kernels/status?userName=${C.username}&kernelSlug=${slug}`);

async function wait(slug) {
  let last = '';
  for (;;) {
    const s = await status(slug);
    if (s.status !== last) log('status', s.status, s.failureMessage || ''), last = s.status;
    if (/complete|error|cancel/i.test(s.status)) return s;
    await new Promise(r => setTimeout(r, 60000));
  }
}

async function pull(slug) {
  const dir = path.join(__dirname, 'kaggle_out', slug); fs.mkdirSync(dir, { recursive: true });
  let token = '', n = 0;
  do {
    const o = await api('GET', `/kernels/output?userName=${C.username}&kernelSlug=${slug}${token ? '&pageToken=' + token : ''}`);
    if (o.log != null) fs.writeFileSync(path.join(dir, '_log.txt'), typeof o.log === 'string' ? o.log : JSON.stringify(o.log));
    for (const f of o.files || []) {
      const dst = path.join(dir, f.fileName); fs.mkdirSync(path.dirname(dst), { recursive: true });
      const r = await fetch(f.url); fs.writeFileSync(dst, Buffer.from(await r.arrayBuffer())); n++;
    }
    token = o.nextPageToken;
  } while (token);
  log('pulled', n, 'files to', dir);
}

(async () => {
  const [cmd, a1, a2, ...rest] = process.argv.slice(2);
  if (cmd === 'whoami') { log('user', C.username, await api('GET', '/kernels/list?mine=true&pageSize=5').then(l => l.length + ' kernels')); return; }
  if (cmd === 'status') return log(await status(a1));
  if (cmd === 'pull') return pull(a1);
  if (cmd === 'run') {
    const sources = [], subs = {};
    for (let i = 0; i < rest.length; i++) {
      if (rest[i] === '--src') sources.push(...rest[++i].split(',').map(s => s.includes('/') ? s : `${C.username}/${s}`));
      if (rest[i] === '--sub') { const [k, f] = rest[++i].split('='); subs[k] = f; }
    }
    await push(a1, a2, sources, subs);
    await new Promise(r => setTimeout(r, 20000));
    const s = await wait(a2);
    await pull(a2);
    if (!/complete/i.test(s.status)) process.exit(1);
  }
})().catch(e => { log('ERROR', e.message); process.exit(1); });
