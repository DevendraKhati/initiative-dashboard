# 🌟 Initiative Central Dashboard

A modern, responsive full-stack web dashboard designed for managing community initiatives and enrolled members.

---

## 🎯 Initiatives Covered
1. **🚩 Apne Apne Ram** (Cultural & Spiritual)
2. **🪔 Diwali Event** (Festival Celebration)
3. **🙏 Khatu Shyam** (Devotional Yatra)
4. **🏆 Sports Talent** (Youth & Athletics)

---

## ✨ Features
- **📊 Modern KPI Cards:** Real-time counters for Total and each individual initiative (click any card to filter).
- **🔍 Smart Filtering & Search:**
  - Dedicated dropdown filter for all 4 initiatives.
  - Live instantaneous text search across Member Name, Contact Number, and Address.
  - Quick multi-criteria sorting (Newest, Oldest, A-Z, Z-A, Initiative).
- **📋 Interactive Data Table:**
  - Member Avatar & ID
  - Full Name
  - Contact Details (with one-click clipboard copy)
  - Address with location pin
  - Distinct color-coded initiative badges
  - Formatted Registration Date
- **⚡ Full CRUD Capability:** Add, Edit, and Delete members via modern modals with validation.
- **📥 Data Export & Reset:** One-click CSV export and sample data restore.
- **🌐 Deploy Anywhere:** Runs as a Node.js Express server locally or static GitHub Pages online.

---

## 🚀 Quick Start (Local)

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)

### 1. Clone & Install
```bash
git clone https://github.com/DevendraKhati/initiative-dashboard.git
cd initiative-dashboard
npm install
```

### 2. Start the Server
```bash
node server.js
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

> On Windows, you can also simply double-click **`run.bat`** to start the server and open the browser in one click.

---

## 🌐 Deploy to GitHub Pages (Free Instant Hosting)
1. Push this repository to GitHub.
2. In your GitHub repository, navigate to **Settings** > **Pages**.
3. Under **Build and deployment** > **Branch**, select `main` and `/ (root)`.
4. Click **Save**. Your dashboard will be live at `https://devendrakhati.github.io/initiative-dashboard/`!

---

## 📁 Project Structure
```
initiative-dashboard/
├── index.html                   # Root entry point (for GitHub Pages deployment)
├── server.js                    # Express.js REST API backend
├── package.json                 # Project dependencies & scripts
├── run.bat                      # Windows 1-click launcher
├── Initiative_Dashboard_Standalone.html  # Standalone offline app
├── data/
│   ├── records.json             # Persistent JSON database
│   └── seed.json                # Default seed dataset
└── public/
    ├── index.html               # Frontend dashboard template
    ├── style.css                # Custom CSS design system
    └── app.js                   # Client-side API integration & state
```

---

## 📄 License
MIT License
