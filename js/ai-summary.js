/**
 * ai-summary.js
 * ---------------------------------------------------------------------------
 * The "AI" professional summary writer.
 *
 * HOW IT WORKS
 * This is a small on-device text generator, so the project runs for free with
 * no API keys and no network. It:
 *   1. reads the resume (job title, skills, experience, projects, education),
 *   2. works out facts such as total years of experience from date ranges,
 *   3. assembles 3-4 sentences from phrase banks for the chosen tone,
 *      picking variants at random so "Regenerate" gives a fresh draft.
 *
 * It only states facts that are in the resume. It never invents numbers,
 * employers or achievements.
 *
 * WANT A REAL LLM? Replace generate() with a function that sends the same
 * `context()` object to your own backend endpoint and returns the text.
 * See "Upgrading to a real LLM" in README.md. Nothing else needs to change.
 *
 * Public API: window.Quill.AISummary
 */
(function (global) {
  'use strict';

  const Q = (global.Quill = global.Quill || {});

  const TONES = [
    { id: 'professional', label: 'Professional' },
    { id: 'confident', label: 'Confident' },
    { id: 'creative', label: 'Creative' },
    { id: 'concise', label: 'Concise' }
  ];

  /* ---------------------------------------------------------------- helpers */

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const article = (word) => (/^[aeiou]/i.test(word) ? 'an' : 'a');

  /** ["A", "B", "C"] -> "A, B and C" */
  function list(items) {
    if (items.length <= 1) return items[0] || '';
    return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
  }

  /**
   * Estimates total years of experience from free-text date ranges such as
   * "Mar 2022 – Present" or "2019-2021". Returns null if it can't tell or
   * if the span is under a year.
   */
  function yearsOfExperience(experience) {
    const now = new Date().getFullYear();
    let min = Infinity;
    let max = -Infinity;

    experience.forEach((job) => {
      const period = job.period || '';
      (period.match(/\b(?:19|20)\d{2}\b/g) || [])
        .map(Number)
        .filter((y) => y <= now)
        .forEach((y) => { min = Math.min(min, y); max = Math.max(max, y); });
      if (/present|current|now|ongoing/i.test(period)) max = Math.max(max, now);
    });

    if (!isFinite(min) || !isFinite(max)) return null;
    const years = max - min;
    return years >= 1 ? years : null;
  }

  /** Boils the resume down to the facts the writer needs. */
  function context(d) {
    const jobs = d.experience.filter((e) => e.role || e.company);
    const latest = jobs[0] || {};
    const title = (d.title || '').trim() || (latest.role || '').trim();

    return {
      title,
      skills: d.skills.slice(0, 5),
      years: yearsOfExperience(d.experience),
      hasExp: jobs.length > 0,
      company: (latest.company || '').trim(),
      lastRole: (latest.role || '').trim(),
      projects: d.projects.map((p) => p.name.trim()).filter(Boolean),
      education: d.education.find((e) => e.degree || e.school) || null
    };
  }

  /* Small phrase builders used inside the banks below */
  const who = (c) => c.title || 'professional';
  const spec = (c) => (c.skills.length ? ` specializing in ${list(c.skills.slice(0, 4))}` : '');
  const inSk = (c) => (c.skills.length ? ` in ${list(c.skills.slice(0, 4))}` : '');
  const using = (c) => (c.skills.length ? ` using ${list(c.skills.slice(0, 3))}` : '');
  const fluent = (c) => (c.skills.length ? `, fluent in ${list(c.skills.slice(0, 3))}` : '');
  const strong = (c) => (c.skills.length ? `, with strengths in ${list(c.skills.slice(0, 3))}` : '');
  const focus = (c) => (c.skills.length ? `, with a focus on ${list(c.skills.slice(0, 4))}` : '');
  const drawing = (c) => (c.skills.length ? `, drawing on ${list(c.skills.slice(0, 3))}` : '');

  /* ------------------------------------------------------------ phrase banks */

  // Each opener receives the context and returns ONE sentence.
  const OPENERS = {
    professional: [
      (c) => c.years ? `${cap(who(c))} with ${c.years}+ years of experience${spec(c)}.`
        : c.hasExp ? `Dedicated ${who(c)} with hands-on experience${spec(c)}.`
        : `Motivated ${who(c)} with a solid foundation${inSk(c)}.`,
      (c) => c.years ? `Results-driven ${who(c)} with ${c.years}+ years of experience${spec(c)}.`
        : c.hasExp ? `Detail-oriented ${who(c)} with practical experience${spec(c)}.`
        : `Detail-oriented ${who(c)} with strong project and academic grounding${inSk(c)}.`
    ],
    confident: [
      (c) => c.years ? `${cap(who(c))} with ${c.years}+ years of experience turning complex problems into clean, working solutions${using(c)}.`
        : `Fast-learning ${who(c)} who delivers real, working results${fluent(c)}.`,
      (c) => c.hasExp ? `Proven ${who(c)} who ships quality work and raises the bar for the team${strong(c)}.`
        : `Driven ${who(c)} who learns quickly and ships real work${fluent(c)}.`
    ],
    creative: [
      (c) => c.years ? `Curious ${who(c)} with ${c.years}+ years of experience blending craft and problem solving${focus(c)}.`
        : `Curious ${who(c)} who blends creativity with technical craft${inSk(c)}.`,
      (c) => `Imaginative ${who(c)} who loves turning rough ideas into polished, usable work${drawing(c)}.`
    ],
    concise: [
      (c) => `Skilled ${who(c)}${c.years ? ` with ${c.years}+ years of experience` : ''}${spec(c)}.`,
      (c) => `${cap(who(c))}${c.years ? ` with ${c.years}+ years of experience` : ''}${inSk(c)}, focused on quality and clarity.`
    ]
  };

  // Closing sentences: a strength statement or a goal, one is chosen at random.
  const CLOSERS = {
    professional: [
      'Brings a methodical approach to problem solving and a commitment to quality.',
      'Known for clear communication, sound judgment and dependable delivery.',
      'Seeking to contribute technical depth and a collaborative mindset to a growing team.'
    ],
    confident: [
      'Thrives on ownership and moves quickly without cutting corners.',
      'Ready to take on bigger challenges and leave every project better than it was found.',
      'Works well under pressure and communicates plainly with technical and non-technical teammates.'
    ],
    creative: [
      'Passionate about thoughtful details and work that feels good to use.',
      'Always exploring new tools and ideas, and eager to bring fresh thinking to a collaborative team.',
      'Combines an eye for design with the discipline to ship.'
    ],
    concise: [
      'Focused on quality, clarity and reliable delivery.',
      'Collaborative, adaptable and quick to learn.'
    ]
  };

  /** Fact-based sentences drawn from the resume. Returned in priority order. */
  function evidence(c) {
    const out = [];

    if (c.company) {
      const role = c.lastRole && c.lastRole.toLowerCase() !== c.title.toLowerCase()
        ? `, working as ${article(c.lastRole)} ${c.lastRole}` : '';
      out.push(pick([
        `Most recently at ${c.company}${role}.`,
        `Recent experience at ${c.company}${role}.`
      ]));
    }

    if (c.projects.length) {
      out.push(pick([
        `Hands-on project work includes ${list(c.projects.slice(0, 2))}.`,
        `Has built projects such as ${list(c.projects.slice(0, 2))}.`
      ]));
    }

    if (c.education) {
      const { degree, school } = c.education;
      const parts = [degree, school].filter(Boolean).join(', ');
      out.push(`Academic background: ${parts}.`);
    }

    return out;
  }

  /* ---------------------------------------------------------------- generate */

  /**
   * Returns a summary string, or null when the resume has nothing to work
   * with yet (no title, skills, experience or projects).
   */
  function generate(data, toneId) {
    const c = context(data);
    if (!c.title && !c.skills.length && !c.hasExp && !c.projects.length) return null;

    const tone = OPENERS[toneId] ? toneId : 'professional';
    const facts = evidence(c);
    const sentences = [pick(OPENERS[tone])(c)];

    if (tone === 'concise') {
      // Two or three short sentences.
      sentences.push(facts[0] || pick(CLOSERS.concise));
    } else {
      sentences.push(...facts.slice(0, 2));
      sentences.push(pick(CLOSERS[tone]));
    }

    return sentences.join(' ');
  }

  /* ------------------------------------------------------------------ stream */

  /**
   * Reveals `text` progressively, like a model streaming tokens.
   * Calls onUpdate(partialText) on every tick and resolves when finished
   * (true) or when cancelled (false). Honors "reduce motion" by finishing
   * instantly.
   */
  function stream(text, onUpdate, opts) {
    const options = opts || {};
    const chunk = options.chunk || 3;
    const speed = options.speed || 18;
    const reduce = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let cancelled = false;
    const promise = new Promise((resolve) => {
      let i = 0;
      function tick() {
        if (cancelled) return resolve(false);
        i = reduce ? text.length : Math.min(text.length, i + chunk);
        onUpdate(text.slice(0, i));
        if (i >= text.length) return resolve(true);
        setTimeout(tick, speed);
      }
      tick();
    });
    promise.cancel = () => { cancelled = true; };
    return promise;
  }

  Q.AISummary = { TONES, generate, stream, context, yearsOfExperience };
})(typeof window !== 'undefined' ? window : globalThis);
