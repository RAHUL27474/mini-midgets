// Probes Hugging Face Spaces for API access without login and prints their endpoints.
const { Client } = require('@gradio/client');
const SPACES = process.argv.slice(2);
(async () => {
  for (const s of SPACES) {
    try {
      const app = await Promise.race([Client.connect(s), new Promise((_, r) => setTimeout(() => r(new Error('connect timeout')), 40000))]);
      const api = await app.view_api();
      const eps = { ...(api.named_endpoints || {}) };
      console.log('OK', s);
      for (const [name, ep] of Object.entries(eps)) console.log('   ', name, '(', (ep.parameters || []).map(p => `${p.parameter_name || p.label}:${p.python_type?.type || p.type}`).join(', '), ')');
    } catch (e) { console.log('FAIL', s, '-', String(e.message || e).slice(0, 160)); }
  }
  process.exit(0);
})();
