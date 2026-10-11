/**
 * app.js
 * ---------------------------------------------------------------------------
 * Wires everything together. Sections:
 *   1.  Setup & helpers
 *   2.  State
 *   3.  Theme (dark mode)
 *   4.  Toasts
 *   5.  Simple form fields
 *   6.  Repeaters (education, experience, projects)
 *   7.  Skills tag input
 *   8.  Live preview (render, scale-to-fit, page counter)
 *   9.  Template & accent pickers
 *  10.  Resume strength meter
 *  11.  Auto-save (localStorage)
 *  12.  AI summary writer
 *  13.  Resume data menu (sample, export, import, clear)
 *  14.  PDF download
 *  15.  Mobile tabs, navigation, hero demo
 *  16.  Init
 */
(function () {
  'use strict';

  const { Store, Templates, AISummary } = window.Quill;

  /* ============================================================
     1. SETUP & HELPERS
     ============================================================ */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = Templates.esc;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const debounce = (fn, ms) => {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  };
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const icon = (name, cls) => `<svg class="icon${cls ? ' ' + cls : ''}"><use href="#i-${name}"/></svg>`;

  const PAPER_W = 794;   // A4 width at 96 dpi
  const PAPER_H = 1123;  // A4 height at 96 dpi

  /* ============================================================
     2. STATE
     The whole resume lives in one object. Every input writes into it,
     then commit() re-renders the preview and schedules a save.
     ============================================================ */
  const saved = Store.load();
  const firstVisit = saved === null;
  let state = saved || Store.normalize(window.SAMPLE_DATA);
  let tone = 'professional';

  /* ============================================================
     3. THEME
     ============================================================ */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    $('#themeToggle').setAttribute('aria-pressed', String(theme === 'dark'));
  }

  function initTheme() {
    applyTheme(document.documentElement.getAttribute('data-theme') || 'light');
    $('#themeToggle').addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      Store.setTheme(next);
    });
  }

  /* ============================================================
     4. TOASTS (small notifications, optionally with an action like Undo)
     ============================================================ */
  function toast(message, opts) {
    const options = opts || {};
    const region = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');

    const text = document.createElement('span');
    text.textContent = message;
    el.appendChild(text);

    function dismiss() {
      el.classList.add('is-leaving');
      setTimeout(() => el.remove(), 220);
    }

    if (options.action) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = options.action;
      btn.addEventListener('click', () => { if (options.onAction) options.onAction(); dismiss(); });
      el.appendChild(btn);
    }

    region.appendChild(el);
    setTimeout(dismiss, options.timeout || 4200);
  }

  /* ============================================================
     5. SIMPLE FORM FIELDS (anything with data-field="...")
     ============================================================ */
  function bindSimpleFields() {
    $$('[data-field]').forEach((input) => {
      input.addEventListener('input', () => {
        state[input.dataset.field] = input.value;
        if (input.dataset.field === 'summary') updateWordCount();
        commit();
      });
    });
  }

  function fillSimpleFields() {
    $$('[data-field]').forEach((input) => { input.value = state[input.dataset.field] || ''; });
    updateWordCount();
  }

  function updateWordCount() {
    const words = state.summary.trim().split(/\s+/).filter(Boolean).length;
    $('#summaryCount').textContent = words + (words === 1 ? ' word' : ' words') + (words ? ' · aim for 40 to 80' : '');
  }

  /* ============================================================
     6. REPEATERS (education, experience, projects)
     One config object drives all three lists.
     ============================================================ */
  const REPEATERS = {
    education: {
      singular: 'School',
      empty: 'Add a degree, course or certification.',
      blank: () => ({ school: '', degree: '', year: '', details: '' }),
      fields: [
        { key: 'school', label: 'School or institution', placeholder: 'University of Texas at Austin', full: true },
        { key: 'degree', label: 'Degree or course', placeholder: 'B.S. Computer Science' },
        { key: 'year', label: 'Years', placeholder: '2015 – 2019' },
        { key: 'details', label: 'Details (optional)', placeholder: 'Honors, GPA, relevant coursework', type: 'textarea', rows: 2, full: true }
      ]
    },
    experience: {
      singular: 'Role',
      empty: 'Add a job, internship or volunteer role.',
      blank: () => ({ role: '', company: '', period: '', description: '' }),
      fields: [
        { key: 'role', label: 'Job title', placeholder: 'Frontend Developer' },
        { key: 'company', label: 'Company', placeholder: 'Northwind Labs' },
        { key: 'period', label: 'Dates', placeholder: 'Mar 2022 – Present', full: true },
        { key: 'description', label: 'What you did', placeholder: 'One achievement per line', type: 'textarea', rows: 4, full: true }
      ]
    },
    projects: {
      singular: 'Project',
      empty: 'Add something you built. Personal and school projects count.',
      blank: () => ({ name: '', link: '', description: '' }),
      fields: [
        { key: 'name', label: 'Project name', placeholder: 'Habit Grove' },
        { key: 'link', label: 'Link (optional)', placeholder: 'github.com/you/project' },
        { key: 'description', label: 'Description', placeholder: 'What it does and what you used', type: 'textarea', rows: 3, full: true }
      ]
    }
  };

  function cardHTML(kind, item, index, total, isNew) {
    const cfg = REPEATERS[kind];
    const fields = cfg.fields.map((f) => {
      const id = `${kind}-${index}-${f.key}`;
      const attrs = `id="${id}" data-kind="${kind}" data-index="${index}" data-key="${f.key}" placeholder="${esc(f.placeholder)}"`;
      const control = f.type === 'textarea'
        ? `<textarea ${attrs} rows="${f.rows || 3}">${esc(item[f.key])}</textarea>`
        : `<input ${attrs} type="text" value="${esc(item[f.key])}">`;
      return `<div class="field${f.full ? ' span-2' : ''}"><label for="${id}">${f.label}</label>${control}</div>`;
    }).join('');

    return `
      <div class="entry-card${isNew ? ' is-new' : ''}">
        <div class="entry-card-head">
          <span class="entry-card-title">${cfg.singular} ${index + 1}</span>
          <div class="entry-tools">
            <button type="button" class="icon-btn icon-btn-s" data-action="up" data-kind="${kind}" data-index="${index}" aria-label="Move ${cfg.singular.toLowerCase()} ${index + 1} up" ${index === 0 ? 'disabled' : ''}>${icon('up')}</button>
            <button type="button" class="icon-btn icon-btn-s" data-action="down" data-kind="${kind}" data-index="${index}" aria-label="Move ${cfg.singular.toLowerCase()} ${index + 1} down" ${index === total - 1 ? 'disabled' : ''}>${icon('chevron')}</button>
            <button type="button" class="icon-btn icon-btn-s is-danger" data-action="remove" data-kind="${kind}" data-index="${index}" aria-label="Remove ${cfg.singular.toLowerCase()} ${index + 1}">${icon('trash')}</button>
          </div>
        </div>
        <div class="grid-2">${fields}</div>
      </div>`;
  }

  function renderRepeater(kind, newIndex) {
    const cfg = REPEATERS[kind];
    const list = state[kind];
    const box = $(`#${kind}List`);

    box.innerHTML = list.length
      ? list.map((item, i) => cardHTML(kind, item, i, list.length, i === newIndex)).join('')
      : `<p class="empty-note">${cfg.empty}</p>`;

    updateCount(kind);
  }

  function updateCount(kind) {
    const badge = $(`[data-count="${kind}"]`);
    const n = state[kind].length;
    badge.textContent = n ? String(n) : '';
  }

  function bindRepeaters() {
    Object.keys(REPEATERS).forEach((kind) => {
      const box = $(`#${kind}List`);

      // Typing in any field updates state in place (no re-render, so focus is kept).
      box.addEventListener('input', (e) => {
        const t = e.target;
        if (!t.dataset || !t.dataset.key) return;
        state[kind][Number(t.dataset.index)][t.dataset.key] = t.value;
        commit();
      });

      // Move / remove buttons.
      box.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn || btn.disabled) return;
        const i = Number(btn.dataset.index);
        const list = state[kind];

        if (btn.dataset.action === 'remove') {
          list.splice(i, 1);
        } else if (btn.dataset.action === 'up' && i > 0) {
          [list[i - 1], list[i]] = [list[i], list[i - 1]];
        } else if (btn.dataset.action === 'down' && i < list.length - 1) {
          [list[i + 1], list[i]] = [list[i], list[i + 1]];
        }
        renderRepeater(kind);
        commit();
      });
    });

    // "Add ..." buttons.
    $$('[data-add]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const kind = btn.dataset.add;
        state[kind].push(REPEATERS[kind].blank());
        const index = state[kind].length - 1;
        renderRepeater(kind, index);
        const first = $(`#${kind}-${index}-${REPEATERS[kind].fields[0].key}`);
        if (first) first.focus();
        commit();
      });
    });
  }

  /* ============================================================
     7. SKILLS TAG INPUT
     ============================================================ */
  function renderTags() {
    const box = $('#skillTags');
    const input = $('#skillInput');
    $$('.tag', box).forEach((n) => n.remove());

    state.skills.forEach((skill, i) => {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.innerHTML = `${esc(skill)}<button type="button" data-i="${i}" aria-label="Remove ${esc(skill)}">${icon('plus', 'icon-x')}</button>`;
      box.insertBefore(tag, input);
    });

    const n = state.skills.length;
    $('[data-count="skills"]').textContent = n ? String(n) : '';
  }

  function addSkills(text) {
    const incoming = text.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
    if (!incoming.length) return;
    const have = new Set(state.skills.map((s) => s.toLowerCase()));
    incoming.forEach((s) => {
      if (!have.has(s.toLowerCase())) { state.skills.push(s); have.add(s.toLowerCase()); }
    });
    renderTags();
    commit();
  }

  function bindTags() {
    const box = $('#skillTags');
    const input = $('#skillInput');

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addSkills(input.value);
        input.value = '';
      } else if (e.key === 'Backspace' && !input.value && state.skills.length) {
        state.skills.pop();
        renderTags();
        commit();
      }
    });

    input.addEventListener('paste', () => {
      // Wait for the pasted text to land in the input, then split it.
      setTimeout(() => { if (/[,;\n]/.test(input.value)) { addSkills(input.value); input.value = ''; } }, 0);
    });

    input.addEventListener('blur', () => { addSkills(input.value); input.value = ''; });

    box.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-i]');
      if (btn) {
        state.skills.splice(Number(btn.dataset.i), 1);
        renderTags();
        commit();
      } else {
        input.focus();
      }
    });
  }

  /* ============================================================
     8. LIVE PREVIEW
     ============================================================ */
  let lastTemplate = null;

  function renderPreview() {
    const paper = $('#resumePaper');
    paper.className = 'paper tpl-' + state.template;
    paper.style.setProperty('--accent', state.accent);
    paper.innerHTML = Templates.render(state);

    // Fade the paper in when the template changes (answers the user's click).
    if (lastTemplate !== null && lastTemplate !== state.template && !reduceMotion) {
      paper.classList.remove('swap');
      void paper.offsetWidth; // restart the CSS animation
      paper.classList.add('swap');
    }
    lastTemplate = state.template;
    fitPreview();
  }

  /** Scales the A4 paper down to fit the available width and updates the page counter. */
  function fitPreview() {
    const stage = $('#stage');
    const box = $('#paperBox');
    const scaler = $('#paperScaler');

    const cs = getComputedStyle(stage);
    const available = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    if (available <= 0) return; // hidden (e.g. mobile "Edit" tab)

    const scale = Math.min(1, available / PAPER_W);
    scaler.style.transform = `scale(${scale})`;
    box.style.width = PAPER_W * scale + 'px';
    box.style.height = scaler.offsetHeight * scale + 'px';

    const pages = Math.max(1, Math.ceil((scaler.offsetHeight - 2) / PAPER_H));
    const badge = $('#pageCount');
    badge.textContent = pages === 1 ? '1 page' : `${pages} pages · trim to fit one`;
    badge.classList.toggle('is-warn', pages > 1);
  }

  /* ============================================================
     9. TEMPLATE & ACCENT PICKERS
     ============================================================ */
  const ACCENTS = [
    { name: 'Indigo', value: '#4f46e5' },
    { name: 'Ocean', value: '#0e7490' },
    { name: 'Rose', value: '#be185d' },
    { name: 'Ember', value: '#c2410c' },
    { name: 'Forest', value: '#15803d' },
    { name: 'Slate', value: '#1e293b' }
  ];

  function buildPickers() {
    $('#templateList').innerHTML = Templates.list.map((t) => `
      <button type="button" class="tpl-btn" data-template="${t.id}" aria-pressed="false">
        <span class="tpl-thumb">${Templates.thumb(t.id)}</span>
        <span class="tpl-name">${t.name}</span>
      </button>`).join('');

    $('#accentList').innerHTML = ACCENTS.map((a) => `
      <button type="button" class="swatch" data-accent="${a.value}" style="--c:${a.value}" aria-label="${a.name}" aria-pressed="false" title="${a.name}"></button>`).join('')
      + `<label class="swatch swatch-custom" title="Custom color"><input type="color" id="accentCustom" aria-label="Custom accent color"></label>`;

    $('#templateList').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-template]');
      if (!btn) return;
      state.template = btn.dataset.template;
      syncDesignControls();
      commit();
    });

    $('#accentList').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-accent]');
      if (!btn) return;
      state.accent = btn.dataset.accent;
      syncDesignControls();
      commit();
    });

    $('#accentCustom').addEventListener('input', (e) => {
      state.accent = e.target.value.toLowerCase();
      syncDesignControls();
      commit();
    });
  }

  function syncDesignControls() {
    $$('[data-template]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.template === state.template)));
    const isPreset = ACCENTS.some((a) => a.value === state.accent);
    $$('[data-accent]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.accent === state.accent)));
    const custom = $('#accentCustom');
    custom.value = state.accent;
    custom.parentElement.classList.toggle('is-active', !isPreset);
    custom.parentElement.style.setProperty('--c', state.accent);
  }

  /* ============================================================
     10. RESUME STRENGTH METER
     Simple completeness checks. Each missing item becomes the "next step" tip.
     ============================================================ */
  function updateStrength() {
    const words = state.summary.trim().split(/\s+/).filter(Boolean).length;
    const checks = [
      [state.fullName.trim().length > 1, 'Add your full name'],
      [state.title.trim().length > 1, 'Add a job title'],
      [/.+@.+\..+/.test(state.email.trim()), 'Add a valid email address'],
      [state.phone.replace(/\D/g, '').length >= 7, 'Add a phone number'],
      [words >= 25, 'Write a summary of at least 25 words'],
      [state.skills.length >= 5, 'Add at least 5 skills'],
      [state.experience.some((e) => e.role.trim() && e.description.trim()), 'Describe at least one role'],
      [state.education.some((e) => e.school.trim() || e.degree.trim()), 'Add your education'],
      [state.projects.some((p) => p.name.trim()), 'Add a project']
    ];

    const passed = checks.filter((c) => c[0]).length;
    const pct = Math.round((passed / checks.length) * 100);
    const next = checks.find((c) => !c[0]);

    $('#strengthValue').textContent = pct + '%';
    $('#strengthBar').setAttribute('aria-valuenow', String(pct));
    $('#strengthBar').firstElementChild.style.width = pct + '%';
    $('#strengthTip').textContent = next ? 'Next: ' + next[1].charAt(0).toLowerCase() + next[1].slice(1) : 'Looking complete. Nice work.';
  }

  /* ============================================================
     11. AUTO-SAVE
     ============================================================ */
  function setSaveStatus(status) {
    const el = $('#saveStatus');
    el.dataset.state = status;
    $('#saveText').textContent =
      status === 'saving' ? 'Saving…'
        : status === 'saved' ? 'Saved in this browser'
          : 'Could not save (browser storage is blocked or full)';
  }

  const saveSoon = debounce(() => setSaveStatus(Store.save(state) ? 'saved' : 'error'), 450);

  function commit() {
    renderPreview();
    updateStrength();
    setSaveStatus('saving');
    saveSoon();
  }

  /** Re-populates every control from `state` (used after load / import / undo). */
  function refreshAll() {
    fillSimpleFields();
    Object.keys(REPEATERS).forEach((k) => renderRepeater(k));
    renderTags();
    syncDesignControls();
    lastTemplate = null; // no swap animation on bulk changes
    commit();
  }

  /** Replaces the whole resume and offers Undo. */
  function replaceState(next, message) {
    const previous = JSON.parse(JSON.stringify(state));
    state = next;
    refreshAll();
    toast(message, { action: 'Undo', onAction: () => { state = previous; refreshAll(); } });
  }

  /* ============================================================
     12. AI SUMMARY WRITER
     ============================================================ */
  let aiBusy = false;

  function bindTone() {
    $('#toneList').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-tone]');
      if (!btn) return;
      tone = btn.dataset.tone;
      $$('.tone-btn').forEach((b) => {
        const on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-checked', String(on));
      });
    });
  }

  async function runAI() {
    if (aiBusy) return;

    const text = AISummary.generate(state, tone);
    if (!text) {
      toast('Add a job title, a few skills or one role first. The AI needs something to work from.');
      $('[data-field="title"]').focus();
      return;
    }

    aiBusy = true;
    const btn = $('#aiGenerate');
    const label = $('#aiLabel');
    const area = $('#summary');
    const previous = state.summary;

    btn.classList.add('is-loading');
    btn.disabled = true;
    label.textContent = 'Thinking…';
    await sleep(reduceMotion ? 0 : 800);

    label.textContent = 'Writing…';
    area.classList.add('is-streaming');
    await AISummary.stream(text, (partial) => {
      state.summary = partial;
      area.value = partial;
      updateWordCount();
      commit();
    });

    area.classList.remove('is-streaming');
    btn.classList.remove('is-loading');
    btn.disabled = false;
    label.textContent = 'Regenerate';
    aiBusy = false;

    toast('Summary written. Edit it so it sounds like you.', {
      action: previous.trim() ? 'Undo' : null,
      onAction: () => { state.summary = previous; area.value = previous; updateWordCount(); commit(); }
    });
  }

  /* ============================================================
     13. RESUME DATA MENU
     ============================================================ */
  function bindDataMenu() {
    const trigger = $('#dataMenuBtn');
    const menu = $('#dataMenu');

    const setOpen = (open) => {
      menu.hidden = !open;
      trigger.setAttribute('aria-expanded', String(open));
    };

    trigger.addEventListener('click', (e) => { e.stopPropagation(); setOpen(menu.hidden); });
    document.addEventListener('click', (e) => { if (!menu.contains(e.target)) setOpen(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });

    menu.addEventListener('click', (e) => {
      const item = e.target.closest('[data-menu]');
      if (!item) return;
      setOpen(false);

      switch (item.dataset.menu) {
        case 'sample':
          replaceState(Store.normalize(window.SAMPLE_DATA), 'Sample resume loaded.');
          break;
        case 'export':
          Store.exportJSON(state);
          toast('Backup downloaded as quill-resume.json.');
          break;
        case 'import':
          $('#importFile').click();
          break;
        case 'clear': {
          const empty = Store.blank();
          empty.template = state.template;
          empty.accent = state.accent;
          replaceState(empty, 'Resume cleared.');
          break;
        }
      }
    });

    $('#importFile').addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = ''; // allow re-importing the same file later
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        replaceState(Store.normalize(parsed), 'Resume imported.');
      } catch (err) {
        toast('That file is not a valid Quill resume export. Choose a .json file you exported from here.');
      }
    });
  }

  /* ============================================================
     14. PDF DOWNLOAD
     Uses the browser's print engine with css/print.css, so the PDF has real,
     selectable text (good for applicant tracking systems) and no libraries
     are needed. The user picks "Save as PDF" as the destination.
     ============================================================ */
  function downloadPDF() {
    const originalTitle = document.title;
    const name = (state.fullName || 'Resume').trim().replace(/\s+/g, '_');
    document.title = name + '_Resume'; // becomes the suggested file name

    const restore = () => {
      document.title = originalTitle;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);

    if (!Store.flag('printHint')) {
      toast('In the print window, set the destination to "Save as PDF".', { timeout: 3500 });
      Store.flag('printHint', true);
      setTimeout(() => window.print(), 900);
    } else {
      window.print();
    }
  }

  /* ============================================================
     15. MOBILE TABS, NAVIGATION, HERO DEMO
     ============================================================ */
  function bindMobileTabs() {
    const builder = $('#builder');
    $$('#mobileTabs button').forEach((btn) => {
      btn.addEventListener('click', () => {
        builder.dataset.view = btn.dataset.view;
        $$('#mobileTabs button').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
        requestAnimationFrame(fitPreview); // the preview was hidden, so re-measure
        window.scrollTo({ top: builder.offsetTop - 70, behavior: reduceMotion ? 'auto' : 'smooth' });
      });
    });
  }

  function bindNav() {
    const nav = $('#nav');
    const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    $('#year').textContent = new Date().getFullYear();
  }

  /** Types real generator output into the hero card, cycling through the tones. */
  async function heroDemo() {
    const out = $('#heroTyped');
    const chips = $$('.demo-tone');
    if (!out || !chips.length) return;

    const sample = Store.normalize(window.SAMPLE_DATA);
    const tones = AISummary.TONES.map((t) => t.id);
    const mark = (id) => chips.forEach((c) => c.classList.toggle('is-active', c.dataset.tone === id));

    if (reduceMotion) {
      mark('professional');
      out.textContent = AISummary.generate(sample, 'professional');
      return;
    }

    for (let i = 0; ; i = (i + 1) % tones.length) {
      mark(tones[i]);
      out.classList.remove('is-typing');
      out.textContent = '';
      await sleep(600);
      out.classList.add('is-typing');
      await AISummary.stream(AISummary.generate(sample, tones[i]), (t) => { out.textContent = t; }, { chunk: 2, speed: 24 });
      out.classList.remove('is-typing');
      await sleep(3200);
    }
  }

  /* ============================================================
     16. INIT
     ============================================================ */
  function init() {
    initTheme();
    bindNav();
    buildPickers();
    bindSimpleFields();
    bindRepeaters();
    bindTags();
    bindTone();
    bindDataMenu();
    bindMobileTabs();

    $('#aiGenerate').addEventListener('click', runAI);
    $('#downloadBtn').addEventListener('click', downloadPDF);
    $('#downloadBtn2').addEventListener('click', downloadPDF);
    $('#resumeForm').addEventListener('submit', (e) => e.preventDefault());

    // Keep the preview fitted when the window or the paper height changes.
    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(() => fitPreview());
      ro.observe($('#stage'));
      ro.observe($('#paperScaler'));
    } else {
      window.addEventListener('resize', fitPreview);
    }

    refreshAll();
    setSaveStatus(firstVisit ? 'saving' : 'saved');
    heroDemo();

    if (firstVisit) {
      setTimeout(() => toast('A sample resume is loaded so you can explore. Replace it with your own details.', { timeout: 6000 }), 1200);
    }
  }

  init();
})();
