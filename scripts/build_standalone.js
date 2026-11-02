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
  // LocalStorage Standalone Adapter for GitHub Pages / Offline Preview
  (function() {
    const STORAGE_KEY = 'initiative_dashboard_v4_store';
    function getStore() {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(window.__INITIAL_RECORDS__));
        return window.__INITIAL_RECORDS__;
      }
      try { return JSON.parse(stored); } catch { return window.__INITIAL_RECORDS__; }
    }
    function saveStore(data) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    // Intercept fetch for standalone mode
    const originalFetch = window.fetch;
    window.fetch = async function(url, options) {
      const urlStr = url.toString();

      if (urlStr.startsWith('/api/stats')) {
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

      if (urlStr.startsWith('/api/records')) {
        const u = new URL(urlStr, window.location.origin);
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
          const match = urlStr.match(/\\/api\\/records\\/([^?]+)/);
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
            return { ok: true, json: async () => ({ success: true, record: target }) };
          }
        }

        return {
          ok: true,
          json: async () => ({
            success: true,
            total: list.length,
            records: list
          })
        };
      }

      if (urlStr.startsWith('/api/reset')) {
        saveStore(window.__INITIAL_RECORDS__);
        return { ok: true, json: async () => ({ success: true }) };
      }

      return originalFetch(url, options);
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
console.log('Standalone and root index.html generated successfully!');
