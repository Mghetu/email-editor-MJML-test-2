const TOAST_TIMEOUTS = new Map();

function applyVariant(toast, variant) {
  toast.className = 'toast';
  if (variant) {
    toast.classList.add(`toast--${variant}`);
  }
  toast.classList.add('toast--visible');
}

export function showToast({
  id = 'app-toast',
  message,
  variant = 'info',
  duration = 4000,
  role = 'status',
} = {}) {
  if (!message) return null;

  let toast = document.getElementById(id);
  if (!toast) {
    toast = document.createElement('div');
    toast.id = id;
    toast.setAttribute('role', role);
    document.body.appendChild(toast);
  } else {
    toast.setAttribute('role', role);
  }

  const ariaLive = role === 'alert' ? 'assertive' : 'polite';
  toast.setAttribute('aria-live', ariaLive);

  applyVariant(toast, variant);
  toast.textContent = message;

  if (TOAST_TIMEOUTS.has(id)) {
    clearTimeout(TOAST_TIMEOUTS.get(id));
  }

  const timeoutId = window.setTimeout(() => {
    toast.classList.remove('toast--visible');
    TOAST_TIMEOUTS.delete(id);
  }, duration);

  TOAST_TIMEOUTS.set(id, timeoutId);
  return toast;
}

export default showToast;
