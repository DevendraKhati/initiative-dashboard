const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const records = JSON.parse(fs.readFileSync(path.join(projectRoot, 'data', 'records.json'), 'utf8'));
const html = fs.readFileSync(path.join(projectRoot, 'public', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(projectRoot, 'public', 'style.css'), 'utf8');
const appJs = fs.readFileSync(path.join(projectRoot, 'public', 'app.js'), 'utf8');

// Replace stylesheet link with inline styles
let standalone = html.replace('<link rel="stylesheet" href="style.css">', '<style>\n' + css + '\n</style>');

// Standalone JS Adapter: Delta-based LocalStorage (prevents quota overflow) & Full Duplicate Engine
const standaloneAdapter = `
<script>
  window.__INITIAL_RECORDS__ = ` + JSON.stringify(records) + `;
</script>
<script>
  // Robust Standalone & Offline Adapter with Delta Storage & Duplicate Engine
  (function() {
    const EDITS_KEY = 'initiative_dashboard_user_edits_v1';
    let memoryRecords = null;

    function getUserEdits() {
      try {
        const stored = localStorage.getItem(EDITS_KEY);
        return stored ? JSON.parse(stored) : {};
      } catch (e) {
        return {};
      }
    }

    function saveUserEdits(edits) {
      try {
        localStorage.setItem(EDITS_KEY, JSON.stringify(edits));
      } catch (e) {
        console.warn('LocalStorage save failed:', e);
      }
    }

    function computeDuplicatesClient(list) {
      // 1. Filter empty contact records
      const filtered = list.filter(function(r) {
        if (!r.contact) return false;
        const clean = (r.contact || '').replace(/[^0-9]/g, '');
        return clean.length >= 5 && r.contact !== 'Not Provided';
      });

      // 2. Group by clean phone number
      const phoneMap = new Map();
      filtered.forEach(function(r) {
        const cleanPhone = (r.contact || '').replace(/[^0-9]/g, '');
        if (cleanPhone.length >= 7) {
          if (!phoneMap.has(cleanPhone)) phoneMap.set(cleanPhone, []);
          phoneMap.get(cleanPhone).push(r);
        }
      });

      // 3. Mark duplicate phone entries with explicit reasons
      filtered.forEach(function(r) {
        const cleanPhone = (r.contact || '').replace(/[^0-9]/g, '');
        const matches = cleanPhone.length >= 7 ? (phoneMap.get(cleanPhone) || []) : [];
        if (matches.length > 1) {
          r.isDuplicate = true;
          r.duplicateFields = ['contact'];
          const otherNames = matches
            .filter(function(m) { return m.id !== r.id; })
            .map(function(m) { return m.name; })
            .filter(Boolean)
            .slice(0, 3)
            .join(', ');
          r.duplicateReasons = [
            'Duplicate Phone: ' + r.contact + ' appears ' + matches.length + ' times (registered by: ' + (otherNames || (matches.length - 1) + ' others') + ')'
          ];
        } else {
          r.isDuplicate = false;
          r.duplicateFields = [];
          r.duplicateReasons = [];
        }
      });

      return filtered;
    }

    function getStore() {
      if (memoryRecords) return memoryRecords;

      const edits = getUserEdits();
      const initial = window.__INITIAL_RECORDS__ || [];

      // Clone and apply user edits
      const merged = initial.map(function(r) {
        if (edits[r.id]) {
          return Object.assign({}, r, edits[r.id]);
        }
        return Object.assign({}, r);
      });

      memoryRecords = computeDuplicatesClient(merged);
      return memoryRecords;
    }

    // Intercept fetch for standalone mode
    const originalFetch = window.fetch;
    window.fetch = async function(url, options) {
      const urlStr = (url || '').toString();
      const method = (options && options.method ? options.method : 'GET').toUpperCase();

      // Ensure base URL works safely on file:// where window.location.origin is 'null'
      let baseOrigin = 'http://localhost:3000';
      try {
        if (window.location && window.location.origin && window.location.origin !== 'null' && window.location.protocol.startsWith('http')) {
          baseOrigin = window.location.origin;
        }
      } catch (e) {}

      // 1. STATS
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
        data.forEach(function(r) {
          if (byInitiative[r.initiative] !== undefined) byInitiative[r.initiative]++;
          if (r.isDuplicate) duplicateCount++;
        });
        return {
          ok: true,
          status: 200,
          json: async function() {
            return {
              success: true,
              stats: {
                total: data.length,
                byInitiative: byInitiative,
                duplicateCount: duplicateCount,
                uniqueCount: data.length - duplicateCount
              }
            };
          }
        };
      }

      // 2. PUT RECORD (Edit)
      if (urlStr.includes('/api/records') && method === 'PUT') {
        const parts = urlStr.split('/api/records/');
        let updateId = parts.length > 1 ? parts[1].split('?')[0] : null;
        if (updateId && updateId.endsWith('/')) updateId = updateId.slice(0, -1);

        let body = {};
        try {
          body = typeof options.body === 'string' ? JSON.parse(options.body) : (options.body || {});
        } catch (e) {}

        const all = getStore();
        const target = all.find(function(r) { return r.id === updateId; });

        if (target) {
          if (body.name !== undefined && body.name.trim()) target.name = body.name.trim();
          if (body.contact !== undefined && body.contact.trim()) target.contact = body.contact.trim();
          if (body.address !== undefined && body.address.trim()) target.address = body.address.trim();
          if (body.busStand !== undefined) target.busStand = body.busStand.trim();
          if (body.details !== undefined) target.details = body.details.trim();
          if (body.initiative && body.initiative.trim()) target.initiative = body.initiative.trim();
          target.updatedAt = new Date().toISOString();

          // Save delta into localStorage
          const edits = getUserEdits();
          edits[updateId] = {
            name: target.name,
            contact: target.contact,
            address: target.address,
            busStand: target.busStand,
            details: target.details,
            initiative: target.initiative,
            updatedAt: target.updatedAt
          };
          saveUserEdits(edits);

          // Re-compute duplicates across all records
          memoryRecords = computeDuplicatesClient(all);
          const updatedTarget = memoryRecords.find(function(r) { return r.id === updateId; }) || target;

          return {
            ok: true,
            status: 200,
            json: async function() {
              return {
                success: true,
                message: 'Record updated successfully',
                record: updatedTarget
              };
            }
          };
        } else {
          return {
            ok: false,
            status: 404,
            json: async function() {
              return { success: false, error: 'Record not found' };
            }
          };
        }
      }

      // 3. GET RECORDS (Filter, Search, Sort)
      if (urlStr.includes('/api/records') && method === 'GET') {
        const u = new URL(urlStr, baseOrigin);
        const init = u.searchParams.get('initiative') || 'All';
        const dupFilter = u.searchParams.get('duplicateFilter') || 'all';
        const q = (u.searchParams.get('search') || '').trim().toLowerCase();
        const sortBy = u.searchParams.get('sortBy') || 'createdAt';
        const sortOrder = u.searchParams.get('sortOrder') || 'desc';

        let list = [...getStore()];

        if (init !== 'All') {
          list = list.filter(function(r) { return r.initiative === init; });
        }

        if (dupFilter === 'duplicates_only') {
          list = list.filter(function(r) { return r.isDuplicate; });
        } else if (dupFilter === 'unique_only') {
          list = list.filter(function(r) { return !r.isDuplicate; });
        }

        if (q) {
          list = list.filter(function(r) {
            return (r.name && r.name.toLowerCase().includes(q)) ||
              (r.contact && r.contact.toLowerCase().includes(q)) ||
              (r.address && r.address.toLowerCase().includes(q)) ||
              (r.initiative && r.initiative.toLowerCase().includes(q)) ||
              (r.busStand && r.busStand.toLowerCase().includes(q)) ||
              (r.details && r.details.toLowerCase().includes(q)) ||
              (r.preferredFriday && r.preferredFriday.toLowerCase().includes(q));
          });
        }

        list.sort(function(a, b) {
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

        return {
          ok: true,
          status: 200,
          json: async function() {
            return {
              success: true,
              total: list.length,
              records: list
            };
          }
        };
      }

      // 4. RESET RECORDS
      if (urlStr.includes('/api/reset')) {
        try { localStorage.removeItem(EDITS_KEY); } catch (e) {}
        memoryRecords = null;
        return {
          ok: true,
          status: 200,
          json: async function() {
            return { success: true, message: 'All custom edits cleared and reset to seed data' };
          }
        };
      }

      // Fallback
      if (typeof originalFetch === 'function' && window.location.protocol.startsWith('http')) {
        try {
          return await originalFetch(url, options);
        } catch (e) {}
      }

      return {
        ok: false,
        status: 404,
        json: async function() {
          return { success: false, error: 'Endpoint not found in standalone mode' };
        }
      };
    };
  })();
</script>
<script>
` + appJs + `
</script>
`;

standalone = standalone.replace('<script src="app.js"></script>', standaloneAdapter);

fs.writeFileSync(path.join(projectRoot, 'Initiative_Dashboard_Standalone.html'), standalone);
fs.writeFileSync(path.join(projectRoot, 'index.html'), standalone);
console.log('Standalone and root index.html generated successfully with robust edit functionality!');
