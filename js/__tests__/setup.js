// 为 Node/jsdom 测试环境提供浏览器全局 API 与 IndexedDB 模拟
const fakeIndexedDBModule = require('fake-indexeddb');

// 导出一个工厂函数，测试可在 beforeEach 中调用以隔离 IndexedDB 状态
global.createTestIndexedDB = function() {
  const idb = new fakeIndexedDBModule.IDBFactory();
  if (typeof window !== 'undefined') {
    window.indexedDB = idb;
    window.IDBKeyRange = fakeIndexedDBModule.IDBKeyRange;
  }
  global.indexedDB = idb;
  global.IDBKeyRange = fakeIndexedDBModule.IDBKeyRange;
  return idb;
};

// 默认也注入一份到 global，供不手动重置的测试使用
global.createTestIndexedDB();

if (!global.performance) {
  global.performance = { now: function() { return Date.now(); } };
}

// jsdom 未提供 structuredClone，fake-indexeddb 写入对象时依赖它
if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = function structuredClone(value) {
    return JSON.parse(JSON.stringify(value));
  };
}
if (typeof window !== 'undefined' && typeof window.structuredClone === 'undefined') {
  window.structuredClone = global.structuredClone;
}

// jsdom 未实现 Canvas 2D 上下文，为 chart.js 提供最小 mock
if (typeof window !== 'undefined' && window.HTMLCanvasElement) {
  const originalGetContext = window.HTMLCanvasElement.prototype.getContext;
  window.HTMLCanvasElement.prototype.getContext = function(type) {
    if (type === '2d') {
      const gradient = { addColorStop: function() {} };
      return {
        scale: function() {},
        clearRect: function() {},
        stroke: function() {},
        beginPath: function() {},
        moveTo: function() {},
        lineTo: function() {},
        fill: function() {},
        arc: function() {},
        fillRect: function() {},
        fillText: function() {},
        createLinearGradient: function() { return gradient; },
        roundRect: function() {},
        rect: function() {}
      };
    }
    return originalGetContext.call(this, type);
  };
}
