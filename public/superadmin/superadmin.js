/**
 * Roamly — Member 3: Super Admin Portal Controller
 * Pure Vanilla JavaScript DOM manipulation & Fetch API
 */

(function () {
  'use strict';

  let superAdminId = null; // Set from session on load
  let allAdmins = [];
  let logActionFilter = 'ALL';
  let logSearchQuery = '';

  const elements = {
    tabAdmins: document.getElementById('tab-super-admins'),
    tabLogs: document.getElementById('tab-super-logs'),
    viewAdmins: document.getElementById('sview-admins'),
    viewLogs: document.getElementById('sview-logs'),

    // Admins
    adminsTableBody: document.getElementById('super-admins-table-body'),
    btnRefreshAdmins: document.getElementById('btn-refresh-admins'),
    btnOpenCreateAdmin: document.getElementById('btn-open-create-admin'),

    // Create Admin Modal
    createAdminModal: document.getElementById('create-admin-modal'),
    createAdminForm: document.getElementById('create-admin-form'),
    btnCloseCreateAdmin: document.getElementById('btn-close-create-admin'),
    btnCancelCreateAdmin: document.getElementById('btn-cancel-create-admin'),

    // Edit Permissions Modal
    editPermsModal: document.getElementById('edit-perms-modal'),
    editPermsForm: document.getElementById('edit-perms-form'),
    editPermsAdminId: document.getElementById('edit-perms-admin-id'),
    editPermsModalTitle: document.getElementById('edit-perms-modal-title'),
    btnCloseEditPerms: document.getElementById('btn-close-edit-perms'),
    btnCancelEditPerms: document.getElementById('btn-cancel-edit-perms'),
    permModerate: document.getElementById('perm-moderate'),
    permDestinations: document.getElementById('perm-destinations'),
    permCategories: document.getElementById('perm-categories'),
    permUsers: document.getElementById('perm-users'),
    permReports: document.getElementById('perm-reports'),

    // Logs
    logsTableBody: document.getElementById('super-logs-table-body'),
    logActionFilter: document.getElementById('log-action-filter'),
    logSearchInput: document.getElementById('log-search-input'),
    btnRefreshLogs: document.getElementById('btn-refresh-logs'),

    // Toast
    toastBox: document.getElementById('provider-toast-box')
  };

  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }) + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (e) {
      return dateStr;
    }
  }

  function showToast(message, type = 'success') {
    if (!elements.toastBox) return;
    const toast = document.createElement('div');
    toast.className = `provider-toast ${type === 'error' ? 'toast-error' : ''}`;
    toast.innerHTML = `
      <span>${type === 'error' ? '⚠️' : '⚡'}</span>
      <span>${escapeHTML(message)}</span>
    `;
    elements.toastBox.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 260);
    }, 3500);
  }

  function switchSuperView(viewName) {
    elements.tabAdmins.classList.toggle('active', viewName === 'admins');
    elements.tabLogs.classList.toggle('active', viewName === 'logs');
    elements.viewAdmins.style.display = viewName === 'admins' ? 'block' : 'none';
    elements.viewLogs.style.display = viewName === 'logs' ? 'block' : 'none';

    if (viewName === 'admins') loadAdminsData();
    if (viewName === 'logs') loadLogsData();
  }

  // ==========================================
  // 1. ADMIN ACCOUNTS & PERMISSIONS
  // ==========================================
  async function loadAdminsData() {
    if (!elements.adminsTableBody) return;
    elements.adminsTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">Loading admin accounts…</td></tr>';

    try {
      const res = await fetch('/api/superadmin/admins');
      if (!res.ok) throw new Error('Failed to load admin accounts');
      const json = await res.json();
      allAdmins = json.data || [];

      elements.adminsTableBody.innerHTML = allAdmins.map(admin => {
        const isRoot = admin.role === 'SUPER_ADMIN';
        const perms = admin.permissions || [];
        const permsHtml = perms.map(p => `<span class="permission-chip">${p}</span>`).join('') || '<span style="color: var(--text-muted); font-size: 0.8rem;">None assigned</span>';

        return `
          <tr>
            <td>
              <div style="font-weight: 700; color: var(--primary);">${escapeHTML(admin.name)}</div>
              <div style="font-size: 0.76rem; color: var(--text-muted);">Admin ID #${admin.user_id}</div>
            </td>
            <td>
              <div>${escapeHTML(admin.email)}</div>
              <div style="font-size: 0.78rem; color: var(--text-muted);">${escapeHTML(admin.mobile || '')}</div>
            </td>
            <td>
              <span class="superadmin-badge" style="font-size: 0.72rem; ${isRoot ? 'background: #581C87; color: #fff;' : ''}">
                ${admin.role}
              </span>
            </td>
            <td style="max-width: 320px;">
              ${permsHtml}
            </td>
            <td>
              <span class="provider-status-badge ${admin.status === 'ACTIVE' ? 'badge-approved' : 'badge-rejected'}">
                ${admin.status}
              </span>
            </td>
            <td style="text-align: right; white-space: nowrap;">
              ${!isRoot ? `
                <div style="display: inline-flex; gap: 0.35rem;">
                  <button type="button" class="action-icon-btn" onclick='openEditPermsModal(${JSON.stringify(admin)})' title="Edit permissions">
                    ⚙️ Permissions
                  </button>
                  ${admin.status === 'ACTIVE' ? `
                    <button type="button" class="action-icon-btn action-btn-danger" onclick="toggleAdminStatus(${admin.user_id}, 'BLOCKED')" title="Deactivate admin">
                      🚫 Block
                    </button>
                  ` : `
                    <button type="button" class="action-icon-btn" onclick="toggleAdminStatus(${admin.user_id}, 'ACTIVE')" title="Reactivate admin" style="color: #2E7D32;">
                      ✅ Unblock
                    </button>
                  `}
                </div>
              ` : `
                <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">Root Owner</span>
              `}
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      elements.adminsTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #9B1C1C;">Error: ${err.message}</td></tr>`;
    }
  }

  // Create Admin
  async function handleCreateAdminSubmit(e) {
    e.preventDefault();
    const form = elements.createAdminForm;
    const checkedPerms = Array.from(form.querySelectorAll('input[name="permissions"]:checked')).map(el => el.value);

    const payload = {
      super_admin_id: superAdminId,
      name: elements.createAdminForm['admin-name'].value.trim(),
      email: elements.createAdminForm['admin-email'].value.trim(),
      mobile: elements.createAdminForm['admin-mobile'].value.trim(),
      password: elements.createAdminForm['admin-password'].value,
      permissions: checkedPerms
    };

    try {
      const res = await fetch('/api/superadmin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ? json.error.message : 'Creation failed');

      showToast(`Admin account "${payload.name}" created!`);
      form.reset();
      elements.createAdminModal.classList.remove('is-open');
      loadAdminsData();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  }

  // Edit Permissions
  window.openEditPermsModal = function(admin) {
    elements.editPermsAdminId.value = admin.user_id;
    elements.editPermsModalTitle.textContent = `Permissions: ${admin.name}`;

    const perms = admin.permissions || [];
    elements.permModerate.checked = perms.includes('MODERATE_PACKAGES');
    elements.permDestinations.checked = perms.includes('MANAGE_DESTINATIONS');
    elements.permCategories.checked = perms.includes('MANAGE_CATEGORIES');
    elements.permUsers.checked = perms.includes('MANAGE_USERS');
    elements.permReports.checked = perms.includes('VIEW_REPORTS');

    elements.editPermsModal.classList.add('is-open');
  };

  async function handleEditPermsSubmit(e) {
    e.preventDefault();
    const adminId = elements.editPermsAdminId.value;
    const permissions = [];
    if (elements.permModerate.checked) permissions.push('MODERATE_PACKAGES');
    if (elements.permDestinations.checked) permissions.push('MANAGE_DESTINATIONS');
    if (elements.permCategories.checked) permissions.push('MANAGE_CATEGORIES');
    if (elements.permUsers.checked) permissions.push('MANAGE_USERS');
    if (elements.permReports.checked) permissions.push('VIEW_REPORTS');

    try {
      const res = await fetch(`/api/superadmin/admins/${adminId}/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ super_admin_id: superAdminId, permissions })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ? json.error.message : 'Update failed');

      showToast('Admin permissions updated successfully!');
      elements.editPermsModal.classList.remove('is-open');
      loadAdminsData();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  }

  window.toggleAdminStatus = async function(adminId, status) {
    try {
      const res = await fetch(`/api/superadmin/admins/${adminId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ super_admin_id: superAdminId, status })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ? json.error.message : 'Update failed');

      showToast(`Admin status changed to ${status}`);
      loadAdminsData();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  };

  // ==========================================
  // 2. SYSTEM ACTIVITY AUDIT LOGS
  // ==========================================
  async function loadLogsData() {
    if (!elements.logsTableBody) return;
    elements.logsTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">Loading audit logs…</td></tr>';

    try {
      const res = await fetch(`/api/superadmin/logs?action=${encodeURIComponent(logActionFilter)}&search=${encodeURIComponent(logSearchQuery)}&limit=100`);
      if (!res.ok) throw new Error('Failed to load system logs');
      const json = await res.json();
      const logs = json.data.logs || [];
      const actions = json.data.availableActions || [];

      // Populate action filter dropdown once
      if (elements.logActionFilter && elements.logActionFilter.children.length <= 1) {
        actions.forEach(act => {
          const opt = document.createElement('option');
          opt.value = act;
          opt.textContent = act;
          elements.logActionFilter.appendChild(opt);
        });
      }

      if (logs.length === 0) {
        elements.logsTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">No activity logs match your filter criteria.</td></tr>';
        return;
      }

      elements.logsTableBody.innerHTML = logs.map(l => {
        let tagClass = 'tag-default';
        if (l.action.includes('LOGIN')) tagClass = 'tag-login';
        else if (l.action.includes('MODERAT')) tagClass = 'tag-moderation';
        else if (l.action.includes('USER') || l.action.includes('ADMIN')) tagClass = 'tag-user';
        else if (l.action.includes('DELETE') || l.action.includes('BLOCK')) tagClass = 'tag-security';

        const userName = l.user_name || 'System / Guest';
        const roleStr = l.user_role ? ` (${l.user_role})` : '';

        return `
          <tr>
            <td style="font-weight: 700; color: var(--text-muted);">#${l.log_id}</td>
            <td style="font-size: 0.82rem; white-space: nowrap;">${formatDateTime(l.created_at)}</td>
            <td>
              <div style="font-weight: 600;">${escapeHTML(userName)}</div>
              <div style="font-size: 0.76rem; color: var(--text-muted);">${escapeHTML(l.user_email || '')}${roleStr}</div>
            </td>
            <td>
              <span class="log-action-tag ${tagClass}">${escapeHTML(l.action)}</span>
            </td>
            <td style="font-size: 0.86rem; color: var(--text-primary); max-width: 440px;">
              ${escapeHTML(l.description)}
            </td>
            <td style="font-family: monospace; font-size: 0.8rem; color: var(--text-muted);">
              ${escapeHTML(l.ip_address || '127.0.0.1')}
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      elements.logsTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #9B1C1C;">Error: ${err.message}</td></tr>`;
    }
  }

  function setupEventListeners() {
    if (elements.tabAdmins) elements.tabAdmins.addEventListener('click', () => switchSuperView('admins'));
    if (elements.tabLogs) elements.tabLogs.addEventListener('click', () => switchSuperView('logs'));

    if (elements.btnRefreshAdmins) elements.btnRefreshAdmins.addEventListener('click', loadAdminsData);
    if (elements.btnRefreshLogs) elements.btnRefreshLogs.addEventListener('click', loadLogsData);

    // Create Admin Modal
    if (elements.btnOpenCreateAdmin) {
      elements.btnOpenCreateAdmin.addEventListener('click', () => elements.createAdminModal.classList.add('is-open'));
    }
    if (elements.btnCloseCreateAdmin) {
      elements.btnCloseCreateAdmin.addEventListener('click', () => elements.createAdminModal.classList.remove('is-open'));
    }
    if (elements.btnCancelCreateAdmin) {
      elements.btnCancelCreateAdmin.addEventListener('click', () => elements.createAdminModal.classList.remove('is-open'));
    }
    if (elements.createAdminForm) elements.createAdminForm.addEventListener('submit', handleCreateAdminSubmit);

    // Edit Permissions Modal
    if (elements.btnCloseEditPerms) {
      elements.btnCloseEditPerms.addEventListener('click', () => elements.editPermsModal.classList.remove('is-open'));
    }
    if (elements.btnCancelEditPerms) {
      elements.btnCancelEditPerms.addEventListener('click', () => elements.editPermsModal.classList.remove('is-open'));
    }
    if (elements.editPermsForm) elements.editPermsForm.addEventListener('submit', handleEditPermsSubmit);

    // Log Filters
    if (elements.logActionFilter) {
      elements.logActionFilter.addEventListener('change', e => {
        logActionFilter = e.target.value;
        loadLogsData();
      });
    }

    if (elements.logSearchInput) {
      elements.logSearchInput.addEventListener('input', e => {
        logSearchQuery = e.target.value.trim();
        loadLogsData();
      });
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    // Require SUPER_ADMIN session
    if (typeof RoamlySession !== 'undefined') {
      const user = await RoamlySession.requireRole('SUPER_ADMIN');
      if (!user) return; // redirect already triggered
      superAdminId = user.user_id;
    }

    setupEventListeners();
    loadAdminsData();
  });

})();

