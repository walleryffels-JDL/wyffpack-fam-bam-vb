// Built-in messages, used when messages.json can't be loaded
// (for example when opening index.html straight from disk).
export const DEFAULT_MESSAGES = [
  { lines: ['{day}', '{date}', '', '{blue} {time} {blue}'], duration: 30 },
  { lines: ['{red}{orange}{yellow}{green}{blue}{violet}', '', 'GOOD MORNING', 'WYFF PACK', '', '{violet}{blue}{green}{yellow}{orange}{red}'] },
  { lines: ['WHOSE DIRTY SOCKS', 'ARE ON THE FLOOR?', '', '- DAD'] },
  { lines: ['I KNEW HE WAS A', "STOOCH, BUT I DIDN'T", 'KNOW HE WAS A', 'DAVY STOOCH.', '', '- LUKE'] },
  { lines: ["I'M JUST GONNA", 'SEND IT!', '', '- LARRY ENTICER'] }
];
