// Initiative Central Dashboard - Frontend Logic

document.addEventListener('DOMContentLoaded', () => {
  // Application State
  const state = {
    records: [],
    stats: { total: 0, byInitiative: {} },
    selectedInitiative: 'All',
    searchQuery: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
    currentPage: 1,
    pageSize: 8,
    deleteTargetId: null,
    isEditing: false
  };

  // DOM Elements
  const initiativeFilter = document.getElementById('initiativeFilter');
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const sortBySelect = document.getElementById('sortBy');
  const tableBody = document.getElementById('tableBody');
  const emptyState = document.getElementById('emptyState');
  const emptyStateResetBtn = document.getElementById('emptyStateResetBtn');
  const activeFilterBar = document.getElementById('activeFilterBar');
  const activeFilterText = document.getElementById('activeFilterText');
  const resultsCountBadge = document.getElementById('resultsCountBadge');
  const clearAllFiltersBtn = document.getElementById('clearAllFiltersBtn');
  const paginationInfo = document.getElementById('paginationInfo');
  const prevPageBtn = document.getElementById('prevPageBtn');
  const nextPageBtn = document.getElementById('nextPageBtn');
  const pageNumbers = document.getElementById('pageNumbers');

  // Stats Counters
  const statTotalCount = document.getElementById('statTotalCount');
  const statRamCount = document.getElementById('statRamCount');
  const statDiwaliCount = document.getElementById('statDiwaliCount');
  const statShyamCount = document.getElementById('statShyamCount');
  const statSportsCount = document.getElementById('statSportsCount');

  // Stat Cards
  const statCards = document.querySelectorAll('.stat-card');

  // Modal Elements
  const recordModal = document.getElementById('recordModal');
  const recordForm = document.getElementById('recordForm');
  const modalTitle = document.getElementById('modalTitle');
  const modalIcon = document.getElementById('modalIcon');
  const saveBtnText = document.getElementById('saveBtnText');
  const addRecordBtn = document.getElementById('addRecordBtn');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const cancelModalBtn = document.getElementById('cancelModalBtn');

  // Form Fields
  const recordIdInput = document.getElementById('recordId');
  const formName = document.getElementById('formName');
  const formContact = document.getElementById('formContact');
  const formAddress = document.getElementById('formAddress');
  const formInitiative = document.getElementById('formInitiative');

  // Delete Modal
  const deleteModal = document.getElementById('deleteModal');
  const deleteTargetName = document.getElementById('deleteTargetName');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
  const closeDeleteModalBtn = document.getElementById('closeDeleteModalBtn');

  // Other buttons
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const resetDataBtn = document.getElementById('resetDataBtn');
  const toastContainer = document.getElementById('toastContainer');

  // Initiative Icon & Style Mapping
  const INITIATIVE_CONFIG = {
    'Apne Apne Ram': {
      class: 'badge-ram',
      icon: 'fa-om',
      emoji: '🚩'
    },
    'Diwali Event': {
      class: 'badge-diwali',
      icon: 'fa-fire',
      emoji: '🪔'
    },
    'Khatu Shyam': {
      class: 'badge-shyam',
      icon: 'fa-hands-praying',
      emoji: '🙏'
    },
    'Sports Talent': {
      class: 'badge-sports',
      icon: 'fa-trophy',
      emoji: '🏆'
    }
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
      }
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  }

  // Fetch Records with current filter, search & sort
  async function fetchRecords() {
    try {
      const params = new URLSearchParams({
        initiative: state.selectedInitiative,
        search: state.searchQuery,
        sortBy: state.sortBy,
        sortOrder: state.sortOrder
      });

      const res = await fetch(`/api/records?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        state.records = data.records;
        state.currentPage = 1; // Reset to page 1 on filter/search change
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

    if (state.selectedInitiative !== 'All' || state.searchQuery.trim() !== '') {
      let label = state.selectedInitiative !== 'All' ? `Initiative: "${state.selectedInitiative}"` : 'All Initiatives';
      if (state.searchQuery.trim()) {
        label += ` matching "${state.searchQuery}"`;
      }
      activeFilterText.textContent = `Showing: ${label}`;
      clearAllFiltersBtn.style.display = 'inline-block';
    } else {
      activeFilterText.textContent = 'Showing: All Initiatives';
      clearAllFiltersBtn.style.display = 'none';
    }
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

  // Render Table Rows with Pagination
  function renderTable() {
    tableBody.innerHTML = '';

    if (state.records.length === 0) {
      emptyState.style.display = 'flex';
      document.querySelector('.table-footer').style.display = 'none';
      return;
    }

    emptyState.style.display = 'none';
    document.querySelector('.table-footer').style.display = 'flex';

    // Pagination calculations
    const totalRecords = state.records.length;
    const totalPages = Math.ceil(totalRecords / state.pageSize) || 1;
    if (state.currentPage > totalPages) state.currentPage = totalPages;

    const startIdx = (state.currentPage - 1) * state.pageSize;
    const endIdx = Math.min(startIdx + state.pageSize, totalRecords);
    const paginatedRecords = state.records.slice(startIdx, endIdx);

    // Populate rows
    paginatedRecords.forEach((rec, idx) => {
      const tr = document.createElement('tr');
      const cfg = INITIATIVE_CONFIG[rec.initiative] || {
        class: 'badge-ram',
        icon: 'fa-tag',
        emoji: '📌'
      };

      const initials = getInitials(rec.name);

      tr.innerHTML = `
        <td>
          <div class="avatar">${initials}</div>
        </td>
        <td>
          <div class="member-info">
            <span class="member-name">${escapeHtml(rec.name)}</span>
            <span class="member-id">${rec.id}</span>
          </div>
        </td>
        <td>
          <div class="contact-cell">
            <i class="fa-solid fa-phone" style="font-size: 12px; color: var(--text-light);"></i>
            <span>${escapeHtml(rec.contact)}</span>
            <button class="copy-btn" data-copy="${escapeHtml(rec.contact)}" title="Copy Contact">
              <i class="fa-regular fa-copy"></i>
            </button>
          </div>
        </td>
        <td>
          <div class="address-cell">
            <i class="fa-solid fa-location-dot address-icon"></i>
            <span>${escapeHtml(rec.address)}</span>
          </div>
        </td>
        <td>
          <span class="initiative-badge ${cfg.class}">
            <i class="fa-solid ${cfg.icon}"></i>
            <span>${escapeHtml(rec.initiative)}</span>
          </span>
        </td>
        <td>
          <span class="date-cell">${formatDate(rec.createdAt)}</span>
        </td>
        <td>
          <div class="action-buttons">
            <button class="btn-icon edit" data-id="${rec.id}" title="Edit Member">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button class="btn-icon delete" data-id="${rec.id}" data-name="${escapeHtml(rec.name)}" title="Delete Member">
              <i class="fa-solid fa-trash-can"></i>
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
    for (let i = 1; i <= totalPages; i++) {
      const btn = document.createElement('button');
      btn.className = `page-num ${i === state.currentPage ? 'active' : ''}`;
      btn.textContent = i;
      btn.addEventListener('click', () => {
        state.currentPage = i;
        renderTable();
      });
      pageNumbers.appendChild(btn);
    }
  }

  // HTML Escape helper
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Set Initiative Filter Function
  function setInitiativeFilter(init) {
    state.selectedInitiative = init;
    initiativeFilter.value = init;

    // Update stat card active styles
    statCards.forEach(card => {
      if (card.dataset.initiative === init) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });

    fetchRecords();
  }

  // Event: Initiative Dropdown Change
  initiativeFilter.addEventListener('change', (e) => {
    setInitiativeFilter(e.target.value);
  });

  // Event: Click on any Stat Card
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

  // Event: Reset Filter Buttons
  function resetAllFilters() {
    searchInput.value = '';
    state.searchQuery = '';
    clearSearchBtn.style.display = 'none';
    setInitiativeFilter('All');
  }

  clearAllFiltersBtn.addEventListener('click', resetAllFilters);
  emptyStateResetBtn.addEventListener('click', resetAllFilters);

  // Pagination navigation
  prevPageBtn.addEventListener('click', () => {
    if (state.currentPage > 1) {
      state.currentPage--;
      renderTable();
    }
  });

  nextPageBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(state.records.length / state.pageSize);
    if (state.currentPage < totalPages) {
      state.currentPage++;
      renderTable();
    }
  });

  // Copy to clipboard click delegation
  tableBody.addEventListener('click', (e) => {
    const copyBtn = e.target.closest('.copy-btn');
    if (copyBtn) {
      const text = copyBtn.dataset.copy;
      navigator.clipboard.writeText(text).then(() => {
        showToast(`Copied "${text}" to clipboard`, 'success');
      });
      return;
    }

    // Edit button click
    const editBtn = e.target.closest('.btn-icon.edit');
    if (editBtn) {
      const id = editBtn.dataset.id;
      openEditModal(id);
      return;
    }

    // Delete button click
    const delBtn = e.target.closest('.btn-icon.delete');
    if (delBtn) {
      const id = delBtn.dataset.id;
      const name = delBtn.dataset.name;
      openDeleteModal(id, name);
      return;
    }
  });

  // Modal Open / Close Helpers
  function openAddModal() {
    state.isEditing = false;
    modalTitle.textContent = 'Add New Member';
    modalIcon.className = 'fa-solid fa-user-plus';
    saveBtnText.textContent = 'Save Record';

    recordForm.reset();
    recordIdInput.value = '';
    clearFormErrors();

    // Default to currently selected initiative if not 'All'
    if (state.selectedInitiative !== 'All') {
      formInitiative.value = state.selectedInitiative;
    }

    recordModal.classList.add('open');
    setTimeout(() => formName.focus(), 100);
  }

  function openEditModal(id) {
    const rec = state.records.find(r => r.id === id);
    if (!rec) return;

    state.isEditing = true;
    modalTitle.textContent = 'Edit Member Details';
    modalIcon.className = 'fa-solid fa-user-pen';
    saveBtnText.textContent = 'Update Record';

    recordIdInput.value = rec.id;
    formName.value = rec.name;
    formContact.value = rec.contact;
    formAddress.value = rec.address;
    formInitiative.value = rec.initiative;

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

  addRecordBtn.addEventListener('click', openAddModal);
  closeModalBtn.addEventListener('click', closeModal);
  cancelModalBtn.addEventListener('click', closeModal);

  // Close modals on Esc or backdrop click
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeDeleteModal();
    }
  });

  recordModal.addEventListener('click', (e) => {
    if (e.target === recordModal) closeModal();
  });

  deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) closeDeleteModal();
  });

  // Form Submission (Add or Edit)
  recordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFormErrors();

    const name = formName.value.trim();
    const contact = formContact.value.trim();
    const address = formAddress.value.trim();
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

    const payload = { name, contact, address, initiative };
    const id = recordIdInput.value;

    try {
      let res;
      if (state.isEditing && id) {
        // Update existing
        res = await fetch(`/api/records/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        // Create new
        res = await fetch('/api/records', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      const data = await res.json();
      if (data.success) {
        showToast(
          state.isEditing ? `Updated "${name}" successfully!` : `Added "${name}" to ${initiative}!`,
          'success'
        );
        closeModal();
        await fetchStats();
        await fetchRecords();
      } else {
        showToast(data.error || 'Failed to save record', 'error');
      }
    } catch (err) {
      console.error('Error saving record:', err);
      showToast('Error saving record to server', 'error');
    }
  });

  // Delete Modal Helpers
  function openDeleteModal(id, name) {
    state.deleteTargetId = id;
    deleteTargetName.textContent = name;
    deleteModal.classList.add('open');
  }

  function closeDeleteModal() {
    deleteModal.classList.remove('open');
    state.deleteTargetId = null;
  }

  closeDeleteModalBtn.addEventListener('click', closeDeleteModal);
  cancelDeleteBtn.addEventListener('click', closeDeleteModal);

  confirmDeleteBtn.addEventListener('click', async () => {
    if (!state.deleteTargetId) return;

    try {
      const res = await fetch(`/api/records/${state.deleteTargetId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        showToast('Record deleted successfully', 'success');
        closeDeleteModal();
        await fetchStats();
        await fetchRecords();
      } else {
        showToast(data.error || 'Failed to delete record', 'error');
      }
    } catch (err) {
      console.error('Error deleting record:', err);
      showToast('Error deleting record from server', 'error');
    }
  });

  // Export to CSV Button
  exportCsvBtn.addEventListener('click', () => {
    window.location.href = '/api/export/csv';
    showToast('Downloading CSV export...', 'info');
  });

  // Reset Sample Data
  resetDataBtn.addEventListener('click', async () => {
    if (!confirm('Reset all records back to default sample data? Any newly created entries will be reset.')) {
      return;
    }

    try {
      const res = await fetch('/api/reset', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('Sample dataset restored successfully!', 'success');
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

  // Initialize App
  fetchStats();
  fetchRecords();
});
