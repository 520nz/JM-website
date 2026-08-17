import { beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

function loadSource(filename) {
    const p = path.resolve(__dirname, '..', 'js', filename);
    return fs.readFileSync(p, 'utf-8');
}

export function initApp() {
    if (typeof window === 'undefined') return;
    if (!window.App) window.App = {};
    eval(loadSource('data.js'));
}

export function initAppWithStorage() {
    initApp();
    eval(loadSource('storage.js'));
}

export function initAppWithQuiz() {
    initApp();
    eval(loadSource('storage.js'));
    eval(loadSource('quiz.js'));
}

export function initAppWithAdmin() {
    initApp();
    eval(loadSource('storage.js'));
    eval(loadSource('admin.js'));
}

export function resetStorageCache() {
    if (!window.App || !window.App.db) return;
    // 重置内部缓存
    if (typeof window.App.db.init === 'function') {
        window.App.db.setData(window.App.db.defaults());
    }
}
