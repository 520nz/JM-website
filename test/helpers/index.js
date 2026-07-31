// helpers/index.js - 测试用工具集
const { loadStorage, loadAdmin, loadQuiz, loadChart, ensureGlobalPolyfills } = require('./loadSource');
const { QUESTION_BANK, daysAgo } = require('./fixtures');

let _singleton = null;

/**
 * 重置内存数据并重新加载 storage.js，返回干净的 App 命名空间。
 * 每个 test 必须在 setup 中调用一次以获得隔离的内存缓存。
 *
 * 实现：在第一次调用时尝试删除并重建 IDB（避免被 storage.js
 * 模块级 _db 缓存阻塞）；之后每次清空内存缓存与 sessionStorage。
 */
async function freshApp() {
  ensureGlobalPolyfills();
  if (!_singleton) {
    // 第一次：直接重建（无现存 _db 引用）
    _singleton = await loadStorage();
  } else {
    // 后续：使用现有 App，但重置内存数据
    // 关键：get/setData 不会影响 IDB 中已存数据；下次 init 会从 IDB 拉旧数据
    // 因此要保证不会跨测试污染：直接覆盖 _cache 引用指向新对象
    const fresh = _singleton.db.defaults();
    _singleton.db.setData(fresh);
  }
  // 清空 sessionStorage
  if (global.sessionStorage && global.sessionStorage.clear) global.sessionStorage.clear();
  // 注入标准题库（每个 test 各自一份拷贝，避免被 importData 改写）
  const bank = QUESTION_BANK.map(q => Object.assign({}, q, {
    options: q.options.map(o => Object.assign({}, o))
  }));
  _singleton.QUESTION_BANK = bank;
  // storeReset 依赖 DEFAULT_QUESTION_BANK（仅在 IDB 有数据时被 storage.js 设置）
  // 测试中 IDB 是空的，需要手动注入作为"出厂快照"
  _singleton.DEFAULT_QUESTION_BANK = bank.map(q => Object.assign({}, q, {
    options: q.options.map(o => Object.assign({}, o))
  }));
  return _singleton;
}

module.exports = { freshApp, loadAdmin, loadQuiz, loadChart, QUESTION_BANK, daysAgo };
