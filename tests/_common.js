import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

export function loadSource(name) {
    return readFileSync(join(ROOT, 'js', name), 'utf-8');
}

function makeReq() {
    const r = {};
    r.result = undefined;
    r.error = undefined;
    r.onsuccess = null;
    r.onerror = null;
    r._fireSuccess = function () {
        if (this.onsuccess) {
            try { this.onsuccess({ target: this }); } catch (_) {}
        }
    };
    r._fireError = function () {
        if (this.onerror) {
            try { this.onerror({ target: this }); } catch (_) {}
        }
    };
    return r;
}

function makeStore(state) {
    return {
        put(val, key) {
            const r = makeReq();
            queueMicrotask(() => {
                state[key ?? val.id] = val;
                r.result = val;
                r._fireSuccess();
            });
            return r;
        },
        get(key) {
            const r = makeReq();
            queueMicrotask(() => {
                r.result = state[key];
                r._fireSuccess();
            });
            return r;
        },
        delete(key) {
            const r = makeReq();
            queueMicrotask(() => {
                delete state[key];
                r.result = undefined;
                r._fireSuccess();
            });
            return r;
        },
        getAll() {
            const r = makeReq();
            queueMicrotask(() => {
                r.result = Object.values(state);
                r._fireSuccess();
            });
            return r;
        },
        clear() {
            const r = makeReq();
            queueMicrotask(() => {
                for (const k of Object.keys(state)) delete state[k];
                r.result = undefined;
                r._fireSuccess();
            });
            return r;
        },
    };
}

function makeDB() {
    const states = {
        userData: {},
        questionBank: {},
    };
    return {
        version: 1,
        objectStoreNames: {
            contains(n) { return states[n] !== undefined; },
        },
        transaction(names, mode) {
            const list = Array.isArray(names) ? names : [names];
            const map = {};
            for (const n of list) map[n] = makeStore(states[n]);
            return {
                objectStore(name) { return map[name]; },
            };
        },
        createObjectStore() {},
        close() {},
    };
}

let _mockDB = null;

export function setupMocks() {
    if (typeof window === 'undefined') return;
    _mockDB = null;
    window.indexedDB = {
        open(name, version) {
            const req = makeReq();
            queueMicrotask(() => {
                _mockDB = makeDB();
                req.result = _mockDB;
                req._fireSuccess();
            });
            return req;
        },
    };
    const noop = () => {};
    const tone = {
        setValueAtTime: noop, exponentialRampToValueAtTime: noop, linearRampToValueAtTime: noop,
    };
    window.AudioContext = class AudioContext {
        constructor() {}
        resume() {}
        get currentTime() { return 0; }
        createOscillator() {
            return {
                frequency: { setValueAtTime: noop, exponentialRampToValueAtTime: noop },
                gain: tone, type: 'sine',
                connect() { return this; },
                disconnect() {},
                start() {}, stop() {},
            };
        }
        createGain() {
            return {
                gain: tone,
                connect() { return this; },
                disconnect() {},
            };
        }
    };
    window.confirm = () => true;
    window.alert = () => {};
    window.open = window.open || (() => null);
    if (!window.navigator) window.navigator = {};
    if (!window.navigator.vibrate) window.navigator.vibrate = () => {};
    if (!window.Blob) {
        window.Blob = class Blob { constructor() {} };
        window.URL = { createObjectURL() { return ''; }, revokeObjectURL() {} };
    }
}

export function getMockDB() { return _mockDB; }

export function loadApp(components = {}) {
    setupMocks();
    window.App = {};
    window.eval(loadSource('data.js'));
    if (components.storage !== false) window.eval(loadSource('storage.js'));
    if (components.quiz !== false) {
        window.App.switchView = () => {};
        window.App.showAchievementToast = () => {};
        window.eval(loadSource('quiz.js'));
    }
    if (components.admin !== false) window.eval(loadSource('admin.js'));
    return window.App;
}

export async function initStorage() {
    await window.App.db.init();
    return window.App.db.get();
}

export function resetStorage() {
    if (window.App && window.App.db) {
        window.App.db.setData({
            history: [],
            wrong: [],
            stats: { total: 0, correct: 0, cats: {} },
            theme: 'dark',
            dailyGoal: 20,
            achievements: [],
            archive: [],
        });
    }
    if (window.sessionStorage) window.sessionStorage.clear();
}
