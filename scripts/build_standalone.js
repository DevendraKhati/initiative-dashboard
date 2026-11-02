const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const records = JSON.parse(fs.readFileSync(path.join(projectRoot, 'data', 'records.json'), 'utf8'));
const html = fs.readFileSync(path.join(projectRoot, 'public', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(projectRoot, 'public', 'style.css'), 'utf8');

// Replace stylesheet link with inline styles
let standalone = html.replace('<link rel="stylesheet" href="style.css">', '<style>\n' + css + '\n</style>');

// Standalone JS reads from data/records.json as initial dataset
let appJs = fs.readFileSync(path.join(projectRoot, 'public', 'app.js'), 'utf8');

// In standalone mode, we override fetchStats and fetchRecords to use localStorage and client-side records
const standaloneAdapter = `
<script>
  window.__INITIAL_RECORDS__ = ${JSON.stringify(records)};
</script>
<script>
  // LocalStorage Standalone Adapter for GitHub Pages / Offline / File Preview
  (function() {
    const DATA_VERSION = 'v5_ram_khatu_gift_5065';
    const STORAGE_KEY = 'initiative_dashboard_data_' + DATA_VERSION;

    function getStore() {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(window.__INITIAL_RECORDS__));
          return window.__INITIAL_RECORDS__;
        }
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed) || parsed.length !== window.__INITIAL_RECORDS__.length) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(window.__INITIAL_RECORDS__));
          return window.__INITIAL_RECORDS__;
        }
        return parsed;
      } catch (e) {
        return window.__INITIAL_RECORDS__;
      }
    }

    function saveStore(data) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (e) {
        console.warn('LocalStorage save failed:', e);
      }
    }

    // Intercept fetch for standalone mode
    const originalFetch = window.fetch;
    window.fetch = async function(url, options) {
      const urlStr = (url || '').toString();

      // Ensure base URL works safely on file:// where window.location.origin is 'null'
      let baseOrigin = 'http://localhost:3000';
      try {
        if (window.location && window.location.origin && window.location.origin !== 'null' && window.location.protocol.startsWith('http')) {
          baseOrigin = window.location.origin;
        }
      } catch (e) {}

      if (urlStr.includes('/api/stats')) {
        const data = getStore();
        const byInitiative = {
          'Apne Apne Ram': 0,
          'Diwali Event': 0,
          'Khatu Shyam': 0,
          'Sports Talent': 0,
          'Gift Distribution': 0
        };
        let duplicateCount = 0;
        data.forEach(r => {
          if (byInitiative[r.initiative] !== undefined) byInitiative[r.initiative]++;
          if (r.isDuplicate) duplicateCount++;
        });
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            stats: {
              total: data.length,
              byInitiative,
              duplicateCount,
              uniqueCount: data.length - duplicateCount
            }
          })
        };
      }

      if (urlStr.includes('/api/records')) {
        const u = new URL(urlStr, baseOrigin);
        const init = u.searchParams.get('initiative') || 'All';
        const dupFilter = u.searchParams.get('duplicateFilter') || 'all';
        const q = (u.searchParams.get('search') || '').trim().toLowerCase();
        const sortBy = u.searchParams.get('sortBy') || 'createdAt';
        const sortOrder = u.searchParams.get('sortOrder') || 'desc';

        let list = [...getStore()];

        if (init !== 'All') {
          list = list.filter(r => r.initiative === init);
        }

        if (dupFilter === 'duplicates_only') {
          list = list.filter(r => r.isDuplicate);
        } else if (dupFilter === 'unique_only') {
          list = list.filter(r => !r.isDuplicate);
        }

        if (q) {
          list = list.filter(r => 
            (r.name && r.name.toLowerCase().includes(q)) ||
            (r.contact && r.contact.toLowerCase().includes(q)) ||
            (r.address && r.address.toLowerCase().includes(q)) ||
            (r.initiative && r.initiative.toLowerCase().includes(q)) ||
            (r.busStand && r.busStand.toLowerCase().includes(q)) ||
            (r.details && r.details.toLowerCase().includes(q)) ||
            (r.preferredFriday && r.preferredFriday.toLowerCase().includes(q))
          );
        }

        list.sort((a, b) => {
          let fieldA = (a[sortBy] || '').toString().toLowerCase();
          let fieldB = (b[sortBy] || '').toString().toLowerCase();
          if (sortBy === 'createdAt') {
            fieldA = new Date(a.createdAt).getTime();
            fieldB = new Date(b.createdAt).getTime();
          }
          if (fieldA < fieldB) return sortOrder === 'asc' ? -1 : 1;
          if (fieldA > fieldB) return sortOrder === 'asc' ? 1 : -1;
          return 0;
        });

        // Handle PUT (Update record)
        if (options && options.method === 'PUT') {
          const match = urlStr.match(/\/api\/records\/([^?]+)/);
          const updateId = match ? match[1] : null;
          const body = JSON.parse(options.body);
          const all = getStore();
          const target = all.find(r => r.id === updateId);
          if (target) {
            if (body.name) target.name = body.name;
            if (body.contact) target.contact = body.contact;
            if (body.address) target.address = body.address;
            if (body.busStand !== undefined) target.busStand = body.busStand;
            if (body.details !== undefined) target.details = body.details;
            if (body.initiative) target.initiative = body.initiative;
            saveStore(all);
            return { ok: true, status: 200, json: async () => ({ success: true, record: target }) };
          }
        }

        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            total: list.length,
            records: list
          })
        };
      }

      if (urlStr.includes('/api/reset')) {
        saveStore(window.__INITIAL_RECORDS__);
        return { ok: true, status: 200, json: async () => ({ success: true }) };
      }

      // If running on a live server, fall back to native fetch
      if (typeof originalFetch === 'function' && window.location.protocol.startsWith('http')) {
        try {
          return await originalFetch(url, options);
        } catch (e) {}
      }

      return {
        ok: false,
        status: 404,
        json: async () => ({ success: false, error: 'Endpoint not found in standalone mode' })
      };
    };
  })();
</script>
<script>
${appJs}
</script>
`;

standalone = standalone.replace('<script src="app.js"></script>', standaloneAdapter);

fs.writeFileSync(path.join(projectRoot, 'Initiative_Dashboard_Standalone.html'), standalone);
fs.writeFileSync(path.join(projectRoot, 'index.html'), standalone);
console.log('Standalone and root index.html generated successfully with safe URL and cache invalidation!');
