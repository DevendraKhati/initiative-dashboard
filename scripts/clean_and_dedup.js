const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const recordsPath = path.join(projectRoot, 'data', 'records.json');
const seedPath = path.join(projectRoot, 'data', 'seed.json');

// Read existing records
let records = JSON.parse(fs.readFileSync(recordsPath, 'utf8'));

// 1. Remove empty phone numbers ("filters mei se empte hta do")
records = records.filter(r => {
  if (!r.contact) return false;
  const clean = r.contact.replace(/[^0-9]/g, '');
  if (r.contact === 'Not Provided' || clean.length < 5) return false;
  return true;
});

// 2. Duplicate detection by PHONE NUMBER ONLY ("phone is primary, name can be duplicate")
function computePhoneDuplicates(list) {
  const phoneMap = new Map();

  // First pass: group by clean phone number
  list.forEach(r => {
    const cleanPhone = (r.contact || '').replace(/[^0-9]/g, '');
    if (cleanPhone.length >= 7) {
      if (!phoneMap.has(cleanPhone)) phoneMap.set(cleanPhone, []);
      phoneMap.get(cleanPhone).push(r);
    }
  });

  // Second pass: flag only if phone is shared
  list.forEach(r => {
    const cleanPhone = (r.contact || '').replace(/[^0-9]/g, '');
    const matches = cleanPhone.length >= 7 ? (phoneMap.get(cleanPhone) || []) : [];

    if (matches.length > 1) {
      r.isDuplicate = true;
      r.duplicateFields = ['contact'];
      
      const otherNames = matches
        .filter(m => m.id !== r.id)
        .map(m => m.name)
        .slice(0, 3)
        .join(', ');

      const count = matches.length;
      r.duplicateReasons = [
        `Duplicate Phone: ${r.contact} appears ${count} times (used by: ${otherNames || (count - 1) + ' other entries'})`
      ];
    } else {
      r.isDuplicate = false;
      r.duplicateFields = [];
      r.duplicateReasons = [];
    }
  });

  return list;
}

const cleanedRecords = computePhoneDuplicates(records);

console.log('Total records after removing empty:', cleanedRecords.length);
console.log('Duplicate phone records:', cleanedRecords.filter(r => r.isDuplicate).length);
console.log('Unique phone records:', cleanedRecords.filter(r => !r.isDuplicate).length);

// Save cleaned dataset
fs.writeFileSync(recordsPath, JSON.stringify(cleanedRecords, null, 2), 'utf8');
fs.writeFileSync(seedPath, JSON.stringify(cleanedRecords, null, 2), 'utf8');
console.log('Successfully saved to records.json and seed.json');
