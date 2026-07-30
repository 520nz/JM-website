// ============================================================
// test/browser-shim.js
// 浏览器环境最小化 mock，用于在 Node.js 中加载并执行前端源码
// 目标：保留被测代码的原始控制流；只 stub DOM/IndexedDB 等 Node 没有的 API
// ============================================================

(function() {
    'use strict';

    // --- window / document ---
    const localStorageStore = {};
    const sessionStorageStore = {};

    class StorageShim {
        constructor(store) { this._store = store; }
        getItem(k) { return Object.prototype.hasOwnProperty.call(this._store, k) ? this._store[k] : null; }
        setItem(k, v) { this._store[k] = String(v); }
        removeItem(k) { delete this._store[k]; }
        clear() { for (const k of Object.keys(this._store)) delete this._store[k]; }
        key(i) { return Object.keys(this._store)[i] || null; }
        get length() { return Object.keys(this._store).length; }
    }

    // DOM 元素按 id 缓存，允许测试代码预先 setValue
    const _domCache = {}; // { [id]: element }
    function _makeElement(id) {
        return {
            id,
            tagName: 'DIV',
            style: {},
            value: '',
            textContent: '',
            innerHTML: '',
            children: [],
            clientWidth: 600,
            classList: {
                _set: new Set(),
                add(c) { this._set.add(c); },
                remove(c) { this._set.delete(c); },
                contains(c) { return this._set.has(c); },
                toggle(c, force) {
                    if (force === true) this._set.add(c);
                    else if (force === false) this._set.delete(c);
                    else if (this._set.has(c)) this._set.delete(c);
                    else this._set.add(c);
                }
            },
            set className(v) { this._className = v; },
            get className() { return this._className || ''; },
            set textContent(v) { this._text = v; this._innerHTML = String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); },
            get textContent() { return this._text || ''; },
            set innerHTML(v) { this._innerHTML = v; this._text = String(v).replace(/<[^>]+>/g, ''); },
            get innerHTML() { return this._innerHTML || ''; },
            appendChild(c) { this.children.push(c); return c; },
            removeChild(c) { this.children = this.children.filter(x => x !== c); return c; },
            remove() {},
            setAttribute() {},
            addEventListener() {}, removeEventListener() {},
            querySelector() { return null; },
            querySelectorAll() { return []; },
            getContext() {
                return {
                    scale() {}, clearRect() {}, fillRect() {}, beginPath() {},
                    moveTo() {}, lineTo() {}, stroke() {}, fill() {}, arc() {},
                    fillText() {}, rect() {}, roundRect() {},
                    createLinearGradient() { return { addColorStop() {} }; },
                    set fillStyle(v) {}, get fillStyle() { return ''; },
                    set strokeStyle(v) {}, get strokeStyle() { return ''; },
                    set lineWidth(v) {}, get lineWidth() { return 1; },
                    set font(v) {}, get font() { return ''; },
                    set textAlign(v) {}, get textAlign() { return 'start'; }
                };
            },
            click() {},
            select() {},
            focus() {},
            trim() { return String(this.value).trim(); }
        };
    }

    const documentShim = {
        createElement(tag) {
            const el = _makeElement('__anon_' + Math.random());
            el.tagName = tag.toUpperCase();
            // 默认父元素：返回带 clientWidth 的占位
            Object.defineProperty(el, 'parentElement', {
                get() { return { clientWidth: 600, clientHeight: 200 }; }
            });
            return el;
        },
        querySelector() { return null; },
        querySelectorAll() { return []; },
        getElementById(id) {
            if (!_domCache[id]) {
                _domCache[id] = _makeElement(id);
                // canvas 元素需要父元素
                if (id.toLowerCase().includes('chart') || id.toLowerCase().includes('canvas')) {
                    Object.defineProperty(_domCache[id], 'parentElement', {
                        get() { return { clientWidth: 600, clientHeight: 200 }; }
                    });
                }
            }
            return _domCache[id];
        }
    };

    // 测试工具：重置整个 DOM 缓存或在测试前预设 value
    documentShim.__reset = function() { for (const k of Object.keys(_domCache)) delete _domCache[k]; };
    documentShim.__setValue = function(id, v) {
        if (!_domCache[id]) _domCache[id] = _makeElement(id);
        _domCache[id].value = v;
    };
    documentShim.__setText = function(id, v) {
        if (!_domCache[id]) _domCache[id] = _makeElement(id);
        _domCache[id].textContent = v;
    };

    // --- IndexedDB 最小化 stub ---
    // 仅支持被测代码中实际使用的接口：open(upgrade/onsuccess/onerror) + transaction
    // 内部使用内存对象模拟 object store。
    const _idbData = {}; // { [dbName]: { [storeName]: { [key]: value } } }

    function makeIdbRequest(result) {
        const req = { _result: result, _error: null, onsuccess: null, onerror: null, onupgradeneeded: null };
        setImmediate(() => {
            if (req._error && req.onerror) req.onerror({ target: req });
            else if (req.onsuccess) req.onsuccess({ target: req });
        });
        return req;
    }

    function makeIdbObjectStore(storeName, db) {
        if (!_idbData[db._name]) _idbData[db._name] = {};
        if (!_idbData[db._name][storeName]) _idbData[db._name][storeName] = {};
        const data = _idbData[db._name][storeName];
        return {
            put(value) {
                const key = value.id;
                data[key] = value;
                return makeIdbRequest(undefined);
            },
            get(key) {
                return makeIdbRequest(Object.prototype.hasOwnProperty.call(data, key) ? data[key] : undefined);
            },
            getAll() {
                return makeIdbRequest(Object.values(data));
            },
            clear() {
                for (const k of Object.keys(data)) delete data[k];
                return makeIdbRequest(undefined);
            }
        };
    }

    function makeIdbTransaction(storeNames, mode, db) {
        return {
            oncomplete: null,
            onerror: null,
            objectStore(name) { return makeIdbObjectStore(name, db); },
            _fire() {
                if (this.oncomplete) setImmediate(() => this.oncomplete());
            }
        };
    }

    class IdbDatabase {
        constructor(name) {
            this._name = name;
            this.objectStoreNames = new Set();
            if (_idbData[name]) {
                for (const s of Object.keys(_idbData[name])) this.objectStoreNames.add(s);
            }
        }
        createObjectStore(name) {
            this.objectStoreNames.add(name);
            if (!_idbData[this._name]) _idbData[this._name] = {};
            if (!_idbData[this._name][name]) _idbData[this._name][name] = {};
            return makeIdbObjectStore(name, this);
        }
        transaction(storeNames, mode) {
            const stores = Array.isArray(storeNames) ? storeNames : [storeNames];
            return makeIdbTransaction(stores, mode, this);
        }
    }

    const indexedDB = {
        open(name, version) {
            const req = { _result: null, onsuccess: null, onerror: null, onupgradeneeded: null };
            setImmediate(() => {
                const db = new IdbDatabase(name);
                req._result = db;
                if (req.onupgradeneeded) req.onupgradeneeded({ target: req });
                if (req.onsuccess) req.onsuccess({ target: req });
            });
            return req;
        }
    };

    // --- 暴露 ---
    // Node 24 中部分全局是只读 getter，用 defineProperty 强制写入
    function setGlobal(key, value) {
        try { global[key] = value; }
        catch (e) { Object.defineProperty(global, key, { value, writable: true, configurable: true }); }
    }

    setGlobal('window', {
        App: undefined,
        AudioContext: function() { return { currentTime: 0, destination: {}, createOscillator() { return { connect(){}, start(){}, stop(){}, frequency: { setValueAtTime(){} } }; }, createGain() { return { connect(){}, gain: { setValueAtTime(){}, exponentialRampToValueAtTime(){} } }; } }; },
        webkitAudioContext: undefined,
        devicePixelRatio: 1,
        addEventListener() {},
        removeEventListener() {}
    });
    setGlobal('document', documentShim);
    setGlobal('localStorage', new StorageShim(localStorageStore));
    setGlobal('sessionStorage', new StorageShim(sessionStorageStore));
    setGlobal('indexedDB', indexedDB);
    setGlobal('navigator', { vibrate() {}, clipboard: undefined });
    setGlobal('URL', { createObjectURL() { return 'blob://test'; }, revokeObjectURL() {} });
    setGlobal('Blob', function(parts) { this.parts = parts; });
    // 暴露最近一次 Blob 内容（测试用）
    global.__lastBlob = null;
    setGlobal('Blob', function(parts) {
        this.parts = parts;
        global.__lastBlob = parts ? parts.join('') : null;
        return this;
    });
    setGlobal('FileReader', function() {
        this.readAsText = (blob) => {
            setImmediate(() => this.onload && this.onload({
                target: {
                    result: blob && blob._content != null
                        ? blob._content
                        : (blob && blob.parts ? blob.parts.join('') : '')
                }
            }));
        };
    });
    setGlobal('AudioContext', global.window.AudioContext);

    // console.error / console.log 已天然存在
})();
