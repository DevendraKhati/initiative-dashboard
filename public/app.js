// Initiative Central Dashboard - Frontend Logic (Phone-Only Duplicate Detection & Clean Navigation)

document.addEventListener('DOMContentLoaded', () => {
  // Application State
  const state = {
    records: [],
    stats: { total: 0, byInitiative: {}, duplicateCount: 0, uniqueCount: 0 },
    selectedInitiative: 'All',
    duplicateFilter: 'all', // 'all', 'duplicates_only', 'unique_only'
    searchQuery: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
    currentPage: 1,
    pageSize: 10,
    isEditing: false,
    lastUpdatedId: null
  };

  // DOM Elements
  const initiativeFilter = document.getElementById('initiativeFilter');
  const duplicateFilter = document.getElementById('duplicateFilter');
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const sortBySelect = document.getElementById('sortBy');
  const tableBody = document.getElementById('tableBody');
  const emptyState = document.getElementById('emptyState');
  const emptyStateResetBtn = document.getElementById('emptyStateResetBtn');
  const activeFilterText = document.getElementById('activeFilterText');
  const resultsCountBadge = document.getElementById('resultsCountBadge');
  const duplicatesCountBadge = document.getElementById('duplicatesCountBadge');
  const clearAllFiltersBtn = document.getElementById('clearAllFiltersBtn');
  const paginationInfo = document.getElementById('paginationInfo');
  const prevPageBtn = document.getElementById('prevPageBtn');
  const nextPageBtn = document.getElementById('nextPageBtn');
  const pageNumbers = document.getElementById('pageNumbers');

  // Homepage Navigation Links
  const brandHomeLink = document.getElementById('brandHomeLink');
  const homeNavBtn = document.getElementById('homeNavBtn');
  const modalHomeBreadcrumb = document.getElementById('modalHomeBreadcrumb');
  const modalHomeBtn = document.getElementById('modalHomeBtn');

  // Stats Counters
  const statTotalCount = document.getElementById('statTotalCount');
  const statRamCount = document.getElementById('statRamCount');
  const statDiwaliCount = document.getElementById('statDiwaliCount');
  const statShyamCount = document.getElementById('statShyamCount');
  const statSportsCount = document.getElementById('statSportsCount');
  const statGiftCount = document.getElementById('statGiftCount');

  // Stat Cards
  const statCards = document.querySelectorAll('.stat-card');

  // Modal Elements
  const recordModal = document.getElementById('recordModal');
  const recordForm = document.getElementById('recordForm');
  const modalTitle = document.getElementById('modalTitle');
  const modalIcon = document.getElementById('modalIcon');
  const saveBtnText = document.getElementById('saveBtnText');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const cancelModalBtn = document.getElementById('cancelModalBtn');

  // Form Fields
  const recordIdInput = document.getElementById('recordId');
  const formName = document.getElementById('formName');
  const formContact = document.getElementById('formContact');
  const formAddress = document.getElementById('formAddress');
  const formDetails = document.getElementById('formDetails');
  const formInitiative = document.getElementById('formInitiative');

  // Buttons
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const resetDataBtn = document.getElementById('resetDataBtn');
  const toastContainer = document.getElementById('toastContainer');

  // 5 Initiative Configurations
  const INITIATIVE_CONFIG = {
    'Apne Apne Ram': { class: 'badge-ram', icon: 'fa-om' },
    'Diwali Event': { class: 'badge-diwali', icon: 'fa-fire' },
    'Khatu Shyam': { class: 'badge-shyam', icon: 'fa-hands-praying' },
    'Sports Talent': { class: 'badge-sports', icon: 'fa-trophy' },
    'Gift Distribution': { class: 'badge-gift', icon: 'fa-gift' }
  };

  // Helper: Toast Notifications
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'fa-circle-info';
    if (type === 'success') icon = 'fa-circle-check';
    if (type === 'error') icon = 'fa-circle-exclamation';

    toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  // Fetch Stats from Backend
  async function fetchStats() {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      if (data.success) {
        state.stats = data.stats;
        statTotalCount.textContent = data.stats.total || 0;
        statRamCount.textContent = data.stats.byInitiative['Apne Apne Ram'] || 0;
        statDiwaliCount.textContent = data.stats.byInitiative['Diwali Event'] || 0;
        statShyamCount.textContent = data.stats.byInitiative['Khatu Shyam'] || 0;
        statSportsCount.textContent = data.stats.byInitiative['Sports Talent'] || 0;
        if (statGiftCount) {
          statGiftCount.textContent = data.stats.byInitiative['Gift Distribution'] || 0;
        }
      }
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  }

  // Fetch Records with current filter, search & sort
  async function fetchRecords(preservePage = false) {
    try {
      const params = new URLSearchParams({
        initiative: state.selectedInitiative,
        duplicateFilter: state.duplicateFilter,
        search: state.searchQuery,
        sortBy: state.sortBy,
        sortOrder: state.sortOrder
      });

      const res = await fetch(`/api/records?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        state.records = data.records;
        const totalPages = Math.ceil(state.records.length / state.pageSize) || 1;
        if (!preservePage) {
          state.currentPage = 1;
        } else {
          state.currentPage = Math.max(1, Math.min(state.currentPage, totalPages));
        }
        renderTable();
        updateFilterBar(data.total);
      }
    } catch (err) {
      console.error('Error fetching records:', err);
      showToast('Error connecting to local server', 'error');
    }
  }

  // Update Active Filter Bar
  function updateFilterBar(count) {
    resultsCountBadge.textContent = `${count} ${count === 1 ? 'record' : 'records'}`;

    const duplicatesInView = state.records.filter(r => r.isDuplicate).length;
    duplicatesCountBadge.textContent = `${duplicatesInView} duplicate phones`;
    duplicatesCountBadge.style.display = duplicatesInView > 0 ? 'inline-block' : 'none';

    let isFiltered = false;
    let label = 'All Initiatives';

    if (state.selectedInitiative !== 'All') {
      label = `Initiative: "${state.selectedInitiative}"`;
      isFiltered = true;
    }

    if (state.duplicateFilter === 'duplicates_only') {
      label += ' (Duplicate Phones Only)';
      isFiltered = true;
    } else if (state.duplicateFilter === 'unique_only') {
      label += ' (Unique Phones Only)';
      isFiltered = true;
    }

    if (state.searchQuery.trim()) {
      label += ` matching "${state.searchQuery}"`;
      isFiltered = true;
    }

    activeFilterText.textContent = `Showing: ${label}`;
    clearAllFiltersBtn.style.display = isFiltered ? 'inline-block' : 'none';
  }

  // Generate initials for avatar
  function getInitials(name) {
    if (!name) return '??';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  }

  // Format Date cleanly
  function formatDate(isoStr) {
    if (!isoStr) return 'N/A';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return isoStr;
    }
  }

  // HTML Escape helper
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Render Table Rows with Pagination, Modified Headers & Phone-Only Duplicate Highlighting
  function renderTable() {
    tableBody.innerHTML = '';

    if (state.records.length === 0) {
      emptyState.style.display = 'flex';
      document.querySelector('.table-footer').style.display = 'none';
      return;
    }

    emptyState.style.display = 'none';
    document.querySelector('.table-footer').style.display = 'flex';

    // Pagination
    const totalRecords = state.records.length;
    const totalPages = Math.ceil(totalRecords / state.pageSize) || 1;
    if (state.currentPage > totalPages) state.currentPage = totalPages;

    const startIdx = (state.currentPage - 1) * state.pageSize;
    const endIdx = Math.min(startIdx + state.pageSize, totalRecords);
    const paginatedRecords = state.records.slice(startIdx, endIdx);

    paginatedRecords.forEach((rec) => {
      const tr = document.createElement('tr');
      tr.setAttribute('data-record-id', rec.id);
      if (rec.isDuplicate) {
        tr.classList.add('row-duplicate');
      }
      if (state.lastUpdatedId === rec.id) {
        tr.classList.add('row-just-updated');
      }

      const cfg = INITIATIVE_CONFIG[rec.initiative] || {
        class: 'badge-ram',
        icon: 'fa-tag'
      };

      const initials = getInitials(rec.name);
      const isPhoneDup = rec.isDuplicate && rec.duplicateFields && rec.duplicateFields.includes('contact');

      // Contact cell with Phone Duplicate Highlight
      let contactHtml = '';
      if (isPhoneDup) {
        contactHtml = `
          <div class="dup-contact-box" title="Duplicate Phone Number: ${escapeHtml(rec.contact)}">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <span>${escapeHtml(rec.contact)}</span>
          </div>
        `;
      } else {
        contactHtml = `
          <div class="normal-contact-box">
            <i class="fa-solid fa-phone" style="font-size: 11px; color: var(--text-light);"></i>
            <span>${escapeHtml(rec.contact)}</span>
          </div>
        `;
      }

      // Duplicacy Status Column (Phone is Primary)
      let dupStatusHtml = '';
      if (rec.isDuplicate) {
        const reason = (rec.duplicateReasons && rec.duplicateReasons[0]) ? rec.duplicateReasons[0] : 'Duplicate Phone';
        dupStatusHtml = `
          <div class="dup-status-badge">
            <span class="pill-duplicate" title="${escapeHtml(reason)}">
              <i class="fa-solid fa-triangle-exclamation"></i> Duplicate Phone
            </span>
            <span class="dup-reason-text">${escapeHtml(reason)}</span>
          </div>
        `;
      } else {
        dupStatusHtml = `
          <span class="pill-unique">
            <i class="fa-solid fa-circle-check"></i> Unique Phone
          </span>
        `;
      }

      // Details / Bus Stand column
      const detailsTitle = rec.busStand || rec.details || (rec.initiative === 'Khatu Shyam' ? 'Bus Stand Not Set' : 'Standard Delivery');
      const subDetail = rec.preferredFriday ? `<div class="details-secondary"><i class="fa-regular fa-calendar"></i> ${escapeHtml(rec.preferredFriday)}</div>` : '';

      tr.innerHTML = `
        <td>
          <div class="avatar">${initials}</div>
        </td>
        <td>
          <div class="member-info">
            <span class="member-name">${escapeHtml(rec.name)}</span>
            <div class="member-meta">
              <span class="member-id">${rec.id}</span>
              ${rec.age ? `<span class="meta-tag">${escapeHtml(rec.age)} yrs</span>` : ''}
              ${rec.gender ? `<span class="meta-tag">${escapeHtml(rec.gender)}</span>` : ''}
            </div>
          </div>
        </td>
        <td>
          <div class="contact-cell">
            ${contactHtml}
            <button class="copy-btn" data-copy="${escapeHtml(rec.contact)}" title="Copy Phone">
              <i class="fa-regular fa-copy"></i>
            </button>
          </div>
        </td>
        <td>
          <div class="address-cell">
            <i class="fa-solid fa-location-dot address-icon"></i>
            <span>${escapeHtml(rec.address || 'Noida')}</span>
          </div>
        </td>
        <td>
          <div class="details-cell">
            <div class="details-primary">
              <i class="fa-solid ${rec.initiative === 'Khatu Shyam' ? 'fa-bus' : 'fa-box'}" style="font-size: 11px; color: var(--text-muted);"></i>
              <span>${escapeHtml(detailsTitle)}</span>
            </div>
            ${subDetail}
          </div>
        </td>
        <td>
          <span class="initiative-badge ${cfg.class}">
            <i class="fa-solid ${cfg.icon}"></i>
            <span>${escapeHtml(rec.initiative)}</span>
          </span>
        </td>
        <td>
          ${dupStatusHtml}
        </td>
        <td>
          <span class="date-cell">${formatDate(rec.createdAt)}</span>
        </td>
        <td style="text-align: right;">
          <div class="action-buttons">
            <button class="btn-icon edit" data-id="${rec.id}" title="Edit Member Details">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
          </div>
        </td>
      `;
      tableBody.appendChild(tr);
    });

    // Update Pagination UI
    paginationInfo.textContent = `Showing ${startIdx + 1} to ${endIdx} of ${totalRecords} entries`;
    prevPageBtn.disabled = state.currentPage <= 1;
    nextPageBtn.disabled = state.currentPage >= totalPages;

    renderPageNumbers(totalPages);
  }

  // Render Page Number Buttons
  function renderPageNumbers(totalPages) {
    pageNumbers.innerHTML = '';

    if (totalPages <= 1) return;

    let pagesToRender = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pagesToRender.push(i);
    } else {
      pagesToRender.push(1);
      if (state.currentPage > 3) pagesToRender.push('...');
      const start = Math.max(2, state.currentPage - 1);
      const end = Math.min(totalPages - 1, state.currentPage + 1);
      for (let i = start; i <= end; i++) {
        if (!pagesToRender.includes(i)) pagesToRender.push(i);
      }
      if (state.currentPage < totalPages - 2) pagesToRender.push('...');
      if (!pagesToRender.includes(totalPages)) pagesToRender.push(totalPages);
    }

    pagesToRender.forEach(p => {
      if (p === '...') {
        const span = document.createElement('span');
        span.className = 'page-num ellipsis';
        span.textContent = '...';
        pageNumbers.appendChild(span);
      } else {
        const btn = document.createElement('button');
        btn.className = `page-num ${p === state.currentPage ? 'active' : ''}`;
        btn.textContent = p;
        btn.addEventListener('click', () => {
          state.currentPage = p;
          renderTable();
          window.scrollTo({ top: 300, behavior: 'smooth' });
        });
        pageNumbers.appendChild(btn);
      }
    });
  }

  // Filter Handling: Initiative
  function setInitiativeFilter(init) {
    state.selectedInitiative = init;
    initiativeFilter.value = init;

    statCards.forEach(c => {
      if (c.dataset.initiative === init) {
        c.classList.add('active');
      } else {
        c.classList.remove('active');
      }
    });

    fetchRecords();
  }

  // Event: Initiative Select Dropdown Changed
  initiativeFilter.addEventListener('change', (e) => {
    setInitiativeFilter(e.target.value);
  });

  // Event: Duplicate Select Dropdown Changed
  duplicateFilter.addEventListener('change', (e) => {
    state.duplicateFilter = e.target.value;
    fetchRecords();
  });

  // Event: Stat Cards Clicked
  statCards.forEach(card => {
    card.addEventListener('click', () => {
      const init = card.dataset.initiative;
      setInitiativeFilter(init);
    });
  });

  // Event: Live Search with Debounce
  let searchTimeout = null;
  searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    clearSearchBtn.style.display = state.searchQuery ? 'block' : 'none';

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      fetchRecords();
    }, 250);
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    state.searchQuery = '';
    clearSearchBtn.style.display = 'none';
    fetchRecords();
  });

  // Event: Sort Changed
  sortBySelect.addEventListener('change', (e) => {
    const [field, order] = e.target.value.split('_');
    state.sortBy = field;
    state.sortOrder = order;
    fetchRecords();
  });

  // Reset Filters to Homepage State
  function resetAllFilters() {
    searchInput.value = '';
    state.searchQuery = '';
    clearSearchBtn.style.display = 'none';
    state.duplicateFilter = 'all';
    duplicateFilter.value = 'all';
    state.sortBy = 'createdAt';
    state.sortOrder = 'desc';
    sortBySelect.value = 'createdAt_desc';
    setInitiativeFilter('All');
  }

  clearAllFiltersBtn.addEventListener('click', resetAllFilters);
  emptyStateResetBtn.addEventListener('click', resetAllFilters);

  // Homepage Navigation / Redirection handlers
  function navigateToHome(e) {
    if (e) e.preventDefault();
    closeModal();
    resetAllFilters();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('Viewing Dashboard Homepage', 'info');
  }

  if (brandHomeLink) brandHomeLink.addEventListener('click', navigateToHome);
  if (homeNavBtn) homeNavBtn.addEventListener('click', navigateToHome);
  if (modalHomeBreadcrumb) modalHomeBreadcrumb.addEventListener('click', navigateToHome);
  if (modalHomeBtn) modalHomeBtn.addEventListener('click', navigateToHome);

  // Pagination navigation
  prevPageBtn.addEventListener('click', () => {
    if (state.currentPage > 1) {
      state.currentPage--;
      renderTable();
      window.scrollTo({ top: 300, behavior: 'smooth' });
    }
  });

  nextPageBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(state.records.length / state.pageSize);
    if (state.currentPage < totalPages) {
      state.currentPage++;
      renderTable();
      window.scrollTo({ top: 300, behavior: 'smooth' });
    }
  });

  // Table row actions delegation (copy, edit)
  tableBody.addEventListener('click', (e) => {
    const copyBtn = e.target.closest('.copy-btn');
    if (copyBtn) {
      const text = copyBtn.dataset.copy;
      navigator.clipboard.writeText(text).then(() => {
        showToast(`Copied "${text}" to clipboard`, 'success');
      });
      return;
    }

    const editBtn = e.target.closest('.btn-icon.edit');
    if (editBtn) {
      const id = editBtn.dataset.id;
      openEditModal(id);
      return;
    }
  });

  // Modal Functions
  function openEditModal(id) {
    const rec = state.records.find(r => r.id === id);
    if (!rec) return;

    state.isEditing = true;
    modalTitle.textContent = 'Edit Member Details';
    modalIcon.className = 'fa-solid fa-user-pen';
    saveBtnText.textContent = 'Update Record';

    recordIdInput.value = rec.id;
    formName.value = rec.name || '';
    formContact.value = rec.contact || '';
    formAddress.value = rec.address || '';
    if (formDetails) {
      formDetails.value = rec.busStand || rec.details || '';
    }
    formInitiative.value = rec.initiative || '';

    clearFormErrors();
    recordModal.classList.add('open');
    setTimeout(() => formName.focus(), 100);
  }

  function closeModal() {
    recordModal.classList.remove('open');
  }

  function clearFormErrors() {
    document.querySelectorAll('.form-group').forEach(fg => fg.classList.remove('has-error'));
  }

  closeModalBtn.addEventListener('click', closeModal);
  cancelModalBtn.addEventListener('click', closeModal);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  });

  recordModal.addEventListener('click', (e) => {
    if (e.target === recordModal) closeModal();
  });

  // Form Submission
  recordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFormErrors();

    const name = formName.value.trim();
    const contact = formContact.value.trim();
    const address = formAddress.value.trim();
    const details = formDetails ? formDetails.value.trim() : '';
    const initiative = formInitiative.value;

    let hasError = false;
    if (!name) {
      document.getElementById('nameError').closest('.form-group').classList.add('has-error');
      hasError = true;
    }
    if (!contact) {
      document.getElementById('contactError').closest('.form-group').classList.add('has-error');
      hasError = true;
    }
    if (!address) {
      document.getElementById('addressError').closest('.form-group').classList.add('has-error');
      hasError = true;
    }
    if (!initiative) {
      document.getElementById('initiativeError').closest('.form-group').classList.add('has-error');
      hasError = true;
    }

    if (hasError) return;

    const payload = {
      name,
      contact,
      address,
      busStand: details,
      details,
      initiative
    };
    const id = recordIdInput.value;

    try {
      if (!id) return;
      const res = await fetch(`/api/records/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        state.lastUpdatedId = id;

        // Immediate in-memory update for instant feedback
        if (data.record) {
          const idx = state.records.findIndex(r => r.id === id);
          if (idx !== -1) {
            state.records[idx] = data.record;
          }
        }

        showToast(`Updated "${name}" successfully!`, 'success');
        closeModal();
        await fetchStats();
        await fetchRecords(true); // Preserve current page

        // Remove highlight class after animation finishes
        setTimeout(() => {
          if (state.lastUpdatedId === id) {
            state.lastUpdatedId = null;
            const updatedRow = document.querySelector(`tr[data-record-id="${id}"]`);
            if (updatedRow) updatedRow.classList.remove('row-just-updated');
          }
        }, 3000);
      } else {
        showToast(data.error || 'Failed to update record', 'error');
      }
    } catch (err) {
      console.error('Error saving record:', err);
      showToast('Error saving record to server', 'error');
    }
  });

  // Export CSV (Handles both server mode and standalone/file mode)
  exportCsvBtn.addEventListener('click', () => {
    if (window.location.protocol.startsWith('http') && !window.__INITIAL_RECORDS__) {
      window.location.href = '/api/export/csv';
      showToast('Downloading CSV export with duplicate phone flags...', 'info');
      return;
    }

    // Client-side CSV export for standalone / file / GitHub Pages mode
    const recordsToExport = state.records && state.records.length ? state.records : (window.__INITIAL_RECORDS__ || []);
    const header = ['ID', 'Name', 'Contact', 'Residential Address', 'Bus Stand / Details', 'Preferred Friday', 'Age', 'Gender', 'Initiative', 'Phone Duplicate', 'Duplicate Reason', 'Created At'];
    const rows = recordsToExport.map(r => [
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

    const csvContent = '\uFEFF' + [header.join(','), ...rows.map(row => row.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `initiatives_export_${state.selectedInitiative.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Downloaded CSV (${recordsToExport.length} records)`, 'success');
  });

  // Reset Sample Data
  resetDataBtn.addEventListener('click', async () => {
    if (!confirm('Reset all records back to default dataset?')) {
      return;
    }

    try {
      const res = await fetch('/api/reset', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('Dataset restored successfully!', 'success');
        resetAllFilters();
        await fetchStats();
        await fetchRecords();
      } else {
        showToast('Failed to reset data', 'error');
      }
    } catch (err) {
      console.error('Error resetting data:', err);
      showToast('Server error while resetting data', 'error');
    }
  });

  // Initial Load
  fetchStats();
  fetchRecords();
});
