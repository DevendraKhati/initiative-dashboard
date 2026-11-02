const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Path to data store
const DATA_FILE = path.join(__dirname, 'data', 'records.json');
const SEED_FILE = path.join(__dirname, 'data', 'seed.json');

// The 4 Core Initiatives specified by user
const INITIATIVES = [
  'Apne Apne Ram',
  'Diwali Event',
  'Khatu Shyam',
  'Sports Talent'
];

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper to safely read records
function readRecords() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      if (fs.existsSync(SEED_FILE)) {
        const seedData = fs.readFileSync(SEED_FILE, 'utf-8');
        fs.writeFileSync(DATA_FILE, seedData, 'utf-8');
        return JSON.parse(seedData);
      }
      return [];
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading records:', err);
    return [];
  }
}

// Helper to safely write records
function writeRecords(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error writing records:', err);
    return false;
  }
}

// ----------------- API ROUTES -----------------

// 1. Get List of Initiatives
app.get('/api/initiatives', (req, res) => {
  res.json({
    success: true,
    initiatives: INITIATIVES
  });
});

// 2. Get Aggregated Statistics
app.get('/api/stats', (req, res) => {
  const records = readRecords();
  const byInitiative = {};
  
  INITIATIVES.forEach(init => {
    byInitiative[init] = 0;
  });

  records.forEach(r => {
    if (byInitiative[r.initiative] !== undefined) {
      byInitiative[r.initiative]++;
    }
  });

  res.json({
    success: true,
    stats: {
      total: records.length,
      byInitiative
    }
  });
});

// 3. Get Records with Filter, Search, and Sort
app.get('/api/records', (req, res) => {
  let records = readRecords();
  const { initiative, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

  // Filter by initiative
  if (initiative && initiative !== 'All' && INITIATIVES.includes(initiative)) {
    records = records.filter(r => r.initiative === initiative);
  }

  // Live text search across Name, Contact, Address
  if (search && search.trim() !== '') {
    const q = search.trim().toLowerCase();
    records = records.filter(r => 
      (r.name && r.name.toLowerCase().includes(q)) ||
      (r.contact && r.contact.toLowerCase().includes(q)) ||
      (r.address && r.address.toLowerCase().includes(q)) ||
      (r.initiative && r.initiative.toLowerCase().includes(q))
    );
  }

  // Sorting
  records.sort((a, b) => {
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

  res.json({
    success: true,
    total: records.length,
    records
  });
});

// 4. Create New Record
app.post('/api/records', (req, res) => {
  const { name, contact, address, initiative } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: 'Name is required' });
  }
  if (!contact || !contact.trim()) {
    return res.status(400).json({ success: false, error: 'Contact details are required' });
  }
  if (!address || !address.trim()) {
    return res.status(400).json({ success: false, error: 'Address is required' });
  }
  if (!initiative || !INITIATIVES.includes(initiative.trim())) {
    return res.status(400).json({ 
      success: false, 
      error: `Invalid initiative. Must be one of: ${INITIATIVES.join(', ')}` 
    });
  }

  const records = readRecords();
  const newRecord = {
    id: `rec_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    name: name.trim(),
    contact: contact.trim(),
    address: address.trim(),
    initiative: initiative.trim(),
    createdAt: new Date().toISOString()
  };

  records.unshift(newRecord); // Add to beginning
  writeRecords(records);

  res.status(201).json({
    success: true,
    message: 'Record added successfully',
    record: newRecord
  });
});

// 5. Update Existing Record
app.put('/api/records/:id', (req, res) => {
  const { id } = req.params;
  const { name, contact, address, initiative } = req.body;

  const records = readRecords();
  const index = records.findIndex(r => r.id === id);

  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Record not found' });
  }

  if (name && name.trim()) records[index].name = name.trim();
  if (contact && contact.trim()) records[index].contact = contact.trim();
  if (address && address.trim()) records[index].address = address.trim();
  if (initiative && INITIATIVES.includes(initiative.trim())) {
    records[index].initiative = initiative.trim();
  }

  records[index].updatedAt = new Date().toISOString();
  writeRecords(records);

  res.json({
    success: true,
    message: 'Record updated successfully',
    record: records[index]
  });
});

// 6. Delete Record
app.delete('/api/records/:id', (req, res) => {
  const { id } = req.params;
  let records = readRecords();
  const initialLength = records.length;

  records = records.filter(r => r.id !== id);

  if (records.length === initialLength) {
    return res.status(404).json({ success: false, error: 'Record not found' });
  }

  writeRecords(records);
  res.json({
    success: true,
    message: 'Record deleted successfully'
  });
});

// 7. Reset to Sample Seed Data
app.post('/api/reset', (req, res) => {
  try {
    if (fs.existsSync(SEED_FILE)) {
      const seedData = fs.readFileSync(SEED_FILE, 'utf-8');
      fs.writeFileSync(DATA_FILE, seedData, 'utf-8');
      res.json({ success: true, message: 'Data reset to default sample records' });
    } else {
      res.status(500).json({ success: false, error: 'Seed file missing' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Export CSV Endpoint
app.get('/api/export/csv', (req, res) => {
  const records = readRecords();
  const header = ['ID', 'Name', 'Contact', 'Address', 'Initiative', 'Created At'];
  const rows = records.map(r => [
    `"${r.id}"`,
    `"${(r.name || '').replace(/"/g, '""')}"`,
    `"${(r.contact || '').replace(/"/g, '""')}"`,
    `"${(r.address || '').replace(/"/g, '""')}"`,
    `"${(r.initiative || '').replace(/"/g, '""')}"`,
    `"${r.createdAt}"`
  ]);

  const csvContent = [header.join(','), ...rows.map(row => row.join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="initiatives_members.csv"');
  res.status(200).send(csvContent);
});

// Fallback to index.html for SPA feel
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 Initiative Management Dashboard is LIVE!`);
  console.log(`📍 Local Server URL: http://localhost:${PORT}`);
  console.log(`=================================================`);
});
