// ============================================================
// tests/setup.js - 测试环境初始化（jsdom + 浏览器 API mock）
// ============================================================

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

function createTestContext() {
    // 构建最小 DOM，让 storage.js 中 document.createElement('div') 能工作
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
        url: 'http://localhost/',
        runScripts: 'dangerously',
        pretendToBeVisual: true
    });

    const { window } = dom;
    global.window = window;
    global.document = window.document;
    global.navigator = window.navigator;

    // Mock sessionStorage
    const storageMock = {};
    window.sessionStorage = {
        setItem: (k, v) => { storageMock[k] = String(v); },
        getItem: (k) => storageMock[k] || null,
        removeItem: (k) => { delete storageMock[k]; },
        clear: () => { for (const k of Object.keys(storageMock)) delete storageMock[k]; }
    };

    // Mock indexedDB (storage.js 中 persist 用 fire-and-forget，初始化时可能调用 openDB)
    // 为避免测试被异步 indexedDB 阻塞，提供一个极简 mock
    const idbMock = {
        _data: {},
        open: () => ({
            onupgradeneeded: null, onsuccess: null, onerror: null,
            result: null,
            _ready: function () {
                if (this.onsuccess) this.onsuccess({ target: { result: idbMock._db } });
            }
        })
    };
    idbMock._db = {
        transaction: () => ({
            objectStore: () => ({
                put: () => ({ oncomplete: null, onerror: null, result: undefined }),
                get: () => ({ onsuccess: null, onerror: null, result: undefined }),
                getAll: () => ({ onsuccess: null, onerror: null, result: [] }),
                clear: () => {}
            }),
            oncomplete: null,
            onerror: null
        }),
        objectStoreNames: { contains: () => true }
    };
    // 让 indexedDB.open 立即同步触发 onsuccess
    window.indexedDB = {
        open: () => {
            const req = {
                onupgradeneeded: null,
                onsuccess: null,
                onerror: null,
                result: idbMock._db
            };
            // 微任务中触发 onsuccess，让 storage.js 的 Promise 链能 resolve
            Promise.resolve().then(() => {
                if (req.onsuccess) req.onsuccess({ target: { result: idbMock._db } });
            });
            return req;
        }
    };

    // Mock AudioContext
    window.AudioContext = class { createOscillator() { return { connect(){}, start(){}, stop(){}, frequency: { setValueAtTime(){} }, type: '' }; } createGain() { return { connect(){}, gain: { setValueAtTime(){}, exponentialRampToValueAtTime(){} } }; } };
    window.webkitAudioContext = window.AudioContext;

    // 加载源码
    const codeDir = path.resolve(__dirname, '..');
    const dataCode = fs.readFileSync(path.join(codeDir, 'js', 'data.js'), 'utf8');
    const storageCode = fs.readFileSync(path.join(codeDir, 'js', 'storage.js'), 'utf8');

    // 执行，App 会挂到 window
    const scriptEl1 = window.document.createElement('script');
    scriptEl1.textContent = dataCode;
    window.document.head.appendChild(scriptEl1);

    const scriptEl2 = window.document.createElement('script');
    scriptEl2.textContent = storageCode;
    window.document.head.appendChild(scriptEl2);

    // App 在 window 上
    const App = window.App;

    // 重置缓存，使测试之间隔离
    function resetStorage() {
        // 直接操作 _cache（通过 App.db.get / setData 间接）
        App.db.setData({
            history: [],
            wrong: [],
            stats: { total: 0, correct: 0, cats: {} },
            theme: 'dark',
            dailyGoal: 20,
            achievements: [],
            archive: []
        });
    }

    return { App, window, dom, resetStorage };
}

module.exports = { createTestContext };
