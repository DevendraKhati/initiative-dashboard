const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

// 1. Read existing Gift Distribution records from uploaded_gift_distribution.csv or records.json
let existingRecords = [];
try {
  existingRecords = JSON.parse(fs.readFileSync(path.join(projectRoot, 'data', 'records.json'), 'utf8'));
} catch (e) {
  existingRecords = [];
}

// Keep ONLY real Gift Distribution records, delete all dummy records (rec_001 to rec_013)
const giftRecords = existingRecords.filter(r => r.initiative === 'Gift Distribution' && !r.id.startsWith('rec_'));
console.log('Preserved Gift Distribution records:', giftRecords.length);

// 2. Parse Khatu Shyam CSV
const khatuCsvPath = 'C:/Users/My PC/.gemini/antigravity/brain/27a4aa8e-c866-4ef2-8d4f-855194343fa8/.user_uploaded/media_1793617239799_806aaea2.csv';
const content = fs.readFileSync(khatuCsvPath, 'utf8');

function parseCSV(text) {
  const rows = [];
  let currentRow = [];
  let currentVal = '';
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentVal.trim());
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentVal.trim());
      if (currentRow.some(col => col !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentVal = '';
    } else {
      currentVal += char;
    }
  }
  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some(col => col !== '')) {
      rows.push(currentRow);
    }
  }
  return rows;
}

const parsed = parseCSV(content);
const dataRows = parsed.slice(1);

const khatuRecords = [];
let skippedEmpty = 0;

dataRows.forEach((row, idx) => {
  const originalId = row[0] || (idx + 1);
  const completionTime = row[2] || row[1] || '';
  const fullName = (row[6] || '').trim();
  const ageRaw = (row[7] || '').trim();
  const genderRaw = (row[8] || '').trim();
  const gender = genderRaw.split('/')[0].trim();
  const address = (row[9] || '').trim();
  const phone = (row[10] || '').trim();
  const aadhaar = (row[11] || '').trim();
  const email = (row[13] || '').trim();
  const preferredFriday = (row[14] || '').trim();
  const busStandRaw = (row[15] || '').trim();
  const busStand = busStandRaw.split('/')[0].trim();

  // Clean phone
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  if (!phone || cleanPhone.length < 5 || phone.toLowerCase() === 'not provided') {
    skippedEmpty++;
    return;
  }

  // Parse completion time
  let createdDate = new Date().toISOString();
  if (completionTime) {
    const parts = completionTime.split(' ');
    if (parts.length >= 1) {
      const dateParts = parts[0].split('-');
      if (dateParts.length === 3) {
        let m = dateParts[0].padStart(2, '0');
        let d = dateParts[1].padStart(2, '0');
        let y = dateParts[2].length === 2 ? '20' + dateParts[2] : dateParts[2];
        let timePart = parts[1] || '12:00:00';
        createdDate = `${y}-${m}-${d}T${timePart}.000Z`;
      }
    }
  }

  khatuRecords.push({
    id: `ks_${String(idx + 1).padStart(4, '0')}`,
    name: fullName || 'Devotee',
    contact: cleanPhone,
    address: address || 'Noida',
    initiative: 'Khatu Shyam',
    age: ageRaw.replace(/years old/i, '').trim(),
    gender: gender || '',
    busStand: busStand || '',
    preferredFriday: preferredFriday || '',
    details: [busStand, preferredFriday].filter(Boolean).join(' • '),
    aadhaar: aadhaar && !aadhaar.includes('E+') ? aadhaar : '',
    email: email !== '-' ? email : '',
    createdAt: createdDate
  });
});

console.log('Parsed valid Khatu Shyam records:', khatuRecords.length);
console.log('Skipped empty/invalid phone records:', skippedEmpty);

// For Gift Distribution records, make sure `details` is also populated (e.g. flat / tower)
giftRecords.forEach(r => {
  if (!r.details) {
    r.details = r.address || 'Gift Package';
  }
});

// Combine both datasets
const combined = [...khatuRecords, ...giftRecords];

// 3. Compute duplicates solely on clean phone number (min 7 digits)
const phoneMap = new Map();
combined.forEach(r => {
  const cleanPhone = (r.contact || '').replace(/[^0-9]/g, '');
  if (cleanPhone.length >= 7) {
    if (!phoneMap.has(cleanPhone)) phoneMap.set(cleanPhone, []);
    phoneMap.get(cleanPhone).push(r);
  }
});

let totalDuplicateRecords = 0;
combined.forEach(r => {
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
    totalDuplicateRecords++;
  } else {
    r.isDuplicate = false;
    r.duplicateFields = [];
    r.duplicateReasons = [];
  }
});

console.log('Total combined records:', combined.length);
console.log('Total flagged duplicate records:', totalDuplicateRecords);
console.log('Total unique phone records:', combined.length - totalDuplicateRecords);

// Save to data/records.json and data/seed.json
fs.writeFileSync(path.join(projectRoot, 'data', 'records.json'), JSON.stringify(combined, null, 2), 'utf8');
fs.writeFileSync(path.join(projectRoot, 'data', 'seed.json'), JSON.stringify(combined, null, 2), 'utf8');
console.log('Successfully saved to data/records.json and data/seed.json!');
