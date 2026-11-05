/**
 * Roamly - Customer Profile & Address Management (Member 1)
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const PHONE_PATTERN = /^(?:\+91[\s-]?)?[6-9]\d{9}$/;
  const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  const PINCODE_PATTERN = /^[1-9]\d{5}$/;
  const TYPE_ICONS = { HOME: '🏠', BILLING: '🧾', DELIVERY: '📦', OTHER: '📍' };

  let addresses = [];
  let editingId = null;
  let toastTimer = null;

  function toast(msg, isError = false) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.toggle('is-error', isError);
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), 3200);
  }

  function showAlert(id, msg, type = 'error') {
    const el = $(id);
    el.hidden = !msg;
    el.className = `form-alert is-${type}`;
    el.textContent = msg || '';
  }

  function fieldError(inputId, msg) {
    const input = $(inputId);
    input.classList.toggle('is-invalid', Boolean(msg));
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    const err = $(`${inputId}-error`);
    if (err) err.textContent = msg || '';
    return !msg;
  }

  function withBusy(button, label, fn) {
    return async (...args) => {
      const original = button.textContent;
      button.disabled = true;
      button.textContent = label;
      try {
        await fn(...args);
      } finally {
        button.disabled = false;
        button.textContent = original;
      }
    };
  }

  // ---------------- Profile ----------------

  function renderProfile(p) {
    const initials = p.name.split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase();
    $('profile-avatar').textContent = initials;
    $('profile-display-name').textContent = p.name;
    $('profile-display-email').textContent = p.email;
    if (p.created_at) $('profile-member-since').textContent = `Member since ${formatDate(p.created_at)}`;
    $('pf-name').value = p.name;
    $('pf-mobile').value = p.mobile || '';
    $('pf-email').value = p.email;
    if (p.stats) {
      $('ps-bookings').textContent = p.stats.total_bookings;
      $('ps-active').textContent = p.stats.active_bookings;
      $('ps-spent').textContent = formatINR(p.stats.total_spent);
    }
  }

  async function loadProfile() {
    const { data } = await apiRequest('GET', '/customer/profile');
    renderProfile(data);
  }

  const saveDetails = withBusy($('details-submit'), 'Saving…', async () => {
    showAlert('details-alert', '');
    const name = $('pf-name').value.trim();
    const mobile = $('pf-mobile').value.trim().replace(/\s+/g, '');

    const ok = [
      fieldError('pf-name', name.length < 2 ? 'Enter your full name.' : ''),
      fieldError('pf-mobile', !PHONE_PATTERN.test(mobile) ? 'Enter a valid 10-digit Indian mobile number.' : '')
    ].every(Boolean);
    if (!ok) return;

    try {
      const { data, message } = await apiRequest('PUT', '/customer/profile', { name, mobile });
      RoamlySession.setUser({ ...RoamlySession.getUser(), ...data });
      renderProfile({ ...data, stats: null });
      showAlert('details-alert', message, 'success');
      toast('Profile updated');
    } catch (err) {
      showAlert('details-alert', err.message);
    }
  });

  const savePassword = withBusy($('password-submit'), 'Updating…', async () => {
    showAlert('password-alert', '');
    const current = $('pw-current').value;
    const next = $('pw-new').value;
    const confirm = $('pw-confirm').value;

    const ok = [
      fieldError('pw-current', !current ? 'Enter your current password.' : ''),
      fieldError('pw-new', !PASSWORD_PATTERN.test(next) ? 'Use 8+ characters with uppercase, lowercase and a number.' : ''),
      fieldError('pw-confirm', next !== confirm ? 'Passwords do not match.' : '')
    ].every(Boolean);
    if (!ok) return;

    try {
      await apiRequest('PUT', '/customer/profile', { current_password: current, new_password: next });
      $('password-form').reset();
      showAlert('password-alert', 'Password updated. Use your new password next time you sign in.', 'success');
      toast('Password changed');
    } catch (err) {
      showAlert('password-alert', err.message);
      if (err.status === 401) fieldError('pw-current', err.message);
    }
  });

  // ---------------- Addresses ----------------

  function renderAddresses() {
    const list = $('address-list');
    if (addresses.length === 0) {
      list.innerHTML = `<div class="mini-empty" style="grid-column: 1 / -1;">No saved addresses yet. Add a billing address for faster checkout.</div>`;
      return;
    }
    list.innerHTML = addresses.map((a) => `
      <article class="address-card ${a.is_default ? 'is-default' : ''}">
        <div class="address-card-top">
          <span aria-hidden="true">${TYPE_ICONS[a.address_type] || '📍'}</span>
          <span class="address-type-tag">${escapeHTML(a.address_type)}</span>
          ${a.is_default ? '<span class="status-pill" style="margin-left:auto;">Default</span>' : ''}
        </div>
        <div>${escapeHTML(a.address_line)}</div>
        <div>${escapeHTML(a.city)}, ${escapeHTML(a.state)}${a.pincode ? ` – ${escapeHTML(a.pincode)}` : ''}</div>
        <div class="address-actions">
          <button type="button" class="link-btn" data-edit="${a.address_id}">Edit</button>
          ${a.is_default ? '' : `<button type="button" class="link-btn" data-default="${a.address_id}">Set default</button>`}
          <button type="button" class="link-btn is-danger" data-delete="${a.address_id}">Delete</button>
        </div>
      </article>
    `).join('');
  }

  async function loadAddresses() {
    const { data } = await apiRequest('GET', '/customer/addresses');
    addresses = data;
    renderAddresses();
  }

  function openAddressForm(address) {
    editingId = address ? address.address_id : null;
    $('address-form-title').textContent = address ? 'Edit Address' : 'Add Address';
    $('ad-type').value = address ? address.address_type : (addresses.length ? 'DELIVERY' : 'BILLING');
    $('ad-line').value = address ? address.address_line : '';
    $('ad-city').value = address ? address.city : '';
    $('ad-state').value = address ? address.state : '';
    $('ad-pincode').value = address ? (address.pincode || '') : '';
    $('ad-default').checked = address ? address.is_default : addresses.length === 0;
    $('ad-default').disabled = Boolean(address && address.is_default);
    ['ad-line', 'ad-city', 'ad-state', 'ad-pincode'].forEach((id) => fieldError(id, ''));
    showAlert('address-alert', '');
    $('address-form').hidden = false;
    $('ad-line').focus();
  }

  function closeAddressForm() {
    $('address-form').hidden = true;
    editingId = null;
  }

  function addressPayload(a) {
    return {
      address_type: a.address_type,
      address_line: a.address_line,
      city: a.city,
      state: a.state,
      pincode: a.pincode || '',
      is_default: a.is_default
    };
  }

  const saveAddress = withBusy($('address-submit'), 'Saving…', async () => {
    const payload = {
      address_type: $('ad-type').value,
      address_line: $('ad-line').value.trim(),
      city: $('ad-city').value.trim(),
      state: $('ad-state').value.trim(),
      pincode: $('ad-pincode').value.trim(),
      is_default: $('ad-default').checked
    };
    const ok = [
      fieldError('ad-line', payload.address_line.length < 5 ? 'Enter the full street address.' : ''),
      fieldError('ad-city', payload.city.length < 2 ? 'City is required.' : ''),
      fieldError('ad-state', payload.state.length < 2 ? 'State is required.' : ''),
      fieldError('ad-pincode', payload.pincode && !PINCODE_PATTERN.test(payload.pincode) ? 'Enter a valid 6-digit PIN code.' : '')
    ].every(Boolean);
    if (!ok) return;

    try {
      const json = editingId
        ? await apiRequest('PUT', `/customer/addresses/${editingId}`, payload)
        : await apiRequest('POST', '/customer/addresses', payload);
      addresses = json.data.addresses;
      renderAddresses();
      closeAddressForm();
      toast(json.message);
    } catch (err) {
      showAlert('address-alert', err.message);
    }
  });

  async function onAddressListClick(e) {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = Number(btn.dataset.edit || btn.dataset.default || btn.dataset.delete);
    const address = addresses.find((a) => a.address_id === id);
    if (!address) return;

    if (btn.dataset.edit) {
      openAddressForm(address);
      return;
    }

    try {
      let json;
      if (btn.dataset.default) {
        json = await apiRequest('PUT', `/customer/addresses/${id}`, { ...addressPayload(address), is_default: true });
        toast('Default address updated');
      } else {
        if (!window.confirm(`Delete this ${address.address_type.toLowerCase()} address in ${address.city}?`)) return;
        json = await apiRequest('DELETE', `/customer/addresses/${id}`);
        if (editingId === id) closeAddressForm();
        toast('Address removed');
      }
      addresses = json.data.addresses;
      renderAddresses();
    } catch (err) {
      toast(err.message, true);
    }
  }

  // ---------------- Init ----------------

  async function init() {
    const user = await RoamlySession.requireRole('CUSTOMER');
    if (!user) return;
    $('profile-root').hidden = false;
    renderProfile({ ...user, stats: null });

    $('details-form').addEventListener('submit', (e) => { e.preventDefault(); saveDetails(); });
    $('password-form').addEventListener('submit', (e) => { e.preventDefault(); savePassword(); });
    $('address-form').addEventListener('submit', (e) => { e.preventDefault(); saveAddress(); });
    $('address-add-btn').addEventListener('click', () => openAddressForm(null));
    $('address-cancel').addEventListener('click', closeAddressForm);
    $('address-list').addEventListener('click', onAddressListClick);

    try {
      await Promise.all([loadProfile(), loadAddresses()]);
    } catch (err) {
      toast(err.message, true);
    }
  }

  init();
})();
