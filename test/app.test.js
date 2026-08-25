// ============================================================
// app.test.js - 主应用逻辑测试
// ============================================================

const { setupBrowserMocks, loadAllScripts } = require('./test-helper');

setupBrowserMocks();

function setupDOM() {
  document.body.innerHTML = '';
  
  // 视图容器
  var viewIds = ['view-home', 'view-practice', 'view-category', 'view-wrongbook', 'view-stats', 'view-admin'];
  viewIds.forEach(function(id) {
    var el = document.createElement('div');
    el.id = id;
    el.className = 'view';
    document.body.appendChild(el);
  });

  // quiz 相关元素
  var quizArea = document.createElement('div');
  quizArea.id = 'quizArea';
  document.body.appendChild(quizArea);

  // 首页元素
  var homeIds = ['todayCount', 'todayAcc', 'goalProgress', 'goalTarget', 'streakBadge', 'goalBar'];
  homeIds.forEach(function(id) {
    var el = document.createElement(id === 'goalBar' ? 'div' : 'span');
    el.id = id;
    if (id === 'goalBar') el.style.width = '0%';
    document.body.appendChild(el);
  });

  // 错题本元素
  var wbl = document.createElement('div');
  wbl.id = 'wrongBookList';
  document.body.appendChild(wbl);

  var wbb = document.createElement('button');
  wbb.id = 'wrongBookBtn';
  document.body.appendChild(wbb);

  // 统计页元素
  var statsIds = ['sTotal', 'sCorrect', 'sAcc', 'sWrong', 'catStats', 'trendChart', 'statsDiv'];
  statsIds.forEach(function(id) {
    var el = document.createElement(id === 'catStats' || id === 'trendChart' || id === 'statsDiv' ? 'div' : 'span');
    el.id = id;
    document.body.appendChild(el);
  });

  var container = document.createElement('div');
  container.className = 'container';
  document.body.appendChild(container);
  
  // Admin 页面元素
  var adminIds = ['categoryFilter', 'editCategory', 'searchInput', 'questionList'];
  adminIds.forEach(function(id) {
    var el = document.createElement(id === 'questionList' ? 'div' : (id === 'searchInput' ? 'input' : 'select'));
    el.id = id;
    document.body.appendChild(el);
  });
}

beforeEach(function() {
  setupDOM();
  App = loadAllScripts();
  App.db.init();
  App.db.setData(App.db.defaults());
  
  // Mock 浏览器 API
  window.alert = jest.fn();
  window.confirm = jest.fn(function() { return true; });
  window.prompt = jest.fn(function(msg, def) { return def != null ? def : null; });
  
  // Mock 复杂 DOM 依赖的函数
  App.updateHome = jest.fn();
  App.stopTimer = jest.fn();
  App.showResumePrompt = jest.fn();
  App.renderTrendChart = jest.fn();
  App.renderAchievements = jest.fn();
});

// ============================================================
// 视图切换 (switchView)
// ============================================================
describe('视图切换', () => {
  test('switchView 切换到指定视图', () => {
    App.switchView('home');
    expect(document.getElementById('view-home').classList.contains('active')).toBe(true);
  });

  test('switchView 清除其他视图的 active 类', () => {
    App.switchView('home');
    App.switchView('stats');
    expect(document.getElementById('view-stats').classList.contains('active')).toBe(true);
    expect(document.getElementById('view-home').classList.contains('active')).toBe(false);
  });

  test('switchView 支持 practice 视图', () => {
    App.switchView('practice');
    expect(document.getElementById('view-practice').classList.contains('active')).toBe(true);
  });

  test('switchView 支持 category 视图', () => {
    App.switchView('category');
    expect(document.getElementById('view-category').classList.contains('active')).toBe(true);
  });
});

// ============================================================
// 每日目标 (editDailyGoal)
// ============================================================
describe('每日目标', () => {
  test('editDailyGoal 接受有效输入并保存', () => {
    window.prompt = jest.fn(function(msg, def) { return '30'; });
    App.editDailyGoal();
    var data = App.db.get();
    expect(data.dailyGoal).toBe(30);
  });

  test('editDailyGoal 取消输入不改变目标', () => {
    var original = App.db.getDailyGoal();
    window.prompt = jest.fn(function() { return null; });
    App.editDailyGoal();
    expect(App.db.getDailyGoal()).toBe(original);
  });

  test('editDailyGoal 拒绝无效输入', () => {
    var original = App.db.getDailyGoal();
    window.prompt = jest.fn(function() { return 'abc'; });
    App.editDailyGoal();
    expect(App.db.getDailyGoal()).toBe(original);
    expect(window.alert).toHaveBeenCalled();
  });

  test('editDailyGoal 边界值：低于最小值 5', () => {
    var original = App.db.getDailyGoal();
    window.prompt = jest.fn(function() { return '3'; });
    App.editDailyGoal();
    expect(App.db.getDailyGoal()).toBe(original);
  });

  test('editDailyGoal 边界值：超过最大值 100', () => {
    var original = App.db.getDailyGoal();
    window.prompt = jest.fn(function() { return '150'; });
    App.editDailyGoal();
    expect(App.db.getDailyGoal()).toBe(original);
  });

  test('getDailyGoal 返回默认值 20', () => {
    expect(App.db.getDailyGoal()).toBe(20);
  });
});

// ============================================================
// 主题切换 (switchTheme / applyTheme)
// ============================================================
describe('主题切换', () => {
  test('switchTheme 从 light 切换到 dark', () => {
    var data = App.db.get();
    data.theme = 'light';
    App.db.setData(data);
    App.switchTheme();
    var result = App.db.get();
    expect(result.theme).toBe('dark');
  });

  test('switchTheme 从 dark 切换到 light', () => {
    var data = App.db.get();
    data.theme = 'dark';
    App.db.setData(data);
    App.switchTheme();
    var result = App.db.get();
    expect(result.theme).toBe('light');
  });

  test('applyTheme 设置 documentElement 的 data-theme 属性', () => {
    var data = App.db.get();
    data.theme = 'dark';
    App.db.setData(data);
    App.applyTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  test('applyTheme 使用默认主题（无设置时）', () => {
    var data = App.db.get();
    delete data.theme;
    App.db.setData(data);
    App.applyTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});

// ============================================================
// 成就通知 (showAchievementToast)
// ============================================================
describe('成就通知', () => {
  test('showAchievementToast 创建带 achv-toast 类的元素', () => {
    var initialCount = document.querySelectorAll('.achv-toast').length;
    App.showAchievementToast({ icon: '🎵', name: '首次答题', desc: '完成第一道题' });
    var afterCount = document.querySelectorAll('.achv-toast').length;
    expect(afterCount).toBe(initialCount + 1);
  });

  test('showAchievementToast 包含成就名称', () => {
    var toast = document.createElement('div');
    toast.className = 'achv-toast';
    App.showAchievementToast({ icon: '🏆', name: '测试达人', desc: '完成100题' });
    var toasts = document.querySelectorAll('.achv-toast');
    var lastToast = toasts[toasts.length - 1];
    expect(lastToast.innerHTML).toContain('测试达人');
  });

  test('showAchievementToast 包含图标', () => {
    App.showAchievementToast({ icon: '⭐', name: '星星', desc: 'desc' });
    var toasts = document.querySelectorAll('.achv-toast');
    var lastToast = toasts[toasts.length - 1];
    expect(lastToast.innerHTML).toContain('⭐');
  });
});

// ============================================================
// 错题本渲染 (renderWrongBook)
// ============================================================
describe('错题本渲染', () => {
  test('renderWrongBook 空错题显示空状态', () => {
    App.renderWrongBook();
    var list = document.getElementById('wrongBookList');
    expect(list.innerHTML).toContain('暂无错题记录');
  });

  test('renderWrongBook 渲染错题列表', () => {
    var data = App.db.get();
    data.wrong = [
      { qid: '001', cnt: 2, level: 1, nextReview: Date.now() + 86400000, lastReview: Date.now() - 86400000, time: Date.now() - 172800000 },
      { qid: '002', cnt: 1, level: 0, nextReview: Date.now(), lastReview: 0, time: Date.now() }
    ];
    App.db.setData(data);
    App.renderWrongBook();
    var list = document.getElementById('wrongBookList');
    expect(list.innerHTML).toContain('Lv.');
  });

  test('renderWrongBook 排序模式：recent（默认）', () => {
    var data = App.db.get();
    data.wrong = [
      { qid: '001', cnt: 2, level: 1, nextReview: Date.now() + 86400000, lastReview: Date.now() - 86400000, time: 1000 },
      { qid: '002', cnt: 5, level: 3, nextReview: Date.now(), lastReview: 0, time: 5000 }
    ];
    App.db.setData(data);
    // 默认排序是 recent（按 time 倒序）
    App.renderWrongBook();
    var list = document.getElementById('wrongBookList');
    // qid 002 时间更新（5000 > 1000），应该排在前面
    expect(list.innerHTML).toContain('Lv.');
  });

  test('setWrongSort 切换排序模式', () => {
    App.setWrongSort('count');
    var data = App.db.get();
    data.wrong = [
      { qid: '001', cnt: 2, level: 1, nextReview: Date.now() + 86400000, lastReview: Date.now() - 86400000, time: 1000 },
      { qid: '002', cnt: 5, level: 3, nextReview: Date.now(), lastReview: 0, time: 5000 }
    ];
    App.db.setData(data);
    App.renderWrongBook();
    var list = document.getElementById('wrongBookList');
    expect(list.innerHTML).toContain('Lv.');
  });

  test('removeWrong 从错题本移除题目', () => {
    var data = App.db.get();
    data.wrong = [
      { qid: '001', cnt: 2, level: 1, nextReview: Date.now() + 86400000, lastReview: Date.now() - 86400000, time: Date.now() - 172800000 }
    ];
    App.db.setData(data);
    var initialLen = App.db.getWrong().length;
    App.removeWrong('001');
    expect(App.db.getWrong().length).toBe(initialLen - 1);
  });

  test('getDueWrong 返回到期错题', () => {
    var now = Date.now();
    var data = App.db.get();
    data.wrong = [
      { qid: '001', cnt: 2, level: 1, nextReview: now - 1000, lastReview: now - 86400000, time: now - 172800000 },
      { qid: '002', cnt: 1, level: 0, nextReview: now + 86400000, lastReview: 0, time: now }
    ];
    App.db.setData(data);
    var due = App.db.getDueWrong();
    expect(due.length).toBe(1);
    expect(due[0].qid).toBe('001');
  });
});

// ============================================================
// 数据完整性
// ============================================================
describe('数据完整性', () => {
  test('默认数据包含必要字段', () => {
    var defaults = App.db.defaults();
    expect(defaults.history).toBeDefined();
    expect(Array.isArray(defaults.history)).toBe(true);
    expect(defaults.wrong).toBeDefined();
    expect(Array.isArray(defaults.wrong)).toBe(true);
    expect(defaults.stats).toBeDefined();
    expect(defaults.dailyGoal).toBeDefined();
  });

  test('初始化后数据可用', () => {
    var data = App.db.get();
    expect(data).toBeDefined();
    expect(data.history).toBeDefined();
    expect(data.wrong).toBeDefined();
  });

  test('stats 初始值为零', () => {
    var data = App.db.get();
    expect(data.stats.total).toBe(0);
    expect(data.stats.correct).toBe(0);
  });
});