// Built-in messages, used when messages.json can't be loaded
// (for example when opening index.html straight from disk).
export const DEFAULT_MESSAGES = [
  { lines: ['{day}', '{date}', '', '{time}'], duration: 30 },
  { lines: ['{red}{orange}{yellow}{green}{blue}{violet}', '', 'GOOD MORNING', '', '{violet}{blue}{green}{yellow}{orange}{red}'] },
  { lines: ['GOD IS IN', 'THE DETAILS.', '', '- LUDWIG MIES'] },
  { lines: ['STAY HUNGRY', 'STAY FOOLISH', '', '- STEVE JOBS'] },
  { lines: ['HAVE NO FEAR OF', 'PERFECTION', '', '- SALVADOR DALI'] }
];
