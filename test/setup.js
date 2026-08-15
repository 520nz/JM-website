const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

class InMemoryIndexedDB {
    constructor() {
        this.databases = new Map();
    }

    open(name, version) {
        return new IDBOpenRequest(this, name, version);
    }
}

class IDBOpenRequest {
    constructor(db, name, version) {
        this._db = db;
        this._name = name;
        this._version = version;
        this.result = null;
        this.error = null;
        this.onupgradeneeded = null;
        this.onsuccess = null;
        this.onerror = null;
        process.nextTick(() => this._execute());
    }

    _execute() {
        let idb = this._db.databases.get(this._name);
        let needsUpgrade = !idb;
        if (!idb) {
            idb = { stores: new Map() };
            this._db.databases.set(this._name, idb);
        }
        const fakeDB = new IDBDatabase(idb, this._name);
        if (needsUpgrade && this.onupgradeneeded) {
            this.onupgradeneeded({ target: { result: fakeDB } });
        }
        this.result = fakeDB;
        if (this.onsuccess) this.onsuccess({ target: this });
    }
}

class IDBDatabase {
    constructor(inner, name) {
        this._inner = inner;
        this._name = name;
        this.objectStoreNames = {
            contains: (n) => this._inner.stores.has(n),
        };
    }

    createObjectStore(name, options) {
        const store = new IDBObjectStore(name, options || {});
        this._inner.stores.set(name, store);
        return store;
    }

    transaction(storeNames, mode) {
        const names = Array.isArray(storeNames) ? storeNames : [storeNames];
        return new IDBTransaction(names, this._inner.stores, mode);
    }
}

class IDBTransaction {
    constructor(names, stores, mode) {
        this._stores = stores;
        this._names = names;
        this._mode = mode;
        this.oncomplete = null;
        this.onerror = null;
        this._pending = 0;
    }

    objectStore(name) {
        return this._stores.get(name);
    }

    _begin() {
        if (this._pending === 0) return;
        this._pending--;
        if (this._pending === 0) {
            process.nextTick(() => {
                if (this.oncomplete) this.oncomplete();
            });
        }
    }

    _register() {
        this._pending++;
    }
}

class IDBObjectStore {
    constructor(name, options) {
        this._name = name;
        this._keyPath = options.keyPath;
        this._data = new Map();
    }

    clear() {
        this._data.clear();
    }

    put(value) {
        const req = new IDBRequest(this);
        let key = value[this._keyPath];
        this._data.set(String(key), value);
        req.result = key;
        process.nextTick(() => {
            if (req.onsuccess) req.onsuccess({ target: req });
        });
        return req;
    }

    get(key) {
        const req = new IDBRequest(this);
        const found = this._data.get(String(key));
        req.result = found || undefined;
        process.nextTick(() => {
            if (req.onsuccess) req.onsuccess({ target: req });
        });
        return req;
    }

    getAll() {
        const req = new IDBRequest(this);
        req.result = Array.from(this._data.values());
        process.nextTick(() => {
            if (req.onsuccess) req.onsuccess({ target: req });
        });
        return req;
    }
}

class IDBRequest {
    constructor(store) {
        this._store = store;
        this.result = null;
        this.error = null;
        this.onsuccess = null;
        this.onerror = null;
    }
}

function setup() {
    const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
        url: 'http://localhost',
        runScripts: 'dangerously',
        resources: 'usable'
    });

    global.window = dom.window;
    global.document = dom.window.document;
    global.navigator = dom.window.navigator;
    global.sessionStorage = dom.window.sessionStorage;
    global.localStorage = dom.window.localStorage;

    const idb = new InMemoryIndexedDB();
    global.indexedDB = idb;
    global.window.indexedDB = idb;

    global.AudioContext = undefined;
    global.window.AudioContext = undefined;
    global.navigator.vibrate = () => {};

    global.window.App = {};
    global.App = global.window.App;

    return { dom, idb };
}

function loadScript(file) {
    const code = fs.readFileSync(file, 'utf-8');
    const script = global.document.createElement('script');
    script.textContent = code;
    global.document.head.appendChild(script);
}

module.exports = { setup, loadScript, InMemoryIndexedDB };
