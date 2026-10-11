/**
 * templates.js
 * ---------------------------------------------------------------------------
 * Turns resume data into HTML for the live preview and the PDF.
 *
 * Structure
 *   - small "block" functions build one resume section each (experience,
 *     education, skills ...) and are shared by every template,
 *   - each template in LAYOUTS just arranges those blocks differently,
 *   - css/templates.css styles each layout via the class "tpl-<id>".
 *
 * ADD A NEW TEMPLATE
 *   1. Add an entry to LIST.
 *   2. Add a layout function to LAYOUTS with the same id.
 *   3. Add ".tpl-<id>" styles in css/templates.css.
 *   4. Add the id to TEMPLATE_IDS in js/storage.js.
 *
 * Public API: window.Quill.Templates
 */
(function (global) {
  'use strict';

  const Q = (global.Quill = global.Quill || {});

  const LIST = [
    { id: 'modern', name: 'Modern' },
    { id: 'classic', name: 'Classic' },
    { id: 'minimal', name: 'Minimal' },
    { id: 'bold', name: 'Bold' }
  ];

  /* ---------------------------------------------------------------- helpers */

  /** Escapes user text so it can never inject HTML into the page. */
  const esc = (s) => String(s === null || s === undefined ? '' : s)
    .replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  const has = (s) => typeof s === 'string' && s.trim().length > 0;

  /** "https://site.com/" -> "site.com" */
  const prettyLink = (u) => esc(u.trim().replace(/^https?:\/\//i, '').replace(/\/$/, ''));

  /**
   * Turns a multi-line description into bullets.
   * One line -> paragraph. Several lines -> list (leading "-", "*" or bullet
   * characters are stripped).
   */
  function richText(text) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return '';
    const clean = lines.map((l) => l.replace(/^[-•*–]\s*/, ''));
    if (lines.length === 1 && !/^[-•*–]/.test(lines[0])) return `<p>${esc(clean[0])}</p>`;
    return `<ul>${clean.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`;
  }

  /** Wraps content in a titled resume section. */
  function sec(title, body) {
    return `<section class="r-sec"><h3 class="r-h">${esc(title)}</h3><div class="r-body">${body}</div></section>`;
  }

  /** Shared entry markup: heading + date on one row, sub-line, body. */
  function entry(head, date, sub, body) {
    return `<article class="entry">
      <div class="entry-head"><h4>${head}</h4>${date ? `<span class="entry-date">${date}</span>` : ''}</div>
      ${sub ? `<div class="entry-sub">${sub}</div>` : ''}
      ${body ? `<div class="entry-body">${body}</div>` : ''}
    </article>`;
  }

  /* ----------------------------------------------------------------- blocks */

  function nameBlock(d) {
    return `<h1 class="r-name">${has(d.fullName) ? esc(d.fullName) : 'Your Name'}</h1>`
      + (has(d.title) ? `<p class="r-title">${esc(d.title)}</p>` : '');
  }

  /** Escaped contact strings that actually have a value. */
  function contactItems(d) {
    const items = [];
    if (has(d.email)) items.push(esc(d.email.trim()));
    if (has(d.phone)) items.push(esc(d.phone.trim()));
    if (has(d.location)) items.push(esc(d.location.trim()));
    if (has(d.link)) items.push(prettyLink(d.link));
    return items;
  }

  /** Horizontal row of contact details (used in headers). */
  function contactRow(d) {
    const items = contactItems(d);
    return items.length ? `<div class="r-contact">${items.map((i) => `<span>${i}</span>`).join('')}</div>` : '';
  }

  /** Vertical list of contact details (used in the Modern sidebar). */
  function contactList(d) {
    const items = contactItems(d);
    return items.length
      ? sec('Contact', `<ul class="r-contact-list">${items.map((i) => `<li>${i}</li>`).join('')}</ul>`) : '';
  }

  function summaryBlock(d) {
    return has(d.summary) ? sec('Summary', `<p class="r-summary">${esc(d.summary.trim())}</p>`) : '';
  }

  function experienceBlock(d) {
    const items = d.experience.filter((e) => has(e.role) || has(e.company) || has(e.description));
    if (!items.length) return '';
    return sec('Experience', items.map((e) => entry(
      esc(e.role), esc(e.period), esc(e.company), has(e.description) ? richText(e.description) : ''
    )).join(''));
  }

  function educationBlock(d) {
    const items = d.education.filter((e) => has(e.school) || has(e.degree) || has(e.details));
    if (!items.length) return '';
    return sec('Education', items.map((e) => entry(
      esc(e.degree), esc(e.year), esc(e.school), has(e.details) ? richText(e.details) : ''
    )).join(''));
  }

  function projectsBlock(d) {
    const items = d.projects.filter((p) => has(p.name) || has(p.description));
    if (!items.length) return '';
    return sec('Projects', items.map((p) => entry(
      esc(p.name), has(p.link) ? prettyLink(p.link) : '', '', has(p.description) ? richText(p.description) : ''
    )).join(''));
  }

  function skillsBlock(d) {
    return d.skills.length
      ? sec('Skills', `<div class="skills">${d.skills.map((s) => `<span class="skill">${esc(s)}</span>`).join('')}</div>`) : '';
  }

  /** True when there is nothing worth rendering yet. */
  function isEmpty(d) {
    return !has(d.fullName) && !has(d.title) && !has(d.summary) && !d.skills.length
      && !contactItems(d).length && !d.experience.length && !d.education.length && !d.projects.length;
  }

  /* ---------------------------------------------------------------- layouts */

  const LAYOUTS = {
    // Sidebar on the left with contact, skills, education; story on the right.
    modern: (d) => `
      <aside class="m-side">${contactList(d)}${skillsBlock(d)}${educationBlock(d)}</aside>
      <div class="m-main">
        <header class="r-head">${nameBlock(d)}</header>
        ${summaryBlock(d)}${experienceBlock(d)}${projectsBlock(d)}
      </div>`,

    // Traditional centered header, serif type, ruled section titles.
    classic: (d) => `
      <header class="r-head">${nameBlock(d)}${contactRow(d)}</header>
      ${summaryBlock(d)}${experienceBlock(d)}${educationBlock(d)}${projectsBlock(d)}${skillsBlock(d)}`,

    // Airy single column: section titles sit in a narrow left gutter.
    minimal: (d) => `
      <header class="r-head">${nameBlock(d)}${contactRow(d)}</header>
      ${summaryBlock(d)}${experienceBlock(d)}${educationBlock(d)}${projectsBlock(d)}${skillsBlock(d)}`,

    // Full-width color header, then a main column and a side column.
    bold: (d) => `
      <header class="r-band">${nameBlock(d)}${contactRow(d)}</header>
      <div class="r-cols">
        <div class="r-col-main">${summaryBlock(d)}${experienceBlock(d)}${projectsBlock(d)}</div>
        <div class="r-col-side">${skillsBlock(d)}${educationBlock(d)}</div>
      </div>`
  };

  /** Returns the inner HTML of the paper for the resume's chosen template. */
  function render(d) {
    const layout = LAYOUTS[d.template] || LAYOUTS.modern;
    const html = layout(d);
    return isEmpty(d)
      ? html + '<p class="r-empty">Start typing in the form and your resume will appear here.</p>'
      : html;
  }

  /* -------------------------------------------------------------- thumbnails */

  // Tiny SVG miniatures for the template picker. Color comes from CSS (currentColor).
  const bar = (x, y, w, o) => `<rect x="${x}" y="${y}" width="${w}" height="2" rx="1" fill="#9aa0b8" opacity="${o || 0.55}"/>`;
  const frame = '<rect x=".5" y=".5" width="39" height="51" rx="3" fill="#fff" stroke="currentColor" stroke-opacity=".3"/>';

  const THUMBS = {
    modern: frame + '<rect x="1" y="1" width="13" height="50" rx="2.5" fill="currentColor"/>'
      + '<rect x="18" y="7" width="15" height="3.5" rx="1.5" fill="currentColor"/>'
      + bar(18, 16, 18) + bar(18, 21, 14) + bar(18, 29, 18) + bar(18, 34, 16) + bar(18, 39, 12),
    classic: frame + '<rect x="11" y="6" width="18" height="3.5" rx="1.5" fill="#3a3f55"/>'
      + bar(8, 13, 24, 0.4) + '<rect x="6" y="18" width="28" height="1" fill="#3a3f55"/>'
      + bar(6, 23, 28) + bar(6, 28, 22) + bar(6, 36, 28) + bar(6, 41, 20),
    minimal: frame + '<rect x="6" y="6" width="16" height="3" rx="1.5" fill="#3a3f55"/>'
      + bar(6, 12, 20, 0.35) + '<rect x="6" y="18" width="28" height=".8" fill="#9aa0b8" opacity=".5"/>'
      + '<rect x="6" y="22" width="6" height="2" rx="1" fill="currentColor"/>' + bar(16, 22, 18) + bar(16, 27, 14)
      + '<rect x="6" y="34" width="28" height=".8" fill="#9aa0b8" opacity=".5"/>'
      + '<rect x="6" y="38" width="6" height="2" rx="1" fill="currentColor"/>' + bar(16, 38, 18),
    bold: frame + '<rect x="1" y="1" width="38" height="15" rx="2.5" fill="currentColor"/>'
      + '<rect x="6" y="6" width="16" height="3.5" rx="1.5" fill="#fff"/>'
      + bar(6, 21, 16) + bar(6, 26, 18) + bar(6, 31, 14) + bar(6, 38, 17)
      + '<rect x="28" y="21" width="8" height="26" rx="1.5" fill="currentColor" opacity=".15"/>'
  };

  function thumb(id) {
    return `<svg viewBox="0 0 40 52" aria-hidden="true">${THUMBS[id] || ''}</svg>`;
  }

  Q.Templates = { list: LIST, render, thumb, esc };
})(typeof window !== 'undefined' ? window : globalThis);
