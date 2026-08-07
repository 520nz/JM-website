// ============================================================
// test/setup.js - jsdom + vm 加载所有 JS 文件
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

function loadApp() {
    const html = '<!doctype html><html><body>' +
        '<div id="quizArea"></div>' +
        '<div id="view-practice" class="view"></div>' +
        '<div id="view-home" class="view active"></div>' +
        '<div id="todayCount"></div>' +
        '</body></html>';
    const dom = new JSDOM(html, {
        url: 'http://localhost:3000/',
        pretendToBeVisual: true,
        runScripts: 'dangerously'
    });
    const w = dom.window;

    // Mock indexedDB
    const stores = { userData: new Map(), questionBank: new Map() };
    w.indexedDB = {
        open(name, version) {
            const req = { onsuccess: null, onerror: null, result: null };
            setTimeout(() => {
                const db = {
                    objectStoreNames: { contains: () => true },
                    transaction(storeName, mode) {
                        return {
                            objectStore(sn) {
                                const s = stores[sn];
                                return {
                                    put(v) {
                                        const r = { result: null };
                                        s.set(v.id, v);
                                        setTimeout(() => { r.onsuccess && r.onsuccess({ target: { result: v.id } }); req.onsuccess && req.onsuccess({ target: db }); }, 0);
                                        return r;
                                    },
                                    get(k) {
                                        const r = { result: s.get(k) };
                                        setTimeout(() => { r.onsuccess && r.onsuccess({ target: r }); }, 0);
                                        return r;
                                    },
                                    getAll() {
                                        const r = { result: Array.from(s.values()) };
                                        setTimeout(() => { r.onsuccess && r.onsuccess({ target: r }); }, 0);
                                        return r;
                                    },
                                    clear() { s.clear(); return {}; }
                                };
                            },
                            oncomplete: null, onerror: null
                        };
                    }
                };
                req.onsuccess && req.onsuccess({ target: db });
            }, 0);
            return req;
        }
    };

    // 初始化 App 命名空间
    w.App = {};

    const files = [
        'js/data.js',
        'js/storage.js',
        'js/chart.js',
        'js/quiz.js',
        'js/app.js',
        'js/admin.js'
    ];

    for (const f of files) {
        const code = fs.readFileSync(path.resolve(__dirname, '..', f), 'utf8');
        const script = new vm.Script(code, { filename: f });
        script.runInContext(w);
    }

    // 暴露到 global 方便测试引用
    global.window = w;
    global.document = w.document;
    global.navigator = w.navigator;
    global.sessionStorage = w.sessionStorage;
    global.indexedDB = w.indexedDB;
    global.AudioContext = w.AudioContext;
    global.URL = w.URL;
    global.Blob = w.Blob;
    global.App = w.App;

    return w.App;
}

module.exports = { loadApp };
