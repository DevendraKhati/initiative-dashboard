const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Path to data store
const DATA_FILE = path.join(__dirname, 'data', 'records.json');
const SEED_FILE = path.join(__dirname, 'data', 'seed.json');

// Core Initiatives (5 Initiatives)
const INITIATIVES = [
  'Apne Apne Ram',
  'Diwali Event',
  'Khatu Shyam',
  'Sports Talent',
  'Gift Distribution'
];

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Duplicate detection logic - PHONE NUMBER IS PRIMARY (Names can be shared/duplicate)
function computeDuplicates(records) {
  // 1. Filter out empty contact records ("filters mei se empte hta do")
  records = records.filter(r => {
    if (!r.contact) return false;
    const clean = r.contact.replace(/[^0-9]/g, '');
    if (r.contact === 'Not Provided' || clean.length < 5) return false;
    return true;
  });

  // 2. Group by clean phone number
  const phoneMap = new Map();
  records.forEach(r => {
    const cleanPhone = (r.contact || '').replace(/[^0-9]/g, '');
    if (cleanPhone.length >= 7) {
      if (!phoneMap.has(cleanPhone)) phoneMap.set(cleanPhone, []);
      phoneMap.get(cleanPhone).push(r);
    }
  });

  // 3. Flag records based SOLELY on duplicate phone number
  records.forEach(r => {
    const cleanPhone = (r.contact || '').replace(/[^0-9]/g, '');
    const matches = cleanPhone.length >= 7 ? (phoneMap.get(cleanPhone) || []) : [];

    if (matches.length > 1) {
      r.isDuplicate = true;
      r.duplicateFields = ['contact'];
      const others = matches
        .filter(m => m.id !== r.id)
        .map(m => m.name)
        .slice(0, 3)
        .join(', ');

      r.duplicateReasons = [
        `Duplicate Phone: ${r.contact} appears ${matches.length} times (registered by: ${others || (matches.length - 1) + ' others'})`
      ];
    } else {
      r.isDuplicate = false;
      r.duplicateFields = [];
      r.duplicateReasons = [];
    }
  });

  return records;
}

// Helper to safely read records
function readRecords() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      if (fs.existsSync(SEED_FILE)) {
        const seedData = fs.readFileSync(SEED_FILE, 'utf-8');
        fs.writeFileSync(DATA_FILE, seedData, 'utf-8');
        return computeDuplicates(JSON.parse(seedData));
      }
      return [];
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return computeDuplicates(parsed);
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

  let duplicateCount = 0;

  records.forEach(r => {
    if (byInitiative[r.initiative] !== undefined) {
      byInitiative[r.initiative]++;
    }
    if (r.isDuplicate) {
      duplicateCount++;
    }
  });

  res.json({
    success: true,
    stats: {
      total: records.length,
      byInitiative,
      duplicateCount,
      uniqueCount: records.length - duplicateCount
    }
  });
});

// 3. Get Records with Filters (Excluding empty, Phone-only duplicates)
app.get('/api/records', (req, res) => {
  let records = readRecords();
  const { initiative, search, duplicateFilter = 'all', sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

  // Filter by initiative
  if (initiative && initiative !== 'All' && INITIATIVES.includes(initiative)) {
    records = records.filter(r => r.initiative === initiative);
  }

  // Filter by duplicate status
  if (duplicateFilter === 'duplicates_only') {
    records = records.filter(r => r.isDuplicate);
  } else if (duplicateFilter === 'unique_only') {
    records = records.filter(r => !r.isDuplicate);
  }

  // Live text search across Name, Contact, Address, Initiative, Bus Stand, Details
  if (search && search.trim() !== '') {
    const q = search.trim().toLowerCase();
    records = records.filter(r =>
      (r.name && r.name.toLowerCase().includes(q)) ||
      (r.contact && r.contact.toLowerCase().includes(q)) ||
      (r.address && r.address.toLowerCase().includes(q)) ||
      (r.initiative && r.initiative.toLowerCase().includes(q)) ||
      (r.busStand && r.busStand.toLowerCase().includes(q)) ||
      (r.details && r.details.toLowerCase().includes(q)) ||
      (r.preferredFriday && r.preferredFriday.toLowerCase().includes(q))
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
  const { name, contact, address, initiative, voter = 'No' } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: 'Name is required' });
  }
  if (!contact || !contact.trim()) {
    return res.status(400).json({ success: false, error: 'Contact number is required' });
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

  let records = readRecords();
  const newRecord = {
    id: `rec_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    name: name.trim(),
    contact: contact.trim(),
    address: address.trim(),
    initiative: initiative.trim(),
    voter: (voter && voter.toLowerCase() === 'yes') ? 'Yes' : 'No',
    createdAt: new Date().toISOString()
  };

  records.unshift(newRecord);
  records = computeDuplicates(records);
  writeRecords(records);

  const savedRecord = records.find(r => r.id === newRecord.id);

  res.status(201).json({
    success: true,
    message: 'Record added successfully',
    record: savedRecord
  });
});

// 5. Update Existing Record
app.put('/api/records/:id', (req, res) => {
  const { id } = req.params;
  const { name, contact, address, initiative, busStand, details } = req.body;

  let records = readRecords();
  const index = records.findIndex(r => r.id === id);

  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Record not found' });
  }

  if (name && name.trim()) records[index].name = name.trim();
  if (contact && contact.trim()) records[index].contact = contact.trim();
  if (address && address.trim()) records[index].address = address.trim();
  if (busStand !== undefined) records[index].busStand = busStand.trim();
  if (details !== undefined) records[index].details = details.trim();
  if (initiative && INITIATIVES.includes(initiative.trim())) {
    records[index].initiative = initiative.trim();
  }

  records[index].updatedAt = new Date().toISOString();
  records = computeDuplicates(records);
  writeRecords(records);

  const updatedRecord = records.find(r => r.id === id) || records[index];

  res.json({
    success: true,
    message: 'Record updated successfully',
    record: updatedRecord
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

  records = computeDuplicates(records);
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
      res.json({ success: true, message: 'Data reset to default dataset' });
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
  const header = ['ID', 'Name', 'Contact', 'Residential Address', 'Bus Stand / Details', 'Preferred Friday', 'Age', 'Gender', 'Initiative', 'Phone Duplicate', 'Duplicate Reason', 'Created At'];
  const rows = records.map(r => [
    `"${r.id}"`,
    `"${(r.name || '').replace(/"/g, '""')}"`,
    `"${(r.contact || '').replace(/"/g, '""')}"`,
    `"${(r.address || '').replace(/"/g, '""')}"`,
    `"${(r.busStand || r.details || '').replace(/"/g, '""')}"`,
    `"${(r.preferredFriday || '').replace(/"/g, '""')}"`,
    `"${(r.age || '').replace(/"/g, '""')}"`,
    `"${(r.gender || '').replace(/"/g, '""')}"`,
    `"${(r.initiative || '').replace(/"/g, '""')}"`,
    `"${r.isDuplicate ? 'YES' : 'NO'}"`,
    `"${(r.duplicateReasons || []).join('; ').replace(/"/g, '""')}"`,
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
