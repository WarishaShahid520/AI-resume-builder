/**
 * storage.js
 * ---------------------------------------------------------------------------
 * Everything about saving and loading lives here:
 *   - the canonical shape of a resume ("blank")
 *   - normalize(): turns ANY input (old save, imported file, garbage) into a
 *     safe, correctly-shaped resume object
 *   - load / save / clear using localStorage (wrapped in try/catch because
 *     storage can be blocked, e.g. in private mode or when the quota is full)
 *   - theme persistence
 *   - exportJSON(): downloads the resume as a backup file
 *
 * Public API: window.Quill.Store
 */
(function (global) {
  'use strict';

  const Q = (global.Quill = global.Quill || {});

  const KEY_DATA = 'quill:resume:v1';   // bump the version if the data shape changes
  const KEY_THEME = 'quill:theme';
  const TEMPLATE_IDS = ['modern', 'classic', 'minimal', 'bold'];
  const DEFAULT_ACCENT = '#4f46e5';

  /** A completely empty resume. */
  function blank() {
    return {
      fullName: '',
      title: '',
      email: '',
      phone: '',
      location: '',
      link: '',
      summary: '',
      education: [],   // { school, degree, year, details }
      skills: [],      // string[]
      experience: [],  // { role, company, period, description }
      projects: [],    // { name, link, description }
      template: 'modern',
      accent: DEFAULT_ACCENT
    };
  }

  const str = (v) => (v === null || v === undefined ? '' : String(v));

  /** Normalizes a list of objects so each has exactly the given string keys. */
  function normalizeList(raw, keys) {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const out = {};
        keys.forEach((k) => { out[k] = str(item[k]); });
        return out;
      });
  }

  /**
   * Converts unknown input into a valid resume object.
   * Missing fields get defaults; wrong types are coerced or dropped.
   */
  function normalize(raw) {
    const d = blank();
    if (!raw || typeof raw !== 'object') return d;

    ['fullName', 'title', 'email', 'phone', 'location', 'link', 'summary'].forEach((k) => {
      d[k] = str(raw[k]);
    });

    // Skills may arrive as an array or a comma-separated string.
    const skills = Array.isArray(raw.skills)
      ? raw.skills
      : typeof raw.skills === 'string' ? raw.skills.split(',') : [];
    d.skills = skills.map((s) => str(s).trim()).filter(Boolean);

    d.education = normalizeList(raw.education, ['school', 'degree', 'year', 'details']);
    d.experience = normalizeList(raw.experience, ['role', 'company', 'period', 'description']);
    d.projects = normalizeList(raw.projects, ['name', 'link', 'description']);

    if (TEMPLATE_IDS.indexOf(raw.template) !== -1) d.template = raw.template;
    if (/^#[0-9a-f]{6}$/i.test(str(raw.accent))) d.accent = raw.accent.toLowerCase();

    return d;
  }

  /** Returns the saved resume, or null if nothing valid has been saved yet. */
  function load() {
    try {
      const text = global.localStorage.getItem(KEY_DATA);
      if (!text) return null;
      return normalize(JSON.parse(text));
    } catch (err) {
      return null;
    }
  }

  /** Saves the resume. Returns true on success, false if storage failed. */
  function save(state) {
    try {
      global.localStorage.setItem(KEY_DATA, JSON.stringify(state));
      return true;
    } catch (err) {
      return false;
    }
  }

  function clear() {
    try { global.localStorage.removeItem(KEY_DATA); } catch (err) { /* ignore */ }
  }

  function getTheme() {
    try { return global.localStorage.getItem(KEY_THEME); } catch (err) { return null; }
  }

  function setTheme(theme) {
    try { global.localStorage.setItem(KEY_THEME, theme); } catch (err) { /* ignore */ }
  }

  /** Small helper for one-time hints (e.g. the "Save as PDF" tip). */
  function flag(name, value) {
    const key = 'quill:flag:' + name;
    try {
      if (value === undefined) return global.localStorage.getItem(key) === '1';
      global.localStorage.setItem(key, value ? '1' : '0');
    } catch (err) { /* ignore */ }
    return false;
  }

  /** Downloads the resume as a .json backup the user can re-import later. */
  function exportJSON(state) {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'quill-resume.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  Q.Store = { blank, normalize, load, save, clear, getTheme, setTheme, flag, exportJSON, TEMPLATE_IDS };
})(typeof window !== 'undefined' ? window : globalThis);
