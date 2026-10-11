/**
 * sample-data.js
 * ---------------------------------------------------------------------------
 * A fictional resume used to:
 *   1. pre-fill the builder the very first time someone visits,
 *   2. power the animated AI demo in the hero section,
 *   3. back the "Load sample resume" action in the Resume data menu.
 *
 * It is a .js file (not .json) on purpose: browsers block fetch() of local
 * files when you open index.html by double-clicking it, but a <script> tag
 * works everywhere. The shape matches what Quill.Store.normalize() expects.
 */
window.SAMPLE_DATA = {
  fullName: 'Maya Rahman',
  title: 'Frontend Developer',
  email: 'maya.rahman@example.com',
  phone: '+1 (555) 014-2290',
  location: 'Austin, TX',
  link: 'linkedin.com/in/mayarahman',

  summary:
    'Frontend developer who builds fast, accessible web apps with React and TypeScript. ' +
    'Comfortable turning design systems into dependable code, and working closely with product ' +
    'and design to ship features that people enjoy using.',

  education: [
    {
      school: 'University of Texas at Austin',
      degree: 'B.S. Computer Science',
      year: '2015 – 2019',
      details: 'Graduated with honors. Capstone: an accessibility audit tool for campus websites.'
    }
  ],

  skills: [
    'React', 'TypeScript', 'JavaScript', 'HTML & CSS', 'Accessibility (WCAG)',
    'Figma', 'Node.js', 'Jest', 'Git', 'Design systems'
  ],

  experience: [
    {
      role: 'Frontend Developer',
      company: 'Northwind Labs',
      period: 'Mar 2022 – Present',
      description:
        'Led the redesign of the customer analytics dashboard in React and TypeScript.\n' +
        'Built a shared component library now used by four product teams.\n' +
        'Mentored two junior developers through code reviews and pair programming.'
    },
    {
      role: 'Junior Web Developer',
      company: 'Brightside Studio',
      period: 'Jun 2019 – Feb 2022',
      description:
        'Delivered 20+ responsive websites for local businesses.\n' +
        'Added automated accessibility checks to the release process.\n' +
        'Turned Figma mockups into production-ready, pixel-accurate pages.'
    }
  ],

  projects: [
    {
      name: 'Habit Grove',
      link: 'github.com/mayarahman/habit-grove',
      description: 'Offline-first habit tracker built with React and IndexedDB.'
    },
    {
      name: 'Contrast Check',
      link: 'github.com/mayarahman/contrast-check',
      description: 'Browser extension that flags low-contrast text on any web page.'
    }
  ],

  template: 'modern',
  accent: '#4f46e5'
};
