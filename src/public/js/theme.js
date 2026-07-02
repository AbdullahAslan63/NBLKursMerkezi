const STORAGE_KEY = 'nobelkurs-theme';

function refreshIcons() {
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

function getPreferredTheme() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEY, theme);

  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    const isDark = theme === 'dark';
    btn.setAttribute('aria-label', isDark ? 'Açık temaya geç' : 'Koyu temaya geç');

    const darkIcon = btn.querySelector('.theme-icon--dark');
    const lightIcon = btn.querySelector('.theme-icon--light');
    if (darkIcon) darkIcon.style.display = isDark ? 'none' : '';
    if (lightIcon) lightIcon.style.display = isDark ? '' : 'none';
  });

  refreshIcons();
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

document.addEventListener('DOMContentLoaded', () => {
  applyTheme(getPreferredTheme());

  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    btn.addEventListener('click', toggleTheme);
  });
});

export { applyTheme, toggleTheme, getPreferredTheme };
