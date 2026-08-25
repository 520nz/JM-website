// 最小化测试 - 调试 Jest 环境
describe('调试测试', () => {
  test('环境基本可用', () => {
    expect(true).toBe(true);
  });

  test('App 对象存在', () => {
    // 加载 data.js
    const fs = require('fs');
    const path = require('path');
    global.App = {};
    
    // 加载 data.js
    eval(fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8'));
    expect(global.App.QUESTION_BANK.length).toBeGreaterThan(0);
  });

  test('storage.js 可以加载', () => {
    const fs = require('fs');
    const path = require('path');
    global.App = {};
    
    eval(fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8'));
    
    // 设置 storage.js 需要的最小 mock
    global.indexedDB = {
      open: function() {
        return {
          result: {},
          onsuccess: null,
          onerror: null,
          onupgradeneeded: null
        };
      },
      deleteDatabase: function() {}
    };
    
    eval(fs.readFileSync(path.join(__dirname, '..', 'js', 'storage.js'), 'utf8'));
    expect(global.App.db).toBeDefined();
    expect(global.App.esc).toBeDefined();
  });
});
