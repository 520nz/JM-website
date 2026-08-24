// ============================================================
// test-setup.js - 测试环境初始化（JSDOM 模拟浏览器）
// 按依赖顺序加载 App 源码，搭建可独立运行的测试沙箱
// ============================================================
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

function setupDOM() {
  const virtualConsole = new VirtualConsole();
  // 静默掉 CSS/布局相关警告，但保留 error（兼容新旧 JSDOM）
  try {
    virtualConsole.sendTo(console, { omitJSDOMErrors: true });
  } catch (_) {
    // fallthrough
  }
  virtualConsole.on('error', (...args) => console.error('[jsdom]', ...args));
  virtualConsole.on('warn', () => {}); // 静默 warn 避免刷屏

  const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body>
    <div id="quizArea"></div>
    <div id="wrongBookList"></div>
    <div id="categoryList"></div>
    <div id="questionList"></div>
    <div id="catStats"></div>
    <div id="trendChart"></div>
    <div id="achvGrid"></div>
    <canvas id="trendChartCanvas"></canvas>
    <div class="container"></div>
    <select id="categoryFilter"><option value=""></option></select>
    <select id="editCategory"></select>
    <input id="searchInput" value="">
    <div id="view-home" class="view active"></div>
    <div id="view-practice" class="view"></div>
    <div id="view-wrongbook" class="view"></div>
    <div id="view-stats" class="view"></div>
    <div id="view-admin" class="view"></div>
  </body></html>`, {
    url: 'http://localhost/',
    referrer: 'http://localhost/',
    contentType: 'text/html',
    includeNodeLocations: true,
    storageQuota: 10000000,
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole,
  });

  // 模拟缺失的浏览器 API
  const { window } = dom;
  global.window = window;
  global.document = window.document;
  global.navigator = window.navigator;
  global.indexedDB = window.indexedDB;
  global.sessionStorage = window.sessionStorage;
  global.localStorage = window.localStorage;
  global.URL = window.URL;
  global.Blob = window.Blob;
  global.AudioContext = window.AudioContext || function() {};
  global.webkitAudioContext = window.webkitAudioContext;
  window.HTMLCanvasElement.prototype.getContext = function() {
    // 最小 Canvas mock，满足 chart.js 调用
    const noop = () => {};
    return {
      scale: noop, clearRect: noop, createLinearGradient: () => ({ addColorStop: noop }),
      fillRect: noop, strokeRect: noop, beginPath: noop, moveTo: noop, lineTo: noop,
      stroke: noop, fillText: noop, arc: noop, fill: noop, roundRect: () => ({ fill: noop }),
      rect: noop, setLineDash: noop, createPattern: () => null, drawImage: noop,
      save: noop, restore: noop, translate: noop, rotate: noop, measureText: () => ({ width: 10 }),
    };
  };
  window.devicePixelRatio = 1;

  return dom;
}

function loadAppCode(dom) {
  const base = path.resolve(__dirname, '..');
  const files = ['js/data.js', 'js/storage.js', 'js/quiz.js', 'js/chart.js', 'js/admin.js', 'js/app.js'];
  for (const f of files) {
    const code = fs.readFileSync(path.join(base, f), 'utf8');
    // 用 eval 在 window 上下文中执行
    dom.window.eval.call(dom.window, code);
  }
  return dom.window.App;
}

function createTestContext() {
  const dom = setupDOM();
  const App = loadAppCode(dom);
  // 重置内存缓存（避免 IndexedDB 异步带来的非确定性）
  const reset = () => {
    const d = App.db.defaults();
    App.db.setData(d);
  };
  reset();
  return { App, dom, reset, window: dom.window };
}

module.exports = { createTestContext };
