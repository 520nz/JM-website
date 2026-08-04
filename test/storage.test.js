/**
 * storage.js 核心数据层测试（简化版）
 * 覆盖：IndexedDB操作、间隔重复算法、成就系统、会话管理
 */

describe('Storage Module - 核心数据层', () => {
  beforeEach(() => {
    // 清空 IndexedDB
    if (global.indexedDB && global.indexedDB._databases) {
      global.indexedDB._databases.clear();
    }
    
    // 重置 App 命名空间
    global.App = {};
    
    // 加载 storage.js
    const fs = require('fs');
    const path = require('path');
    const storageCode = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf-8');
    
    // 模拟 document
    global.document = {
      createElement: jest.fn(() => ({
        textContent: '',
        innerHTML: ''
      }))
    };
    
    eval(storageCode);
  });

  describe('IndexedDB 异步操作', () => {
    test('init() 应该成功初始化并返回默认数据', async () => {
      const data = await global.App.db.init();
      
      expect(data).toBeDefined();
      expect(data.history).toEqual([]);
      expect(data.wrong).toEqual([]);
      expect(data.stats).toEqual({ total: 0, correct: 0, cats: {} });
      expect(data.theme).toBe('dark');
      expect(data.dailyGoal).toBe(20);
    });

    test('get() 应该返回内存缓存数据', async () => {
      await global.App.db.init();
      const data = global.App.db.get();
      
      expect(data).toBeDefined();
      expect(data.history).toBeInstanceOf(Array);
    });

    test('addRecord() 应该正确记录答题历史', async () => {
      await global.App.db.init();
      global.App.QUESTION_BANK = [
        { id: 'q1', category: '专辑', question: '测试题', options: [], answer: 'A' }
      ];
      
      const record = { qid: 'q1', ans: 'A', ok: true, time: Date.now() };
      global.App.db.addRecord(record);
      
      const data = global.App.db.get();
      expect(data.history.length).toBe(1);
      expect(data.stats.total).toBe(1);
      expect(data.stats.correct).toBe(1);
      expect(data.stats.cats['专辑']).toBeDefined();
      expect(data.stats.cats['专辑'].t).toBe(1);
      expect(data.stats.cats['专辑'].c).toBe(1);
    });

    test('addWrong() 应该正确添加错题', async () => {
      await global.App.db.init();
      global.App.QUESTION_BANK = [
        { id: 'q2', category: '测试', question: '测试', options: [], answer: 'B' }
      ];
      
      global.App.db.addWrong('q2');
      let wrong = global.App.db.getWrong();
      expect(wrong.length).toBe(1);
      expect(wrong[0].qid).toBe('q2');
      expect(wrong[0].cnt).toBe(1);
      expect(wrong[0].level).toBe(0);
      
      // 重复添加应该增加计数
      global.App.db.addWrong('q2');
      wrong = global.App.db.getWrong();
      expect(wrong[0].cnt).toBe(2);
    });

    test('历史数据归档应该在超过1000条时触发', async () => {
      await global.App.db.init();
      global.App.QUESTION_BANK = [
        { id: 'q3', category: '测试', question: '测试', options: [], answer: 'A' }
      ];
      
      // 生成超过1000条历史记录
      const oldTime = Date.now() - 100 * 24 * 60 * 60 * 1000; // 100天前
      for (let i = 0; i < 1100; i++) {
        global.App.db.addRecord({ 
          qid: 'q3', 
          ans: 'A', 
          ok: true, 
          time: oldTime + i * 1000 
        });
      }
      
      const data = global.App.db.get();
      expect(data.history.length).toBeLessThan(1000);
      expect(data.archive.length).toBeGreaterThan(0);
    }, 10000); // 增加超时时间
  });

  describe('间隔重复算法', () => {
    test('错题等级应该在答对时正确提升', async () => {
      await global.App.db.init();
      
      global.App.QUESTION_BANK = [
        { id: 'test-001', category: '测试', question: '测试题', options: [], answer: 'A' }
      ];
      
      global.App.db.addWrong('test-001');
      const wrongBefore = global.App.db.getWrong();
      expect(wrongBefore.length).toBe(1);
      expect(wrongBefore[0].level).toBe(0);
      
      // 模拟答对（错题复习）
      const result = global.App.db.reviewCorrect('test-001');
      expect(result.mastered).toBe(false);
      expect(result.level).toBe(1);
      
      // 连续答对直到掌握
      for (let i = 0; i < 4; i++) {
        global.App.db.reviewCorrect('test-001');
      }
      
      const wrongAfter = global.App.db.getWrong();
      expect(wrongAfter.length).toBe(0); // 已掌握，从错题本移除
    });

    test('错题等级应该在答错时重置为0', async () => {
      await global.App.db.init();
      global.App.QUESTION_BANK = [
        { id: 'test-002', category: '测试', question: '测试题', options: [], answer: 'A' }
      ];
      
      global.App.db.addWrong('test-002');
      global.App.db.reviewCorrect('test-002');
      
      let wrong = global.App.db.getWrong();
      expect(wrong[0].level).toBe(1);
      
      // 答错，等级应重置
      global.App.db.reviewWrong('test-002');
      wrong = global.App.db.getWrong();
      expect(wrong[0].level).toBe(0);
      expect(wrong[0].cnt).toBe(2);
    });
  });

  describe('成就系统', () => {
    test('getAchievementDefs() 应该返回所有成就定义', async () => {
      await global.App.db.init();
      const defs = global.App.db.getAchievementDefs();
      
      expect(defs.length).toBe(10);
      expect(defs.find(a => a.id === 'first_answer')).toBeDefined();
      expect(defs.find(a => a.id === 'perfect_10')).toBeDefined();
    });

    test('checkAchievements() 应该正确解锁成就', async () => {
      await global.App.db.init();
      global.App.QUESTION_BANK = [
        { id: 'q4', category: '专辑', question: '测试', options: [], answer: 'A' }
      ];
      
      // 第一次答题应该解锁 first_answer
      global.App.db.addRecord({ qid: 'q4', ans: 'A', ok: true, time: Date.now() });
      const newUnlocks = global.App.db.checkAchievements();
      
      expect(newUnlocks).toBeDefined();
      expect(newUnlocks.find(a => a.id === 'first_answer')).toBeDefined();
      
      const achievements = global.App.db.getAchievements();
      expect(achievements).toContain('first_answer');
    });

    test('完美一轮成就应该在10题全对时解锁', async () => {
      await global.App.db.init();
      
      const result = global.App.db.checkAchievements({ quizTotal: 10, quizCorrect: 10 });
      expect(result.find(a => a.id === 'perfect_10')).toBeDefined();
    });

    test('连续打卡天数应该正确计算', async () => {
      await global.App.db.init();
      global.App.QUESTION_BANK = [
        { id: 'q5', category: '测试', question: '测试', options: [], answer: 'A' }
      ];
      
      // 添加今天的答题记录
      const today = Date.now();
      global.App.db.addRecord({ qid: 'q5', ans: 'A', ok: true, time: today });
      
      const streak = global.App.db.getStreak();
      expect(streak).toBe(1);
    });
  });

  describe('会话管理 (App.session)', () => {
    test('save() 和 load() 应该正确保存和恢复会话', async () => {
      await global.App.db.init();
      
      const state = {
        quiz: [
          { id: 'q1', question: '测试', options: [], answer: 'A' },
          { id: 'q2', question: '测试', options: [], answer: 'B' }
        ],
        idx: 1,
        correctCount: 1,
        startTime: Date.now(),
        mode: 'quick',
        isWrongBookQuiz: false
      };
      
      global.App.session.save(state);
      
      const loaded = global.App.session.load();
      expect(loaded).toBeDefined();
      expect(loaded.quizIds.length).toBe(2);
      expect(loaded.idx).toBe(1);
      expect(loaded.correctCount).toBe(1);
    });

    test('clear() 应该清除会话数据', async () => {
      await global.App.db.init();
      
      const state = {
        quiz: [{ id: 'q1' }],
        idx: 0,
        correctCount: 0,
        startTime: Date.now(),
        mode: 'quick'
      };
      
      global.App.session.save(state);
      global.App.session.clear();
      
      const loaded = global.App.session.load();
      expect(loaded).toBeNull();
    });
  });

  describe('每日目标', () => {
    test('getDailyGoal() 应该返回默认值', async () => {
      await global.App.db.init();
      const goal = global.App.db.getDailyGoal();
      expect(goal).toBe(20);
    });

    test('setDailyGoal() 应该在范围内设置目标', async () => {
      await global.App.db.init();
      
      // 正常范围
      global.App.db.setDailyGoal(50);
      expect(global.App.db.getDailyGoal()).toBe(50);
      
      // 最小边界
      global.App.db.setDailyGoal(3);
      expect(global.App.db.getDailyGoal()).toBe(5);
      
      // 最大边界
      global.App.db.setDailyGoal(150);
      expect(global.App.db.getDailyGoal()).toBe(100);
    });
  });

  describe('错题到期检查 (getDueWrong)', () => {
    test('应该正确返回到期错题', async () => {
      await global.App.db.init();
      global.App.QUESTION_BANK = [
        { id: 'q6', category: '测试', question: '测试', options: [], answer: 'A' }
      ];
      
      // 添加错题（立即可复习）
      global.App.db.addWrong('q6');
      
      const due = global.App.db.getDueWrong();
      expect(due.length).toBe(1);
      expect(due[0].qid).toBe('q6');
    });
  });

  describe('题库存储 (App.store)', () => {
    test('init() 应该正确执行（即使没有默认题库）', async () => {
      // store.init() 应该成功执行，即使没有默认题库数据
      const result = await global.App.store.init();
      expect(result).toBeUndefined(); // 返回 Promise<void>
    });

    test('reset() 应该处理未初始化的情况', async () => {
      // 如果没有 DEFAULT_QUESTION_BANK，reset() 会报错
      // 先设置一个默认题库
      global.App.QUESTION_BANK = [
        { id: 'default-q1', category: '测试', question: '测试', options: [], answer: 'A' }
      ];
      global.App.DEFAULT_QUESTION_BANK = global.App.QUESTION_BANK.slice();
      
      // 修改题库
      global.App.QUESTION_BANK = [];
      
      // 重置
      await global.App.store.reset();
      
      expect(global.App.QUESTION_BANK.length).toBe(1);
    });
  });

  describe('XSS 转义工具', () => {
    test('应该正确处理 null 和 undefined', async () => {
      await global.App.db.init();
      
      expect(global.App.esc(null)).toBe('');
      expect(global.App.esc(undefined)).toBe('');
    });

    test('应该正确处理正常字符串', async () => {
      await global.App.db.init();
      
      expect(global.App.esc('正常文本')).toBe('正常文本');
      expect(global.App.esc(123)).toBe('123');
    });
  });
});