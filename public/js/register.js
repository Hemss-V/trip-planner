/**
 * Roamly — public registration
 * Validates the form and POSTs to /api/auth/register.
 */

(function () {
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PHONE_PATTERN = /^(?:\+91[\s-]?)?[6-9]\d{9}$/;
  const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  const ALLOWED_ROLES = ['CUSTOMER', 'PROVIDER'];

  const form = document.getElementById('register-form');
  const submitBtn = document.getElementById('register-submit');
  const formAlert = document.getElementById('form-alert');

  const fields = {
    fullName: document.getElementById('fullName'),
    email: document.getElementById('email'),
    phone: document.getElementById('phone'),
    password: document.getElementById('password'),
    confirmPassword: document.getElementById('confirmPassword')
  };

  function setFieldError(fieldName, message) {
    const input = fields[fieldName];
    const errorEl = document.getElementById(`${fieldName}-error`);
    if (errorEl) {
      errorEl.textContent = message || '';
    }
    if (input) {
      input.classList.toggle('is-invalid', Boolean(message));
      input.setAttribute('aria-invalid', message ? 'true' : 'false');
    }
  }

  function setAccountTypeError(message) {
    const errorEl = document.getElementById('accountType-error');
    if (errorEl) {
      errorEl.textContent = message || '';
    }
  }

  function showAlert(type, message) {
    formAlert.hidden = false;
    formAlert.className = `form-alert is-${type}`;
    formAlert.textContent = message;
  }

  function hideAlert() {
    formAlert.hidden = true;
    formAlert.textContent = '';
    formAlert.className = 'form-alert';
  }

  function readFormValues() {
    const accountTypeInput = form.querySelector('input[name="accountType"]:checked');
    return {
      fullName: fields.fullName.value.trim(),
      email: fields.email.value.trim().toLowerCase(),
      phone: fields.phone.value.trim().replace(/\s+/g, ''),
      password: fields.password.value,
      confirmPassword: fields.confirmPassword.value,
      accountType: accountTypeInput ? accountTypeInput.value : ''
    };
  }

  function validate(values) {
    const errors = {};

    if (!values.fullName) {
      errors.fullName = 'Full name is required.';
    } else if (values.fullName.length < 2) {
      errors.fullName = 'Enter your full name (at least 2 characters).';
    }

    if (!values.email) {
      errors.email = 'Email address is required.';
    } else if (!EMAIL_PATTERN.test(values.email)) {
      errors.email = 'Enter a valid email address.';
    }

    if (!values.phone) {
      errors.phone = 'Phone number is required.';
    } else if (!PHONE_PATTERN.test(values.phone)) {
      errors.phone = 'Enter a valid 10-digit Indian mobile number.';
    }

    if (!values.password) {
      errors.password = 'Password is required.';
    } else if (!PASSWORD_PATTERN.test(values.password)) {
      errors.password = 'Use 8+ characters with uppercase, lowercase, and a number.';
    }

    if (!values.confirmPassword) {
      errors.confirmPassword = 'Confirm your password.';
    } else if (values.password !== values.confirmPassword) {
      errors.confirmPassword = 'Password and confirm password do not match.';
    }

    if (!values.accountType) {
      errors.accountType = 'Select an account type.';
    } else if (!ALLOWED_ROLES.includes(values.accountType)) {
      errors.accountType = 'Admin accounts cannot be created from this form.';
    }

    return errors;
  }

  function applyErrors(errors) {
    setFieldError('fullName', errors.fullName);
    setFieldError('email', errors.email);
    setFieldError('phone', errors.phone);
    setFieldError('password', errors.password);
    setFieldError('confirmPassword', errors.confirmPassword);
    setAccountTypeError(errors.accountType);
    return Object.keys(errors).length === 0;
  }

  Object.keys(fields).forEach((name) => {
    fields[name].addEventListener('input', () => {
      const values = readFormValues();
      const errors = validate(values);
      setFieldError(name, errors[name]);
      if (name === 'password' || name === 'confirmPassword') {
        setFieldError('confirmPassword', errors.confirmPassword);
      }
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideAlert();

    const values = readFormValues();
    const isValid = applyErrors(validate(values));
    if (!isValid) {
      showAlert('error', 'Please fix the highlighted fields and try again.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account…';

    let succeeded = false;
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.fullName,
          email: values.email,
          phone: values.phone,
          password: values.password,
          role: values.accountType
        })
      });

      let payload = {};
      try {
        payload = await response.json();
      } catch (parseErr) {
        payload = {};
      }

      if (!response.ok || payload.success === false) {
        const message = payload.message || `Registration failed (HTTP ${response.status}).`;
        showAlert('error', message);
        return;
      }

      succeeded = true;
      showAlert('success', payload.message || 'Account created. Redirecting to sign in…');
      window.setTimeout(() => {
        window.location.href = 'login.html?registered=1';
      }, 1200);
    } catch (err) {
      showAlert('error', 'Unable to reach the server. Please try again.');
    } finally {
      if (!succeeded) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create account';
      }
    }
  });
})();
