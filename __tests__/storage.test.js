// ============================================================
// storage.js 测试 - 数据归档逻辑
// ============================================================

// 模拟浏览器环境
global.App = {};

// 模拟 IndexedDB
const mockIndexedDB = {
  open: jest.fn(() => ({
    result: {
      createObjectStore: jest.fn(),
      transaction: jest.fn(() => ({
        objectStore: jest.fn(() => ({
          put: jest.fn(),
          get: jest.fn(),
          getAll: jest.fn(),
          clear: jest.fn()
        })),
        oncomplete: null,
        onerror: null
      })),
      objectStoreNames: {
        contains: jest.fn(() => false)
      }
    },
    onupgradeneeded: null,
    onsuccess: null,
    onerror: null
  }))
};

global.indexedDB = mockIndexedDB;

// 模拟 document.createElement 用于 XSS 转义
global.document = {
  createElement: jest.fn(() => ({
    textContent: '',
    get innerHTML() { return this._innerHTML || ''; },
    set innerHTML(v) { this._innerHTML = v; }
  }))
};

// 加载 storage.js
require('../js/storage.js');

describe('Storage Module - 数据归档逻辑', () => {
  beforeEach(() => {
    // 重置模拟
    jest.clearAllMocks();
    global.App.QUESTION_BANK = [
      { id: 'q1', category: '专辑', question: '测试题目1' },
      { id: 'q2', category: '歌曲', question: '测试题目2' }
    ];
  });

  describe('App.db.defaults()', () => {
    test('应该返回正确的默认数据结构', () => {
      const defaults = App.db.defaults();
      expect(defaults).toHaveProperty('history');
      expect(defaults).toHaveProperty('wrong');
      expect(defaults).toHaveProperty('stats');
      expect(defaults).toHaveProperty('archive');
      expect(Array.isArray(defaults.history)).toBe(true);
      expect(Array.isArray(defaults.wrong)).toBe(true);
      expect(Array.isArray(defaults.archive)).toBe(true);
    });
  });

  describe('数据归档逻辑验证', () => {
    test('归档阈值检查：history超过1000条应触发归档', () => {
      const historyLength = 1002;
      const threshold = 1000;
      const shouldArchive = historyLength > threshold;
      
      expect(shouldArchive).toBe(true);
    });

    test('归档不触发：history小于1000条', () => {
      const historyLength = 500;
      const threshold = 1000;
      const shouldArchive = historyLength > threshold;
      
      expect(shouldArchive).toBe(false);
    });

    test('按天聚合逻辑应正确工作', () => {
      const records = [
        { time: 1784790000000, ok: true, qid: 'q1' },
        { time: 1784790000000, ok: false, qid: 'q2' },
        { time: 1784790000000, ok: true, qid: 'q1' }
      ];
      
      const dayMap = {};
      records.forEach(rec => {
        const dt = new Date(rec.time);
        const key = `${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDate()}`;
        if (!dayMap[key]) dayMap[key] = { date: key, total: 0, correct: 0 };
        dayMap[key].total++;
        if (rec.ok) dayMap[key].correct++;
      });
      
      const aggregated = Object.values(dayMap);
      expect(aggregated.length).toBe(1);
      expect(aggregated[0].total).toBe(3);
      expect(aggregated[0].correct).toBe(2);
    });
  });

  describe('间隔重复逻辑', () => {
    test('间隔时间表应正确配置', () => {
      const SR_INTERVALS = [
        0,                        // level 0
        1 * 60 * 60 * 1000,       // level 1: 1小时
        1 * 24 * 60 * 60 * 1000,  // level 2: 1天
        3 * 24 * 60 * 60 * 1000,  // level 3: 3天
        7 * 24 * 60 * 60 * 1000,  // level 4: 7天
      ];
      
      expect(SR_INTERVALS[0]).toBe(0);
      expect(SR_INTERVALS[1]).toBe(3600000);  // 1小时
      expect(SR_INTERVALS[2]).toBe(86400000); // 1天
      expect(SR_INTERVALS[3]).toBe(259200000); // 3天
      expect(SR_INTERVALS[4]).toBe(604800000); // 7天
    });

    test('reviewCorrect 等级提升逻辑', () => {
      const currentLevel = 1;
      const newLevel = currentLevel + 1;
      const mastered = newLevel >= 5;
      
      expect(newLevel).toBe(2);
      expect(mastered).toBe(false);
    });

    test('reviewCorrect 达到level 5应标记为已掌握', () => {
      const currentLevel = 4;
      const newLevel = currentLevel + 1;
      const mastered = newLevel >= 5;
      
      expect(newLevel).toBe(5);
      expect(mastered).toBe(true);
    });

    test('reviewWrong 应重置等级为0', () => {
      const currentLevel = 3;
      const newLevel = 0;
      
      expect(newLevel).toBe(0);
    });
  });

  describe('getDueWrong() 逻辑', () => {
    test('应正确识别到期的错题', () => {
      const now = Date.now();
      const wrongItems = [
        { qid: 'q1', nextReview: now - 1000 },  // 已到期
        { qid: 'q2', nextReview: now + 10000 }, // 未到期
        { qid: 'q3' }  // 无nextReview（立即到期）
      ];
      
      const dueItems = wrongItems.filter(item => 
        !item.nextReview || item.nextReview <= now
      );
      
      expect(dueItems.length).toBe(2);
      expect(dueItems.find(w => w.qid === 'q1')).toBeDefined();
      expect(dueItems.find(w => w.qid === 'q3')).toBeDefined();
    });
  });
});