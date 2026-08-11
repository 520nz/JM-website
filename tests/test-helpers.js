import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

function loadAppFile(filename) {
  const filepath = path.join(PROJECT_ROOT, 'js', filename);
  const code = fs.readFileSync(filepath, 'utf-8');
  const scriptEl = document.createElement('script');
  scriptEl.textContent = code;
  document.body.appendChild(scriptEl);
}

export function loadAllApp() {
  loadAppFile('data.js');
  loadAppFile('storage.js');
  loadAppFile('quiz.js');
  return global.window.App;
}

export function resetDB() {
  try {
    const req = global.indexedDB.deleteDatabase('jj_quiz_db');
    req.onsuccess = () => {};
    req.onerror = () => {};
  } catch (e) {}
}

export function makeQuizBank() {
  return [
    { id: 'q1', category: '专辑', question: 'Q1', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }, { key: 'C', text: 'C' }, { key: 'D', text: 'D' }], answer: 'A', explanation: 'Exp1' },
    { id: 'q2', category: '歌曲', question: 'Q2', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }, { key: 'C', text: 'C' }, { key: 'D', text: 'D' }], answer: 'B', explanation: 'Exp2' },
    { id: 'q3', category: '个人信息', question: 'Q3', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }, { key: 'C', text: 'C' }, { key: 'D', text: 'D' }], answer: 'C', explanation: 'Exp3' },
    { id: 'q4', category: '获奖记录', question: 'Q4', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }, { key: 'C', text: 'C' }, { key: 'D', text: 'D' }], answer: 'D', explanation: 'Exp4' },
    { id: 'q5', category: '专辑', question: 'Q5', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }, { key: 'C', text: 'C' }, { key: 'D', text: 'D' }], answer: 'A', explanation: 'Exp5' },
  ];
}
