const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

// 1. Read existing records (Khatu Shyam & Gift Distribution)
const existingRecords = JSON.parse(fs.readFileSync(path.join(projectRoot, 'data', 'records.json'), 'utf8'));
const nonRamRecords = existingRecords.filter(r => r.initiative !== 'Apne Apne Ram' && !r.id.startsWith('rec_'));
console.log('Existing non-Ram records (Khatu Shyam & Gift Distribution):', nonRamRecords.length);

// 2. Read Apne Apne Ram records
const ramRecords = JSON.parse(fs.readFileSync(path.join(projectRoot, 'data', 'apne_apne_ram.json'), 'utf8'));
console.log('New Apne Apne Ram records:', ramRecords.length);

// Combine
const combined = [...ramRecords, ...nonRamRecords];
console.log('Total combined records:', combined.length);

// 3. Compute duplicates strictly by phone number
// Rule: Phone number is primary. Identical names on different phones are NOT duplicates.
// Empty contacts are dropped.
const filtered = combined.filter(r => {
  if (!r.contact) return false;
  const clean = r.contact.replace(/[^0-9]/g, '');
  return clean.length >= 5 && r.contact !== 'Not Provided';
});

const phoneMap = new Map();
filtered.forEach(r => {
  const cleanPhone = (r.contact || '').replace(/[^0-9]/g, '');
  if (cleanPhone.length >= 7) {
    if (!phoneMap.has(cleanPhone)) phoneMap.set(cleanPhone, []);
    phoneMap.get(cleanPhone).push(r);
  }
});

let duplicateCount = 0;
filtered.forEach(r => {
  const cleanPhone = (r.contact || '').replace(/[^0-9]/g, '');
  const matches = cleanPhone.length >= 7 ? (phoneMap.get(cleanPhone) || []) : [];

  if (matches.length > 1) {
    r.isDuplicate = true;
    r.duplicateFields = ['contact'];
    const otherNames = matches
      .filter(m => m.id !== r.id)
      .map(m => m.name)
      .filter(Boolean)
      .slice(0, 3)
      .join(', ');

    r.duplicateReasons = [
      `Duplicate Phone: ${r.contact} appears ${matches.length} times (registered by: ${otherNames || (matches.length - 1) + ' others'})`
    ];
    duplicateCount++;
  } else {
    r.isDuplicate = false;
    r.duplicateFields = [];
    r.duplicateReasons = [];
  }
});

console.log('Final verified records count:', filtered.length);
console.log('Total duplicate phone records:', duplicateCount);
console.log('Total unique phone records:', filtered.length - duplicateCount);

// Stats breakdown
const initiativeCounts = {};
filtered.forEach(r => {
  initiativeCounts[r.initiative] = (initiativeCounts[r.initiative] || 0) + 1;
});
console.log('Breakdown by Initiative:', initiativeCounts);

// Save to records.json and seed.json
fs.writeFileSync(path.join(projectRoot, 'data', 'records.json'), JSON.stringify(filtered, null, 2), 'utf8');
fs.writeFileSync(path.join(projectRoot, 'data', 'seed.json'), JSON.stringify(filtered, null, 2), 'utf8');
console.log('Successfully written to data/records.json and data/seed.json!');
