/**
 * Roamly — Member 2: Customer Booking & Checkout Controller
 * Pure Vanilla JavaScript DOM manipulation & Fetch API
 */

(function () {
  'use strict';

  // State
  let packageData = null;
  let selectedAvailabilityId = null;
  let selectedDateString = null;
  let maxSeatsForSelectedDate = 20;
  let travelerCount = 1;
  let appliedCoupon = null; // { code, discount_amount, final_amount, discount_type, discount_value }
  let currentCustomerId = null; // Set from session on load
  let sessionUser = null;       // Full session user object

  // DOM Elements
  const el = {
    loadingState: document.getElementById('booking-loading-state'),
    errorState: document.getElementById('booking-error-state'),
    mainGrid: document.getElementById('booking-main-grid'),
    customerSelect: document.getElementById('customer-select'),
    
    // Summary
    pkgThumb: document.getElementById('summary-pkg-img'),
    pkgTitle: document.getElementById('summary-pkg-title'),
    pkgDest: document.getElementById('summary-pkg-dest'),
    pkgCategory: document.getElementById('summary-pkg-category'),
    pkgDuration: document.getElementById('summary-pkg-duration'),
    summaryDate: document.getElementById('summary-date-display'),
    summaryTravelers: document.getElementById('summary-travelers-display'),
    summaryUnitPrice: document.getElementById('summary-unit-price'),
    summarySubtotal: document.getElementById('summary-subtotal'),
    summaryDiscountRow: document.getElementById('summary-discount-row'),
    summaryAppliedCode: document.getElementById('summary-applied-code'),
    summaryDiscountAmount: document.getElementById('summary-discount-amount'),
    summaryGrandTotal: document.getElementById('summary-grand-total'),

    // Step 1: Dates
    datesContainer: document.getElementById('date-selection-container'),
    dateError: document.getElementById('date-error'),

    // Step 2: Travelers
    travelersInput: document.getElementById('travelers-input'),
    btnDecrement: document.getElementById('btn-decrement-travelers'),
    btnIncrement: document.getElementById('btn-increment-travelers'),
    travelersCountText: document.getElementById('travelers-count-text'),
    seatsRemainingHint: document.getElementById('seats-remaining-hint'),
    travelersError: document.getElementById('travelers-error'),

    // Step 3: Contact
    fullNameInput: document.getElementById('full-name'),
    emailInput: document.getElementById('email'),
    phoneInput: document.getElementById('phone'),
    specialRequestsInput: document.getElementById('special-requests'),

    // Step 4: Coupons
    couponInput: document.getElementById('coupon-code-input'),
    btnApplyCoupon: document.getElementById('btn-apply-coupon'),
    couponFeedback: document.getElementById('coupon-feedback'),
    quickCouponsContainer: document.getElementById('quick-coupons-container'),

    // Step 5: Payment
    paymentOptions: document.querySelectorAll('input[name="paymentMethod"]'),
    fieldUpi: document.getElementById('payment-field-upi'),
    fieldCard: document.getElementById('payment-field-card'),
    fieldNetbanking: document.getElementById('payment-field-netbanking'),
    fieldArrival: document.getElementById('payment-field-arrival'),
    checkoutForm: document.getElementById('checkout-form'),
    btnSubmit: document.getElementById('btn-submit-booking'),
    btnSubmitText: document.getElementById('btn-submit-text'),

    // Confirmation Modal
    ticketModal: document.getElementById('ticket-modal'),
    voucherRefCode: document.getElementById('voucher-ref-code'),
    voucherPkgTitle: document.getElementById('voucher-pkg-title'),
    voucherDateDisplay: document.getElementById('voucher-date-display'),
    voucherLeadName: document.getElementById('voucher-lead-name'),
    voucherTravelers: document.getElementById('voucher-travelers'),
    voucherAmount: document.getElementById('voucher-amount'),
    voucherPayMethod: document.getElementById('voucher-pay-method'),

    // Toast
    toastBox: document.getElementById('booking-toast-box')
  };

  /**
   * Currency formatter for Indian Rupee
   */
  function formatINR(amount) {
    const num = Number(amount);
    if (isNaN(num)) return '₹0';
    return '₹' + Math.round(num).toLocaleString('en-IN');
  }

  /**
   * Date formatter (e.g. "Thu, 15 Nov 2026")
   */
  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  }

  /**
   * Toast notification
   */
  function showToast(message, type = 'success') {
    if (!el.toastBox) return;
    const toast = document.createElement('div');
    toast.className = `provider-toast ${type === 'error' ? 'toast-error' : ''}`;
    toast.innerHTML = `
      <span>${type === 'error' ? '⚠️' : '✅'}</span>
      <span>${message}</span>
    `;
    el.toastBox.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 260);
    }, 3500);
  }

  /**
   * Initialize Customer details
   */
  function initCustomerProfile() {
    if (!sessionUser) return;
    if (el.fullNameInput && !el.fullNameInput.value) el.fullNameInput.value = sessionUser.name || '';
    if (el.emailInput && !el.emailInput.value) el.emailInput.value = sessionUser.email || '';
    // Hide the demo customer-switcher if present (not needed with real session)
    const switcherRow = el.customerSelect && el.customerSelect.closest('.form-group');
    if (switcherRow) switcherRow.style.display = 'none';
  }

  /**
   * Load package details from API
   */
  async function loadPackageDetails(packageId) {
    try {
      const res = await fetch(`/api/packages/${encodeURIComponent(packageId)}`);
      if (!res.ok) {
        throw new Error(`Package #${packageId} not found or inactive (HTTP ${res.status}).`);
      }
      const json = await res.json();
      if (!json.success || !json.data) {
        throw new Error(json.message || 'Unable to load tour package details.');
      }

      packageData = json.data;
      renderPackageSummary();
      renderAvailabilityDates();
      loadPromotionalCoupons();

      // Show checkout grid
      if (el.loadingState) el.loadingState.style.display = 'none';
      if (el.mainGrid) el.mainGrid.style.display = 'grid';
    } catch (err) {
      console.error('Error loading package:', err);
      if (el.loadingState) el.loadingState.style.display = 'none';
      if (el.errorState) {
        el.errorState.hidden = false;
        const msgEl = document.getElementById('booking-error-message');
        if (msgEl) msgEl.textContent = err.message;
      }
    }
  }

  /**
   * Render package summary card
   */
  function renderPackageSummary() {
    if (!packageData) return;
    const p = packageData;

    if (el.pkgThumb) {
      el.pkgThumb.src = p.image || 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80';
      el.pkgThumb.alt = p.title;
      el.pkgThumb.onerror = () => {
        el.pkgThumb.src = 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80';
      };
    }

    if (el.pkgTitle) el.pkgTitle.textContent = p.title;
    if (el.pkgDest) el.pkgDest.textContent = `${p.destination_name} (${p.city}, ${p.state})`;
    if (el.pkgCategory) el.pkgCategory.textContent = p.category_name;
    if (el.pkgDuration) el.pkgDuration.textContent = `${p.duration_days} Days / ${Math.max(1, p.duration_days - 1)} Nights`;
    if (el.summaryUnitPrice) el.summaryUnitPrice.textContent = formatINR(p.price);

    recalculatePrices();
  }

  /**
   * Render available departure dates as interactive selection chips
   */
  function renderAvailabilityDates() {
    if (!el.datesContainer) return;
    const dates = packageData.availability || [];

    // Filter to dates with open seats
    const validDates = dates.filter(d => d.seats_available > 0 && d.status !== 'CLOSED');

    if (validDates.length === 0) {
      el.datesContainer.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 1.5rem; text-align: center; background: var(--bg-surface-soft); border-radius: var(--radius-sm); color: var(--text-secondary);">
          ⚠️ There are currently no upcoming departure dates with open seats for this package.
        </div>
      `;
      if (el.btnSubmit) el.btnSubmit.disabled = true;
      return;
    }

    // Check if pre-selected date passed in URL query
    const urlParams = new URLSearchParams(window.location.search);
    const qDate = urlParams.get('date');

    el.datesContainer.innerHTML = validDates.map((d, idx) => {
      const isSelected = qDate ? (d.available_date === qDate) : (idx === 0);
      if (isSelected) {
        selectedAvailabilityId = d.availability_id;
        selectedDateString = d.available_date;
        maxSeatsForSelectedDate = d.seats_available;
      }

      return `
        <label class="date-chip-option ${isSelected ? 'active' : ''}">
          <input 
            type="radio" 
            name="availabilityDate" 
            value="${d.availability_id}" 
            data-date="${d.available_date}"
            data-seats="${d.seats_available}"
            ${isSelected ? 'checked' : ''}
          >
          <div class="date-chip-content">
            <div class="date-chip-calendar">📅</div>
            <div>
              <div class="date-chip-date">${formatDate(d.available_date)}</div>
              <div class="date-chip-seats">
                <span class="seat-dot"></span>
                <span>${d.seats_available} open seat${d.seats_available === 1 ? '' : 's'}</span>
              </div>
            </div>
          </div>
        </label>
      `;
    }).join('');

    // Attach listeners
    const dateInputs = el.datesContainer.querySelectorAll('input[name="availabilityDate"]');
    dateInputs.forEach(input => {
      input.addEventListener('change', () => {
        el.datesContainer.querySelectorAll('.date-chip-option').forEach(c => c.classList.remove('active'));
        input.closest('.date-chip-option').classList.add('active');

        selectedAvailabilityId = parseInt(input.value, 10);
        selectedDateString = input.getAttribute('data-date');
        maxSeatsForSelectedDate = parseInt(input.getAttribute('data-seats'), 10);

        // Reset traveler count if exceeds new limit
        if (travelerCount > maxSeatsForSelectedDate) {
          travelerCount = maxSeatsForSelectedDate;
          if (el.travelersInput) el.travelersInput.value = travelerCount;
        }

        updateAvailabilityDisplay();
        recalculatePrices();
      });
    });

    updateAvailabilityDisplay();
  }

  /**
   * Update traveler count & availability hints
   */
  function updateAvailabilityDisplay() {
    if (el.summaryDate) {
      el.summaryDate.textContent = selectedDateString ? formatDate(selectedDateString) : 'Please select date';
    }
    if (el.seatsRemainingHint) {
      el.seatsRemainingHint.textContent = `Max ${maxSeatsForSelectedDate} travelers can be booked on this departure`;
    }
    if (el.travelersInput) {
      el.travelersInput.max = maxSeatsForSelectedDate;
    }
  }

  /**
   * Fetch and display active promotional coupons for 1-click application
   */
  async function loadPromotionalCoupons() {
    if (!el.quickCouponsContainer) return;

    try {
      const res = await fetch('/api/coupons');
      if (!res.ok) return;
      const json = await res.json();
      const coupons = json.data || [];

      if (coupons.length === 0) {
        el.quickCouponsContainer.innerHTML = '<span style="color: var(--text-muted); font-size: 0.85rem;">No active coupons at this time.</span>';
        return;
      }

      el.quickCouponsContainer.innerHTML = coupons.map(c => {
        const discountBadge = c.discount_type === 'PERCENT' ? `${c.discount_value}% OFF` : `₹${Math.round(c.discount_value)} OFF`;
        return `
          <button 
            type="button" 
            class="coupon-pill-btn" 
            data-code="${c.code}"
            title="${c.description}"
          >
            <strong>🏷️ ${c.code}</strong>
            <span class="coupon-pill-disc">${discountBadge}</span>
          </button>
        `;
      }).join('');

      // Click-to-apply handlers
      const couponBtns = el.quickCouponsContainer.querySelectorAll('.coupon-pill-btn');
      couponBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const code = btn.getAttribute('data-code');
          if (el.couponInput) el.couponInput.value = code;
          validateAndApplyCoupon(code);
        });
      });
    } catch (err) {
      console.warn('Unable to load promotional coupons:', err);
    }
  }

  /**
   * Validate coupon code via AJAX
   */
  async function validateAndApplyCoupon(code) {
    if (!code) {
      showCouponFeedback('Please enter a coupon code.', 'error');
      return;
    }

    if (!packageData) return;
    const baseAmount = parseFloat(packageData.price) * travelerCount;

    if (el.btnApplyCoupon) {
      el.btnApplyCoupon.disabled = true;
      el.btnApplyCoupon.textContent = 'Validating…';
    }

    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim(),
          total_amount: baseAmount
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        appliedCoupon = null;
        showCouponFeedback(json.message || 'Invalid or expired promo code.', 'error');
        recalculatePrices();
        return;
      }

      appliedCoupon = json.data;
      showCouponFeedback(`🎉 ${json.message} Savings: ${formatINR(appliedCoupon.discount_amount)}`, 'success');
      showToast(`Coupon ${appliedCoupon.code} applied! Saved ${formatINR(appliedCoupon.discount_amount)}`);
      recalculatePrices();
    } catch (err) {
      appliedCoupon = null;
      showCouponFeedback('Unable to validate coupon. Please check connection.', 'error');
      recalculatePrices();
    } finally {
      if (el.btnApplyCoupon) {
        el.btnApplyCoupon.disabled = false;
        el.btnApplyCoupon.textContent = 'Apply Code';
      }
    }
  }

  /**
   * Display coupon validation feedback
   */
  function showCouponFeedback(msg, type) {
    if (!el.couponFeedback) return;
    el.couponFeedback.hidden = false;
    el.couponFeedback.className = `coupon-feedback ${type === 'success' ? 'is-success' : 'is-error'}`;
    el.couponFeedback.textContent = msg;
  }

  /**
   * Recalculate price totals
   */
  function recalculatePrices() {
    if (!packageData) return;

    const pricePerPerson = parseFloat(packageData.price) || 0;
    const subtotal = pricePerPerson * travelerCount;

    // Update Traveler summary displays
    if (el.summaryTravelers) {
      el.summaryTravelers.textContent = `${travelerCount} Traveler${travelerCount === 1 ? '' : 's'}`;
    }
    if (el.travelersCountText) {
      el.travelersCountText.textContent = `${travelerCount} Traveler${travelerCount === 1 ? '' : 's'}`;
    }
    if (el.summarySubtotal) {
      el.summarySubtotal.textContent = formatINR(subtotal);
    }

    // Calculate discount if coupon applied
    let discountAmount = 0;
    if (appliedCoupon) {
      if (appliedCoupon.discount_type === 'PERCENT') {
        discountAmount = (subtotal * appliedCoupon.discount_value) / 100;
        if (appliedCoupon.max_discount && discountAmount > appliedCoupon.max_discount) {
          discountAmount = appliedCoupon.max_discount;
        }
      } else {
        discountAmount = Math.min(appliedCoupon.discount_value, subtotal);
      }
      discountAmount = Math.round(discountAmount * 100) / 100;

      if (el.summaryDiscountRow) el.summaryDiscountRow.style.display = 'flex';
      if (el.summaryAppliedCode) el.summaryAppliedCode.textContent = appliedCoupon.code;
      if (el.summaryDiscountAmount) el.summaryDiscountAmount.textContent = `-${formatINR(discountAmount)}`;
    } else {
      if (el.summaryDiscountRow) el.summaryDiscountRow.style.display = 'none';
    }

    const grandTotal = Math.max(0, subtotal - discountAmount);
    if (el.summaryGrandTotal) {
      el.summaryGrandTotal.textContent = formatINR(grandTotal);
    }
    if (el.btnSubmitText) {
      el.btnSubmitText.textContent = `Pay ${formatINR(grandTotal)} & Confirm Booking`;
    }
  }

  /**
   * Form validation before submission
   */
  function validateBookingForm() {
    let isValid = true;

    // Clear previous errors
    if (el.dateError) el.dateError.textContent = '';
    if (el.travelersError) el.travelersError.textContent = '';
    const fnErr = document.getElementById('full-name-error');
    const emErr = document.getElementById('email-error');
    const phErr = document.getElementById('phone-error');
    if (fnErr) fnErr.textContent = '';
    if (emErr) emErr.textContent = '';
    if (phErr) phErr.textContent = '';

    if (!selectedAvailabilityId) {
      if (el.dateError) el.dateError.textContent = 'Please choose a departure date.';
      isValid = false;
    }

    if (travelerCount < 1 || travelerCount > maxSeatsForSelectedDate) {
      if (el.travelersError) el.travelersError.textContent = `Please select between 1 and ${maxSeatsForSelectedDate} travelers.`;
      isValid = false;
    }

    const name = el.fullNameInput.value.trim();
    if (!name || name.length < 2) {
      if (fnErr) fnErr.textContent = 'Please enter your full name.';
      isValid = false;
    }

    const email = el.emailInput.value.trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailPattern.test(email)) {
      if (emErr) emErr.textContent = 'Please enter a valid email address.';
      isValid = false;
    }

    const phone = el.phoneInput.value.trim().replace(/\s+/g, '');
    const phonePattern = /^(?:\+91[\s-]?)?[6-9]\d{9}$/;
    if (!phone || !phonePattern.test(phone)) {
      if (phErr) phErr.textContent = 'Enter a valid 10-digit Indian mobile number.';
      isValid = false;
    }

    return isValid;
  }

  /**
   * Handle Booking Submission
   */
  async function handleBookingSubmit(e) {
    e.preventDefault();

    if (!validateBookingForm()) {
      showToast('Please fix the errors in the form before proceeding.', 'error');
      return;
    }

    // Get selected payment method
    let selectedPaymentMethod = 'UPI';
    const checkedPay = document.querySelector('input[name="paymentMethod"]:checked');
    if (checkedPay) selectedPaymentMethod = checkedPay.value;

    const payload = {
      customer_id: currentCustomerId,
      package_id: packageData.package_id,
      availability_id: selectedAvailabilityId,
      travelers: travelerCount,
      coupon_code: appliedCoupon ? appliedCoupon.code : null,
      lead_passenger: {
        full_name: el.fullNameInput.value.trim(),
        email: el.emailInput.value.trim().toLowerCase(),
        phone: el.phoneInput.value.trim().replace(/\s+/g, ''),
        special_requests: el.specialRequestsInput.value.trim()
      },
      payment_method: selectedPaymentMethod
    };

    if (el.btnSubmit) {
      el.btnSubmit.disabled = true;
      el.btnSubmitText.textContent = 'Processing Payment & Securing Seats…';
    }

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Booking submission failed.');
      }

      // Show Confirmation Modal
      showConfirmationVoucher(json.data);
    } catch (err) {
      console.error('Booking failed:', err);
      showToast(err.message, 'error');
    } finally {
      if (el.btnSubmit) {
        el.btnSubmit.disabled = false;
        recalculatePrices();
      }
    }
  }

  /**
   * Display confirmed ticket voucher modal
   */
  function showConfirmationVoucher(data) {
    if (el.voucherRefCode) el.voucherRefCode.textContent = data.booking_reference || `ROAM-${String(data.booking_id).padStart(6, '0')}`;
    if (el.voucherPkgTitle) el.voucherPkgTitle.textContent = data.package_title;
    if (el.voucherDateDisplay) el.voucherDateDisplay.textContent = `📅 Departure: ${formatDate(data.travel_date)}`;
    if (el.voucherLeadName) el.voucherLeadName.textContent = data.lead_passenger.full_name;
    if (el.voucherTravelers) el.voucherTravelers.textContent = `${data.travelers} Traveler${data.travelers === 1 ? '' : 's'}`;
    if (el.voucherAmount) el.voucherAmount.textContent = formatINR(data.total_amount);
    if (el.voucherPayMethod) el.voucherPayMethod.textContent = data.payment_method;

    if (el.ticketModal) {
      el.ticketModal.classList.add('active');
    }

    showToast('🎉 Reservation confirmed! Booking details saved to database.');
  }

  /**
   * Setup event listeners
   */
  function setupEventListeners() {
    // Stepper buttons
    if (el.btnDecrement) {
      el.btnDecrement.addEventListener('click', () => {
        if (travelerCount > 1) {
          travelerCount--;
          if (el.travelersInput) el.travelersInput.value = travelerCount;
          recalculatePrices();
        }
      });
    }

    if (el.btnIncrement) {
      el.btnIncrement.addEventListener('click', () => {
        if (travelerCount < maxSeatsForSelectedDate) {
          travelerCount++;
          if (el.travelersInput) el.travelersInput.value = travelerCount;
          recalculatePrices();
        } else {
          showToast(`Only ${maxSeatsForSelectedDate} seat(s) available on this date.`, 'error');
        }
      });
    }

    if (el.travelersInput) {
      el.travelersInput.addEventListener('change', (e) => {
        let val = parseInt(e.target.value, 10);
        if (isNaN(val) || val < 1) val = 1;
        if (val > maxSeatsForSelectedDate) {
          val = maxSeatsForSelectedDate;
          showToast(`Capped to ${maxSeatsForSelectedDate} available seats.`, 'error');
        }
        travelerCount = val;
        el.travelersInput.value = travelerCount;
        recalculatePrices();
      });
    }

    // Coupon Apply button
    if (el.btnApplyCoupon && el.couponInput) {
      el.btnApplyCoupon.addEventListener('click', () => {
        validateAndApplyCoupon(el.couponInput.value);
      });
      el.couponInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          validateAndApplyCoupon(el.couponInput.value);
        }
      });
    }

    // Payment Tab Selector
    el.paymentOptions.forEach(opt => {
      opt.addEventListener('change', (e) => {
        const val = e.target.value;
        if (el.fieldUpi) el.fieldUpi.style.display = (val === 'UPI') ? 'block' : 'none';
        if (el.fieldCard) el.fieldCard.style.display = (val === 'CARD') ? 'block' : 'none';
        if (el.fieldNetbanking) el.fieldNetbanking.style.display = (val === 'NETBANKING') ? 'block' : 'none';
        if (el.fieldArrival) el.fieldArrival.style.display = (val === 'PAY_ON_ARRIVAL') ? 'block' : 'none';
      });
    });

    // Form Submit
    if (el.checkoutForm) {
      el.checkoutForm.addEventListener('submit', handleBookingSubmit);
    }
  }

  /**
   * DOM Ready
   */
  document.addEventListener('DOMContentLoaded', async () => {
    // Require CUSTOMER session — redirects to /login.html if not signed in
    if (typeof RoamlySession !== 'undefined') {
      sessionUser = await RoamlySession.requireRole('CUSTOMER');
      if (!sessionUser) return; // redirect already triggered
      currentCustomerId = sessionUser.user_id;
    }

    initCustomerProfile();
    setupEventListeners();

    // Read package_id from URL query
    const urlParams = new URLSearchParams(window.location.search);
    const packageId = urlParams.get('package_id') || urlParams.get('id') || '1';
    loadPackageDetails(packageId);
  });
})();

