// 烟雾测试：验证沙箱与 storage.js 加载链路是否可用
const test = require('node:test');
const assert = require('node:assert');
const { freshApp, daysAgo } = require('./helpers');
const { loadStorage } = require('./helpers/loadSource');

test('加载 storage.js 后 App.db / App.session 可用', async () => {
  const App = await loadStorage();
  assert.ok(App, 'App 命名空间已建立');
  assert.strictEqual(typeof App.db.init, 'function');
  assert.strictEqual(typeof App.db.addWrong, 'function');
  assert.strictEqual(typeof App.db.addRecord, 'function');
  assert.strictEqual(typeof App.session.save, 'function');
  // 默认值正确
  const d = App.db.get();
  assert.deepStrictEqual(d.history, []);
  assert.deepStrictEqual(d.wrong, []);
  assert.strictEqual(d.dailyGoal, 20);
});

test('App.esc 转义 HTML 特殊字符（防 XSS 基础）', async () => {
  const App = await freshApp();
  const esc = App.esc;
  assert.strictEqual(esc('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.strictEqual(esc('a & b'), 'a &amp; b');
  // 注意：浏览器 textContent/innerHTML 序列化只转义 <, >, & 三者
  assert.strictEqual(esc('"\'<>&'), '"\'&lt;&gt;&amp;');
  assert.strictEqual(esc(null), '');
  assert.strictEqual(esc(undefined), '');
  assert.strictEqual(esc(0), '0');
  assert.strictEqual(esc(false), 'false');
});
