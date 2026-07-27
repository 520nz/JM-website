/**
 * admin.js 选项解析逻辑测试
 * 覆盖：选项格式正则解析（核心数据验证逻辑）
 */

// --- 浏览器 API 模拟 ---
var mockStorage = {};
global.sessionStorage = {
  getItem: function(k) { return mockStorage[k] || null; },
  setItem: function(k, v) { mockStorage[k] = v; },
  removeItem: function(k) { delete mockStorage[k]; }
};

global.document = {
  createElement: function(tag) {
    return { textContent: '', innerHTML: '' };
  }
};

global.window = global;
global.indexedDB = null;
global.App = {};
require('../js/data.js');
require('../js/storage.js');

// 从 admin.js 源码提取的选项解析正则（与 saveQuestion 一致）
var OPTION_REGEX = /^([A-Z])[.、．]\s*(.+)$/;

describe('选项解析正则 - admin.js saveQuestion', function() {
  test('标准格式 A.选项内容', function() {
    var match = 'A.林俊杰'.match(OPTION_REGEX);
    expect(match).not.toBeNull();
    expect(match[1]).toBe('A');
    expect(match[2]).toBe('林俊杰');
  });

  test('中文顿号 A、选项内容', function() {
    var match = 'A、林俊杰'.match(OPTION_REGEX);
    expect(match).not.toBeNull();
    expect(match[1]).toBe('A');
    expect(match[2]).toBe('林俊杰');
  });

  test('全角点号 A．选项内容', function() {
    var match = 'A．林俊杰'.match(OPTION_REGEX);
    expect(match).not.toBeNull();
    expect(match[1]).toBe('A');
    expect(match[2]).toBe('林俊杰');
  });

  test('带空格 A. 选项内容', function() {
    var match = 'A. 选项内容'.match(OPTION_REGEX);
    expect(match).not.toBeNull();
    expect(match[1]).toBe('A');
    expect(match[2]).toBe('选项内容');
  });

  test('B/C/D 选项均能解析', function() {
    expect('B.选项B'.match(OPTION_REGEX)[1]).toBe('B');
    expect('C.选项C'.match(OPTION_REGEX)[1]).toBe('C');
    expect('D.选项D'.match(OPTION_REGEX)[1]).toBe('D');
  });

  test('无分隔符不匹配', function() {
    expect('A选项内容'.match(OPTION_REGEX)).toBeNull();
  });

  test('小写字母不匹配', function() {
    expect('a.选项内容'.match(OPTION_REGEX)).toBeNull();
  });

  test('空行不匹配', function() {
    expect(''.match(OPTION_REGEX)).toBeNull();
    expect('   '.match(OPTION_REGEX)).toBeNull();
  });

  test('仅key无内容不匹配', function() {
    // A. 后无内容
    expect('A.'.match(OPTION_REGEX)).toBeNull();
  });
});

describe('题库数据完整性验证', function() {
  test('QUESTION_BANK 非空', function() {
    expect(App.QUESTION_BANK.length).toBeGreaterThan(0);
  });

  test('每道题包含必要字段', function() {
    for (var i = 0; i < App.QUESTION_BANK.length; i++) {
      var q = App.QUESTION_BANK[i];
      expect(q.id).toBeDefined();
      expect(q.category).toBeDefined();
      expect(q.question).toBeDefined();
      expect(q.options).toBeDefined();
      expect(q.answer).toBeDefined();
      expect(q.options.length).toBeGreaterThanOrEqual(2);
    }
  });

  test('答案值在选项 key 中存在', function() {
    for (var i = 0; i < App.QUESTION_BANK.length; i++) {
      var q = App.QUESTION_BANK[i];
      var keys = q.options.map(function(o) { return o.key; });
      expect(keys).toContain(q.answer);
    }
  });

  test('ID 不重复', function() {
    var ids = App.QUESTION_BANK.map(function(q) { return q.id; });
    var unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  test('分类包含预期的四个类别', function() {
    var cats = {};
    for (var i = 0; i < App.QUESTION_BANK.length; i++) {
      cats[App.QUESTION_BANK[i].category] = true;
    }
    expect(cats['专辑']).toBe(true);
    expect(cats['歌曲']).toBe(true);
    expect(cats['个人信息']).toBe(true);
    expect(cats['获奖记录']).toBe(true);
  });
});
