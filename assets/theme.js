function setThemeMode(mode) {
  const body = document.body;
  body.classList.remove('light-theme', 'dark-theme');
  if (mode === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    body.classList.add(prefersDark ? 'dark-theme' : 'light-theme');
  } else {
    body.classList.add(`${mode}-theme`);
  }
}

function setPrimaryColor(color) {
  const body = document.body;
  body.classList.remove('blue-theme', 'pink-theme');
  body.classList.add(`${color}-theme`);
}

function setLang(lang) {
  document.querySelectorAll('[data-en]').forEach(el => {
    el.textContent = el.getAttribute(`data-${lang}`);
  });
}

function initTheme() {
  const mode = localStorage.getItem('themeMode') || 'auto';
  const color = localStorage.getItem('primaryColor') || 'blue';
  const lang = localStorage.getItem('language') || 'en';
  setThemeMode(mode);
  setPrimaryColor(color);
  setLang(lang);
}

window.addEventListener('DOMContentLoaded', initTheme);
