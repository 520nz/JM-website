// ============================================================
// run.js - 轻量测试运行器（基于 Node.js assert + jsdom）
// ============================================================
const assert = require('assert');
const { JSDOM } = require('jsdom');
const path = require('path');
const fs = require('fs');

function ok(cond, msg) { assert.ok(cond, msg || 'assertion failed'); }
function equal(actual, expected, msg) { assert.strictEqual(actual, expected, msg || `expected ${expected}, got ${actual}`); }
function deepEqual(actual, expected, msg) { assert.deepStrictEqual(actual, expected, msg || 'deepEqual failed'); }

// Shared helpers
const H = { ok, equal, deepEqual };

// ------- Setup jsdom with mocked storage -------
function createTestEnv() {
    const DATA = { userData: {}, questionBank: [] };

    const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
        url: 'http://localhost/',
        runScripts: 'dangerously'
    });

    // Override globals in the jsdom context
    const w = dom.window;

    // Mock IndexedDB minimally
    w.indexedDB = {
        open: function() {
            const req = {};
            const db = {
                objectStoreNames: { contains: () => true },
                transaction: (storeName) => ({
                    objectStore: () => ({
                        put: (value) => {
                            if (storeName === 'userData') DATA.userData[value.id] = value;
                            else if (storeName === 'questionBank') DATA.questionBank = value;
                        },
                        get: (key) => ({ result: DATA[storeName] ? DATA[storeName][key] : undefined }),
                        getAll: () => ({ result: storeName === 'questionBank' ? DATA.questionBank : Object.values(DATA[storeName] || {}) }),
                        clear: () => {
                            if (storeName === 'questionBank') DATA.questionBank = [];
                            else DATA[storeName] = {};
                        }
                    }),
                    oncomplete: null,
                    onerror: null
                })
            };
            // Fire synchronously for simplicity
            setImmediate(() => {
                if (req.onupgradeneeded) req.onupgradeneeded({ target: { result: db } });
                req.result = db;
                if (req.onsuccess) req.onsuccess({ target: req });
            });
            return req;
        }
    };

    // Mock browser APIs needed by quiz.js
    w.navigator = { ...w.navigator, vibrate: () => {} };
    const mockAudioCtx = {
        createOscillator: () => ({
            type: '', frequency: { setValueAtTime() {} },
            connect() {}, start() {}, stop() {}
        }),
        createGain: () => ({
            gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
            connect() {}
        })
    };
    w.AudioContext = function() { return mockAudioCtx; };
    w.webkitAudioContext = function() { return mockAudioCtx; };

    // Mock alert/confirm (used by admin.js)
    w.alert = () => {};
    w.confirm = () => true;

    // Create required DOM elements for quiz tests
    const quizArea = w.document.createElement('div');
    quizArea.id = 'quizArea';
    w.document.body.appendChild(quizArea);

    const practiceView = w.document.createElement('div');
    practiceView.id = 'view-practice';
    w.document.body.appendChild(practiceView);

    // Load source files into the JSDOM window (skip app.js — it has DOMContentLoaded side effects)
    const srcFiles = ['data.js', 'storage.js', 'quiz.js', 'admin.js', 'chart.js'];
    for (const f of srcFiles) {
        const code = fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');
        const scriptEl = w.document.createElement('script');
        scriptEl.textContent = code;
        w.document.head.appendChild(scriptEl);
    }

    const App = w.App;
    App._testEnv = {
        window: w,
        data: DATA,
        reset: function() {
            DATA.userData = {};
            DATA.questionBank = [];
            w.sessionStorage.clear();
            // Force storage module to reload by re-reading defaults
            // (cache is internal to IIFE, so we directly reset via setData)
        }
    };

    return App;
}

// ------- Load and run test files -------
const filter = process.argv[2];
const suites = fs.readdirSync(__dirname)
    .filter(f => f.endsWith('.test.js'))
    .filter(f => !filter || f.includes(filter));

console.log('\n╔═══════════════════════════════════════════════╗');
console.log('║  JM 答题应用 - 测试缺口分析 & 回归测试套件     ║');
console.log('╚═══════════════════════════════════════════════╝\n');

let total = 0, passed = 0, failed = 0;

for (const suiteFile of suites) {
    const suite = require(path.join(__dirname, suiteFile));
    console.log(`\n▶ ${suite.name}`);

    for (const tc of suite.cases) {
        total++;
        const App = createTestEnv();
        try {
            suite.beforeEach && suite.beforeEach(App, H);
            tc.fn(App, H);
            console.log(`   ✓ ${tc.name}`);
            passed++;
        } catch (err) {
            console.log(`   ✗ ${tc.name}`);
            console.log(`     ${err.message}`);
            failed++;
        }
    }
}

console.log(`\n  ─── 结果 ───`);
console.log(`  总计: ${total}  通过: ${passed}  失败: ${failed}`);
console.log(`  新增测试覆盖的核心逻辑: ${total} 项\n`);

if (failed > 0) {
    console.error('❌ 部分测试失败，请检查');
    process.exit(1);
} else {
    console.log('✅ 全部通过');
}
