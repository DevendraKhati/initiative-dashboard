import fitz
import re
import json
import os

pdf_path = r"C:\Users\My PC\.gemini\antigravity\brain\27a4aa8e-c866-4ef2-8d4f-855194343fa8\.user_uploaded\media_1793620909033_526ffe1c.pdf"

doc = fitz.open(pdf_path)
total_pages = len(doc)
print(f"Opened PDF with {total_pages} pages")

records = []
skipped_empty = 0

for page_idx in range(total_pages):
    page = doc[page_idx]
    tabs = page.find_tables()
    if not tabs.tables:
        continue
    
    tab = tabs[0]
    rows = tab.extract()
    
    for r in rows:
        if not r or len(r) < 2:
            continue
        
        col0 = (r[0] or "").strip()
        col1 = (r[1] or "").strip() if len(r) > 1 else ""
        col2 = (r[2] or "").strip() if len(r) > 2 else ""
        
        # Skip header rows
        if not col0 and not col1 and not col2:
            continue
        if "name" in col0.lower() and "mobile" in col1.lower():
            continue
        if col0.lower() == "name" or col1.lower() == "mobile number":
            continue
        
        # Clean Name
        name = re.sub(r'\s+', ' ', col0).strip()
        
        # In case col1 is phone
        phone_raw = col1.strip()
        
        # Handle multiple numbers like "9810525264 / 9911525265"
        phones = [p.strip() for p in re.split(r'[/,]', phone_raw) if p.strip()]
        primary_phone_str = phones[0] if phones else phone_raw
        clean_phone = re.sub(r'[^0-9]', '', primary_phone_str)
        
        # If phone is 11 digits starting with 9, check if double digit or leading 0/9
        # In Indian numbers, 10 digits starting with 6, 7, 8, 9 is standard.
        # If 11 digits starting with 0, drop 0
        if len(clean_phone) == 11 and clean_phone.startswith('0'):
            clean_phone = clean_phone[1:]
        elif len(clean_phone) == 11:
            # e.g. 73510090432 -> 11 digits or 98108990936 -> 11 digits
            # keep as is or take first 10 digits if valid
            pass
            
        # Clean Address
        address = re.sub(r'[\r\n]+', ', ', col2).strip()
        address = re.sub(r'\s+', ' ', address).strip()
        address = address.replace(' ,', ',').replace(',,', ',').strip(' ,')
        if not address:
            address = "Noida"
            
        # Filter out empty/invalid phone: min 5 digits
        if not clean_phone or len(clean_phone) < 5 or clean_phone.lower() == 'notprovided':
            skipped_empty += 1
            continue
            
        rec_id = f"aar_{len(records) + 1:04d}"
        records.append({
            "id": rec_id,
            "name": name if name else "Devotee",
            "contact": clean_phone,
            "address": address,
            "initiative": "Apne Apne Ram",
            "details": address,
            "createdAt": "2026-10-15T10:30:00.000Z"
        })

output_path = r"C:\Users\My PC\.gemini\antigravity\scratch\initiative-dashboard\data\apne_apne_ram.json"
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(records, f, ensure_ascii=False, indent=2)

print(f"Extracted {len(records)} valid records for 'Apne Apne Ram'.")
print(f"Skipped {skipped_empty} empty/invalid phone records.")
print("Saved to:", output_path)
