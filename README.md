# Quill — AI Resume Builder

A modern, responsive resume builder with a live A4 preview, four templates, an AI summary writer, dark mode and one-click PDF export. Built with plain HTML, CSS and JavaScript: no framework, no build step, no API keys.

> **Portfolio project.** The goal was to build something that looks and feels like a modern AI SaaS product while keeping the code small, readable and easy to explain in an interview.

## Features

| Feature | How it works |
| --- | --- |
| **Resume form** | Full name, job title, email, phone, location, link, education, skills, experience and projects. Education, experience and projects can be added, removed and reordered. Skills use a tag input. |
| **Live preview** | The resume is drawn on a true A4 page (794 × 1123 px) and scaled to fit. A page counter warns when you go past one page. |
| **4 templates** | Modern (sidebar), Classic (serif), Minimal, Bold. Switch any time; content is shared. Six accent colors plus a custom color picker. |
| **PDF download** | Uses the browser's print engine and `css/print.css`. The PDF has real, selectable text that applicant tracking systems can read. |
| **AI summary writer** | Pick a tone (Professional, Confident, Creative, Concise). The generator writes a summary from your title, skills, experience, projects and education, and streams it into the field. Includes Undo. |
| **Dark mode** | Follows the system setting by default; the toggle remembers your choice. |
| **Local storage** | Everything auto-saves in your browser. Export or import a JSON backup from the **Resume data** menu. |
| **Animations** | One page-load sequence in the hero (with a live AI demo), a streaming effect for the AI, template cross-fade, new-card slide-in, toasts. All respect `prefers-reduced-motion`. |
| **Responsive** | Two-column builder on desktop; on phones it becomes Edit / Preview tabs. |
| **Resume strength** | A simple completeness meter that tells you the next thing to add. |

## Run it

No install needed.

1. Unzip the folder.
2. Double-click `index.html`.

That's it. It works from `file://` on Windows, macOS and Linux. If you prefer a local server:

```bash
# from inside the project folder
python -m http.server 8000
# then open http://localhost:8000
```

The page loads two Google Fonts. If you're offline it falls back to system fonts and everything still works.

### Saving the PDF

Click **Download PDF**. In the print window:

1. Set **Destination** to **Save as PDF**.
2. Leave **Margins** on *Default* or *None* (the page sets its own).
3. Use Chrome or Edge for best results.

If a resume runs onto a second page, the preview shows a dashed page-break line and the badge says "2 pages".

## Project structure

```
ai-resume-builder/
├── index.html              Page markup: hero, features, form, preview
├── README.md
├── css/
│   ├── style.css           App UI: tokens, light/dark themes, components, responsive rules
│   ├── templates.css       Resume paper and the four template layouts
│   └── print.css           Print rules used for PDF export (media="print")
├── js/
│   ├── app.js              Wires everything together (form, preview, AI, theme, save, PDF)
│   ├── storage.js          Data shape, validation, localStorage, JSON export
│   ├── ai-summary.js       The summary generator and streaming helper
│   └── templates.js        HTML renderers for each template + thumbnails
└── data/
    └── sample-data.js      Fictional resume used on first visit and in the hero demo
```

Scripts are plain files loaded in order, each exposing a small API on `window.Quill`. `app.js` is the only file that touches the page's controls.

## How it works

**One state object.** The whole resume is a single object (see `Store.blank()` for the shape). Every input writes into it, then `commit()` re-renders the preview, updates the strength meter and schedules a debounced save.

**Rendering.** `Templates.render(state)` returns HTML. Shared "block" functions build each section; each template only arranges them. All user text passes through `esc()` so nothing can inject HTML.

**Scale-to-fit preview.** The paper is always 794 px wide. `fitPreview()` applies `transform: scale()` and sizes a wrapper to match, so the preview is pixel-accurate at any screen width and prints at full size.

**PDF export.** `print.css` hides everything but the paper, removes the scaling and sets `@page { size: A4; margin: 0 }`. Because it's real HTML text, the PDF is searchable and ATS-friendly (unlike screenshot-based exporters).

**Data safety.** `Store.normalize()` converts any input (an old save, an imported file, malformed JSON) into a valid resume object. Storage calls are wrapped in `try/catch`, and the UI shows a message if the browser blocks saving.

## The "AI" summary writer

`js/ai-summary.js` is a small on-device generator, so the project is free to run and works offline. It:

1. extracts facts from the resume (title, top skills, latest employer, project names, degree),
2. estimates years of experience from date ranges like `Mar 2022 – Present`,
3. assembles three or four sentences from phrase banks for the selected tone, choosing variants at random so **Regenerate** gives a new draft.

It only states facts present in the resume and never invents numbers or employers. Treat the output as a first draft and edit it.

### Upgrading to a real LLM

The generator is isolated behind one function, so you can swap in a model without touching the UI. Never put an API key in front-end code; call your own backend instead.

```js
// js/ai-summary.js: replace generate() with an async version
async function generate(data, tone) {
  const facts = context(data);                    // already built for you
  const res = await fetch('/api/summary', {       // your server holds the API key
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ facts, tone })
  });
  const { text } = await res.json();
  return text;
}
```

Then change `const text = AISummary.generate(state, tone);` in `runAI()` (in `app.js`) to `await`, and keep the rest. Prompt tip for your backend: *"Write a 3-sentence resume summary in a {tone} tone using only these facts. Do not invent employers, numbers or achievements."*

## Customizing

**Add a template**
1. Add `{ id, name }` to `LIST` in `js/templates.js`.
2. Add a layout function with the same id to `LAYOUTS`.
3. Add `.tpl-<id>` styles to `css/templates.css`.
4. Add the id to `TEMPLATE_IDS` in `js/storage.js`.
5. Add a thumbnail to `THUMBS` (optional, otherwise the button shows no preview).

**Change the look.** All colors, radii and fonts are CSS variables at the top of `css/style.css` (`--brand`, `--surface`, `--font-display`, and so on). Dark mode overrides them under `:root[data-theme="dark"]`.

**Add a form field.** Add an input with `data-field="yourKey"` in `index.html`, add the key to `Store.blank()` and `Store.normalize()`, then render it in a template.

## Browser support

Current Chrome, Edge, Firefox and Safari. Uses CSS `color-mix()`, `backdrop-filter` and `ResizeObserver`. PDF export is best in Chrome and Edge.

## Possible next steps

- Drag-and-drop reordering for entries
- More templates and a font picker
- Real LLM integration (see above) with bullet-point rewriting
- Multiple saved resumes
- Cover letter generator
- Unit tests for `Store.normalize()` and `AISummary.generate()`

## License

MIT. Free to use, modify and include in your own portfolio.
