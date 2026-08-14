'use strict';

var App = {};

function htmlEscape(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function createBrowserShim() {
    var idbStore = {};

    function mockStorage() {
        var store = {};
        return {
            getItem: function(k) { return store[k] != null ? String(store[k]) : null; },
            setItem: function(k, v) { store[k] = String(v); },
            removeItem: function(k) { delete store[k]; },
            clear: function() { for (var k in store) delete store[k]; },
            _clearAllForTest: function() { for (var k in store) delete store[k]; }
        };
    }

    // document.createElement('div') must simulate textContent -> innerHTML escape
    var mockDocument = {
        createElement: function(tag) {
            if (tag === 'div') {
                var node = {
                    tagName: 'DIV',
                    classList: { add: function(){}, remove: function(){}, toggle: function(){} },
                    style: {},
                    setAttribute: function(){},
                    getAttribute: function(){ return null; },
                    appendChild: function(){ return {}; },
                    removeChild: function(){},
                    addEventListener: function(){},
                    removeEventListener: function(){}
                };
                Object.defineProperty(node, 'textContent', {
                    set: function(v) { node.innerHTML = htmlEscape(v == null ? '' : String(v)); },
                    get: function() { return ''; }
                });
                Object.defineProperty(node, 'innerHTML', {
                    writable: true, value: ''
                });
                Object.defineProperty(node, 'innerText', {
                    set: function(v) { node.innerHTML = htmlEscape(String(v)); }
                });
                return node;
            }
            return {};
        },
        querySelectorAll: function() { return []; },
        getElementById: function() { return null; },
        querySelector: function() { return null; },
        body: { appendChild: function(){}, removeChild: function(){} },
        documentElement: { setAttribute: function(){} },
        addEventListener: function(){}
    };

    function _getOrCreateDB(name) {
        if (!idbStore[name]) idbStore[name] = { version: 1, stores: {} };
        return idbStore[name];
    }

    var mockIndexedDB = {
        open: function(name, version) {
            var req = { result: null, error: null, onsuccess: null, onerror: null, onupgradeneeded: null };
            var dbEntry = _getOrCreateDB(name);
            req.result = _createDBConnection(name);
            // 让调用方有机会先注册回调，再触发 onupgradeneeded + onsuccess
            Promise.resolve().then(function() {
                if (req.onupgradeneeded) {
                    req.onupgradeneeded({ target: req });
                }
                if (req.onsuccess) {
                    req.onsuccess({ target: req });
                }
            });
            return req;
        }
    };

    function _createDBConnection(name) {
        var dbEntry = _getOrCreateDB(name);
        var db = {
            name: name,
            objectStoreNames: {
                contains: function(n) { return !!dbEntry.stores[n]; }
            },
            createObjectStore: function(storeName) {
                if (!dbEntry.stores[storeName]) dbEntry.stores[storeName] = [];
                return db._getStoreOps(storeName);
            },
            transaction: function(storeName, mode) {
                if (!dbEntry.stores[storeName]) dbEntry.stores[storeName] = [];
                var tx = {
                    objectStore: function() { return db._getStoreOps(storeName, tx); },
                    oncomplete: null,
                    onerror: null,
                    _pendingWrites: 0,
                    _fireComplete: function() {
                        Promise.resolve().then(function() {
                            if (tx.oncomplete) tx.oncomplete();
                        });
                    }
                };
                return tx;
            },
            _getStoreOps: function(storeName, tx) {
                var rows = dbEntry.stores[storeName];
                return {
                    put: function(val) {
                        var idx = -1;
                        for (var i = 0; i < rows.length; i++) {
                            if (rows[i].id === val.id) { idx = i; break; }
                        }
                        if (idx >= 0) rows[idx] = val;
                        else rows.push(val);
                        if (tx) tx._fireComplete();
                    },
                    get: function(key) {
                        var req = { result: null, onsuccess: null, onerror: null };
                        var result = null;
                        for (var i = 0; i < rows.length; i++) {
                            if (rows[i].id === key) { result = rows[i]; break; }
                        }
                        req.result = result;
                        Promise.resolve().then(function() {
                            if (req.onsuccess) req.onsuccess({ target: req });
                        });
                        return req;
                    },
                    getAll: function() {
                        var req = { result: null, onsuccess: null, onerror: null };
                        req.result = rows.slice();
                        Promise.resolve().then(function() {
                            if (req.onsuccess) req.onsuccess({ target: req });
                        });
                        return req;
                    },
                    clear: function() { rows.length = 0; }
                };
            }
        };
        return db;
    }

    return {
        App: App,
        window: {
            App: App,
            AudioContext: function(){
                var that = this;
                that.createOscillator = function(){
                    return { connect:function(){ return { connect:function(){} }; }, start:function(){}, stop:function(){}, frequency:{ setValueAtTime:function(){} }, type:'sine' };
                };
                that.createGain = function(){
                    return { gain:{ setValueAtTime:function(){}, exponentialRampToValueAtTime:function(){} }, connect:function(){ return { connect:function(){} }; } };
                };
            },
            document: mockDocument,
            indexedDB: mockIndexedDB,
            sessionStorage: mockStorage(),
            localStorage: mockStorage(),
            navigator: {},
            setInterval: global.setInterval,
            clearInterval: global.clearInterval,
            setTimeout: global.setTimeout,
            clearTimeout: global.clearTimeout
        },
        document: mockDocument,
        indexedDB: mockIndexedDB,
        sessionStorage: mockStorage(),
        localStorage: mockStorage(),
        navigator: {},
        console: console
    };
}

module.exports = { createBrowserShim, htmlEscape };
