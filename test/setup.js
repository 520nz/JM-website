const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

function createTestEnv() {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
        url: 'http://localhost',
        runScripts: 'dangerously',
        resources: 'usable',
        pretendToBeVisual: true
    });

    const { window } = dom;
    global.window = window;
    global.document = window.document;
    global.navigator = window.navigator;
    global.sessionStorage = window.sessionStorage;

    mockIndexedDB(window);

    return { window, dom };
}

function mockIndexedDB(window) {
    const stores = {};

    function ensureStore(name) {
        if (!stores[name]) stores[name] = new Map();
    }

    function IDBRequest(result, error) {
        this.result = result;
        this.error = error;
        this.onsuccess = null;
        this.onerror = null;
        setTimeout(() => {
            if (this.error && this.onerror) this.onerror({ target: this });
            else if (this.onsuccess) this.onsuccess({ target: this });
        }, 0);
    }

    const mockDB = {
        createObjectStore(name) { ensureStore(name); return { put: () => new IDBRequest(), clear: () => new IDBRequest(), getAll: () => new IDBRequest(), get: () => new IDBRequest() }; },
        objectStoreNames: { contains: () => true },
        transaction(storeName, mode) {
            ensureStore(storeName);
            const store = stores[storeName];
            const tx = { oncomplete: null, onerror: null, db: mockDB };
            const storeApi = {
                put(value) {
                    const key = value.id;
                    store.set(key, value);
                    const req = new IDBRequest();
                    tx.oncomplete && setTimeout(tx.oncomplete, 0);
                    return req;
                },
                get(key) {
                    const val = store.get(key);
                    return new IDBRequest(val);
                },
                getAll() {
                    return new IDBRequest(Array.from(store.values()));
                },
                clear() {
                    store.clear();
                    const req = new IDBRequest();
                    tx.oncomplete && setTimeout(tx.oncomplete, 0);
                    return req;
                }
            };
            tx.objectStore = () => storeApi;
            tx.objectStoreNames = { contains: () => true };
            Object.defineProperty(tx, 'objectStore', { value: () => storeApi, enumerable: true, configurable: true });
            return tx;
        }
    };

    const mockOpenRequest = new (function() {
        this.result = mockDB;
        this.error = null;
        this.onupgradeneeded = null;
        this.onsuccess = null;
        this.onerror = null;
        setTimeout(() => {
            if (this.onupgradeneeded) this.onupgradeneeded({ target: { result: mockDB } });
            if (this.onsuccess) this.onsuccess({ target: this });
        }, 0);
    })();

    window.indexedDB = {
        open() { return mockOpenRequest; },
        deleteDatabase() { return new IDBRequest(); }
    };
}

function loadSource(window, filename) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'js', filename), 'utf-8');
    const script = window.document.createElement('script');
    script.textContent = src;
    window.document.body.appendChild(script);
}

function loadAllSources(window) {
    loadSource(window, 'data.js');
    loadSource(window, 'storage.js');
    loadSource(window, 'quiz.js');
    loadSource(window, 'chart.js');
    loadSource(window, 'admin.js');
}

function resetApp(window) {
    const App = window.App;
    if (!App) return;
    // Reset cache and session
    if (App.db) {
        App.db._cache = null;
    }
    if (App.session) {
        try { sessionStorage.clear(); } catch(e) {}
    }
}

module.exports = { createTestEnv, loadSource, loadAllSources, resetApp };
