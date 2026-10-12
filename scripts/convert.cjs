// Usage: node scripts/convert.cjs [source.xls] [destination.json]
const fs = require('node:fs');
const path = require('node:path');
const XLSX = require('../vendor/xlsx.full.min.js');
const root = path.resolve(__dirname, '..');
const input = process.argv[2] || path.join(root, 'source/3000.xls');
const output = process.argv[3] || path.join(root, 'data/words.json');
const book = XLSX.read(fs.readFileSync(input), {type: 'buffer'});
const sheet = book.SheetNames.find(name => book.Sheets[name]['!ref']);
if (!sheet) throw new Error('No data sheet found');
const rows = XLSX.utils.sheet_to_json(book.Sheets[sheet]);
const words = new Map();
for (const row of rows) {
  const word = String(row.word ?? '').trim();
  const meaning = String(row.meaning ?? '').trim();
  const level = String(row.level ?? '').trim() || '미분류';
  if (!word || !meaning) continue;
  const id = JSON.stringify([word, meaning, level]);
  words.set(id, { id, word, meaning, level });
}
if (!words.size) throw new Error('No words found: expected word, meaning and level columns');
fs.writeFileSync(output, JSON.stringify([...words.values()], null, 2) + '\n');
console.log(`Converted ${words.size} words to ${output}`);
