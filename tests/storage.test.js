/**
 * LocalStorage操作测试
 * 测试数据持久化、读写操作等核心功能
 */

const {
  getDefaultData,
  getUserData,
  saveUserData,
  addRecord,
  addWrong,
  removeWrong,
  getWrongList,
  saveQuestionBankToStorage,
  loadQuestionBankFromStorage,
  clearQuestionBankStorage,
  getTodayHistory,
  getTodayStats,
  getTotalStats,
  getCategoryStats
} = require('../src/storage');

// 模拟题库
const mockQuestionBank = [
  { id: '001', category: '专辑', question: '题目1', options: [{ key: 'A', text: 'A' }], answer: 'A', explanation: '' },
  { id: '002', category: '歌曲', question: '题目2', options: [{ key: 'A', text: 'A' }], answer: 'A', explanation: '' }
];

describe('LocalStorage操作测试', () => {
  
  beforeEach(() => {
    // 清空localStorage
    localStorage.clear();
  });
  
  describe('getDefaultData - 默认数据结构测试', () => {
    
    test('应该返回正确的默认数据结构', () => {
      const data = getDefaultData();
      expect(data).toHaveProperty('history');
      expect(data).toHaveProperty('wrong');
      expect(data).toHaveProperty('stats');
      expect(data.history).toEqual([]);
      expect(data.wrong).toEqual([]);
      expect(data.stats).toHaveProperty('total', 0);
      expect(data.stats).toHaveProperty('correct', 0);
      expect(data.stats).toHaveProperty('cats');
    });
    
    test('每次调用应该返回新的数据对象', () => {
      const data1 = getDefaultData();
      const data2 = getDefaultData();
      expect(data1).not.toBe(data2); // 不是同一个引用
      expect(data1).toEqual(data2); // 但内容相同
    });
  });
  
  describe('getUserData - 获取用户数据测试', () => {
    
    test('应该返回默认数据当localStorage为空', () => {
      const data = getUserData();
      expect(data).toEqual(getDefaultData());
    });
    
    test('应该返回已保存的数据', () => {
      const savedData = {
        history: [{ qid: '001', ans: 'A', ok: true, time: 1000 }],
        wrong: [{ qid: '002', cnt: 1, time: 2000 }],
        stats: { total: 1, correct: 1, cats: {} }
      };
      localStorage.setItem('jj_quiz_v2', JSON.stringify(savedData));
      
      const data = getUserData();
      expect(data.history).toHaveLength(1);
      expect(data.wrong).toHaveLength(1);
      expect(data.stats.total).toBe(1);
    });
    
    test('应该正确解析JSON数据', () => {
      const savedData = { history: [], wrong: [], stats: { total: 10, correct: 8, cats: { '专辑': { t: 5, c: 4 } } } };
      localStorage.setItem('jj_quiz_v2', JSON.stringify(savedData));
      
      const data = getUserData();
      expect(data.stats.cats['专辑'].t).toBe(5);
    });
    
    test('应该处理localStorage中的无效JSON', () => {
      localStorage.setItem('jj_quiz_v2', 'invalid json');
      const data = getUserData();
      // 无效JSON应该返回默认数据
      expect(data).toEqual(getDefaultData());
    });
  });
  
  describe('saveUserData - 保存用户数据测试', () => {
    
    test('应该正确保存数据到localStorage', () => {
      const data = {
        history: [{ qid: '001', ans: 'A', ok: true, time: 1000 }],
        wrong: [],
        stats: { total: 1, correct: 1, cats: {} }
      };
      saveUserData(data);
      
      const saved = JSON.parse(localStorage.getItem('jj_quiz_v2'));
      expect(saved.history).toHaveLength(1);
      expect(saved.stats.total).toBe(1);
    });
    
    test('应该覆盖已存在的数据', () => {
      // 先保存旧数据
      localStorage.setItem('jj_quiz_v2', JSON.stringify({
        history: [{ qid: '001', ans: 'A', ok: true, time: 1000 }],
        stats: { total: 1, correct: 1, cats: {} }
      }));
      
      // 保存新数据
      const newData = {
        history: [{ qid: '002', ans: 'B', ok: false, time: 2000 }],
        wrong: [],
        stats: { total: 1, correct: 0, cats: {} }
      };
      saveUserData(newData);
      
      const saved = JSON.parse(localStorage.getItem('jj_quiz_v2'));
      expect(saved.history[0].qid).toBe('002');
    });
    
    test('应该正确序列化复杂对象', () => {
      const data = {
        history: [],
        wrong: [],
        stats: {
          total: 100,
          correct: 80,
          cats: {
            '专辑': { t: 50, c: 40 },
            '歌曲': { t: 30, c: 25 },
            '获奖记录': { t: 20, c: 15 }
          }
        }
      };
      saveUserData(data);
      
      const saved = JSON.parse(localStorage.getItem('jj_quiz_v2'));
      expect(saved.stats.cats['专辑'].t).toBe(50);
      expect(saved.stats.cats['歌曲'].c).toBe(25);
    });
  });
  
  describe('addRecord - 添加答题记录测试', () => {
    
    test('应该正确添加答题记录', () => {
      const record = { qid: '001', ans: 'A', ok: true, time: 1000 };
      addRecord(record, mockQuestionBank);
      
      const data = getUserData();
      expect(data.history).toHaveLength(1);
      expect(data.history[0]).toEqual(record);
    });
    
    test('应该正确更新统计数据', () => {
      const record = { qid: '001', ans: 'A', ok: true, time: 1000 };
      addRecord(record, mockQuestionBank);
      
      const data = getUserData();
      expect(data.stats.total).toBe(1);
      expect(data.stats.correct).toBe(1);
    });
    
    test('应该正确更新错误答案的统计', () => {
      const record = { qid: '001', ans: 'B', ok: false, time: 1000 };
      addRecord(record, mockQuestionBank);
      
      const data = getUserData();
      expect(data.stats.total).toBe(1);
      expect(data.stats.correct).toBe(0);
    });
    
    test('应该正确更新分类统计', () => {
      const record = { qid: '001', ans: 'A', ok: true, time: 1000 };
      addRecord(record, mockQuestionBank);
      
      const data = getUserData();
      expect(data.stats.cats['专辑']).toBeDefined();
      expect(data.stats.cats['专辑'].t).toBe(1);
      expect(data.stats.cats['专辑'].c).toBe(1);
    });
    
    test('应该正确累计多次答题记录', () => {
      addRecord({ qid: '001', ans: 'A', ok: true, time: 1000 }, mockQuestionBank);
      addRecord({ qid: '002', ans: 'A', ok: false, time: 2000 }, mockQuestionBank);
      addRecord({ qid: '001', ans: 'A', ok: true, time: 3000 }, mockQuestionBank);
      
      const data = getUserData();
      expect(data.history).toHaveLength(3);
      expect(data.stats.total).toBe(3);
      expect(data.stats.correct).toBe(2);
      expect(data.stats.cats['专辑'].t).toBe(2);
      expect(data.stats.cats['专辑'].c).toBe(2);
      expect(data.stats.cats['歌曲'].t).toBe(1);
      expect(data.stats.cats['歌曲'].c).toBe(0);
    });
    
    test('应该处理题目不在题库中的情况', () => {
      const record = { qid: '999', ans: 'A', ok: true, time: 1000 };
      addRecord(record, mockQuestionBank);
      
      const data = getUserData();
      expect(data.history).toHaveLength(1);
      expect(data.stats.total).toBe(1);
      expect(data.stats.correct).toBe(1);
      // 分类统计不应该更新
      expect(Object.keys(data.stats.cats)).toHaveLength(0);
    });
  });
  
  describe('addWrong - 添加错题记录测试', () => {
    
    test('应该正确添加新的错题记录', () => {
      addWrong('001');
      
      const wrongList = getWrongList();
      expect(wrongList).toHaveLength(1);
      expect(wrongList[0].qid).toBe('001');
      expect(wrongList[0].cnt).toBe(1);
    });
    
    test('应该正确累计错题次数', () => {
      addWrong('001');
      addWrong('001');
      addWrong('001');
      
      const wrongList = getWrongList();
      expect(wrongList).toHaveLength(1);
      expect(wrongList[0].cnt).toBe(3);
    });
    
    test('应该正确更新错题时间', () => {
      setMockDateNow(1000);
      addWrong('001');
      
      setMockDateNow(2000);
      addWrong('001');
      
      const wrongList = getWrongList();
      expect(wrongList[0].time).toBe(2000);
      
      resetMockDateNow();
    });
    
    test('应该正确添加多个不同的错题', () => {
      addWrong('001');
      addWrong('002');
      addWrong('003');
      
      const wrongList = getWrongList();
      expect(wrongList).toHaveLength(3);
    });
    
    test('应该正确处理错题记录的顺序', () => {
      addWrong('003');
      addWrong('001');
      addWrong('002');
      
      const wrongList = getWrongList();
      expect(wrongList[0].qid).toBe('003');
      expect(wrongList[1].qid).toBe('001');
      expect(wrongList[2].qid).toBe('002');
    });
  });
  
  describe('removeWrong - 移除错题记录测试', () => {
    
    test('应该正确移除错题记录', () => {
      addWrong('001');
      addWrong('002');
      
      removeWrong('001');
      
      const wrongList = getWrongList();
      expect(wrongList).toHaveLength(1);
      expect(wrongList[0].qid).toBe('002');
    });
    
    test('应该处理移除不存在的错题', () => {
      addWrong('001');
      removeWrong('999'); // 不存在的ID
      
      const wrongList = getWrongList();
      expect(wrongList).toHaveLength(1);
    });
    
    test('应该处理空错题列表的移除', () => {
      removeWrong('001');
      
      const wrongList = getWrongList();
      expect(wrongList).toHaveLength(0);
    });
    
    test('应该正确移除所有错题', () => {
      addWrong('001');
      addWrong('002');
      addWrong('003');
      
      removeWrong('001');
      removeWrong('002');
      removeWrong('003');
      
      const wrongList = getWrongList();
      expect(wrongList).toHaveLength(0);
    });
  });
  
  describe('getWrongList - 获取错题列表测试', () => {
    
    test('应该返回空数组当没有错题', () => {
      const wrongList = getWrongList();
      expect(wrongList).toEqual([]);
    });
    
    test('应该返回所有错题记录', () => {
      addWrong('001');
      addWrong('002');
      
      const wrongList = getWrongList();
      expect(wrongList).toHaveLength(2);
    });
    
    test('应该返回错题的完整信息', () => {
      addWrong('001');
      
      const wrongList = getWrongList();
      expect(wrongList[0]).toHaveProperty('qid');
      expect(wrongList[0]).toHaveProperty('cnt');
      expect(wrongList[0]).toHaveProperty('time');
    });
  });
  
  describe('题库存储操作测试', () => {
    
    test('应该正确保存题库到localStorage', () => {
      saveQuestionBankToStorage(mockQuestionBank);
      
      const saved = JSON.parse(localStorage.getItem('jj_question_bank'));
      expect(saved).toHaveLength(2);
    });
    
    test('应该正确从localStorage加载题库', () => {
      saveQuestionBankToStorage(mockQuestionBank);
      
      const loaded = loadQuestionBankFromStorage();
      expect(loaded).toHaveLength(2);
      expect(loaded[0].id).toBe('001');
    });
    
    test('应该返回null当题库不存在', () => {
      const loaded = loadQuestionBankFromStorage();
      expect(loaded).toBeNull();
    });
    
    test('应该返回null当题库JSON无效', () => {
      localStorage.setItem('jj_question_bank', 'invalid json');
      const loaded = loadQuestionBankFromStorage();
      expect(loaded).toBeNull();
    });
    
    test('应该正确清除题库存储', () => {
      saveQuestionBankToStorage(mockQuestionBank);
      clearQuestionBankStorage();
      
      expect(localStorage.getItem('jj_question_bank')).toBeNull();
    });
  });
  
  describe('getTodayHistory - 今日答题记录测试', () => {
    
    test('应该返回空数组当没有今日记录', () => {
      const history = getTodayHistory();
      expect(history).toEqual([]);
    });
    
    test('应该返回今日的答题记录', () => {
      const today = new Date().setHours(0, 0, 0, 0);
      
      // 添加今日记录
      addRecord({ qid: '001', ans: 'A', ok: true, time: today + 1000 }, mockQuestionBank);
      addRecord({ qid: '002', ans: 'A', ok: false, time: today + 2000 }, mockQuestionBank);
      
      const history = getTodayHistory();
      expect(history).toHaveLength(2);
    });
    
    test('应该排除昨日的答题记录', () => {
      const today = new Date().setHours(0, 0, 0, 0);
      const yesterday = today - 24 * 60 * 60 * 1000;
      
      // 添加昨日记录
      saveUserData({
        history: [{ qid: '001', ans: 'A', ok: true, time: yesterday }],
        wrong: [],
        stats: { total: 1, correct: 1, cats: {} }
      });
      
      // 添加今日记录
      addRecord({ qid: '002', ans: 'A', ok: true, time: today + 1000 }, mockQuestionBank);
      
      const history = getTodayHistory();
      expect(history).toHaveLength(1);
      expect(history[0].qid).toBe('002');
    });
  });
  
  describe('getTodayStats - 今日统计测试', () => {
    
    test('应该返回正确的今日统计数据', () => {
      const today = new Date().setHours(0, 0, 0, 0);
      
      addRecord({ qid: '001', ans: 'A', ok: true, time: today + 1000 }, mockQuestionBank);
      addRecord({ qid: '002', ans: 'A', ok: true, time: today + 2000 }, mockQuestionBank);
      addRecord({ qid: '001', ans: 'B', ok: false, time: today + 3000 }, mockQuestionBank);
      
      const stats = getTodayStats();
      expect(stats.count).toBe(3);
      expect(stats.correctCount).toBe(2);
      expect(stats.accuracy).toBe(67); // 2/3 * 100 ≈ 67%
    });
    
    test('应该返回0当没有今日记录', () => {
      const stats = getTodayStats();
      expect(stats.count).toBe(0);
      expect(stats.correctCount).toBe(0);
      expect(stats.accuracy).toBe(0);
    });
    
    test('应该正确计算100%正确率', () => {
      const today = new Date().setHours(0, 0, 0, 0);
      
      addRecord({ qid: '001', ans: 'A', ok: true, time: today + 1000 }, mockQuestionBank);
      addRecord({ qid: '002', ans: 'A', ok: true, time: today + 2000 }, mockQuestionBank);
      
      const stats = getTodayStats();
      expect(stats.accuracy).toBe(100);
    });
    
    test('应该正确计算0%正确率', () => {
      const today = new Date().setHours(0, 0, 0, 0);
      
      addRecord({ qid: '001', ans: 'B', ok: false, time: today + 1000 }, mockQuestionBank);
      addRecord({ qid: '002', ans: 'B', ok: false, time: today + 2000 }, mockQuestionBank);
      
      const stats = getTodayStats();
      expect(stats.accuracy).toBe(0);
    });
  });
  
  describe('getTotalStats - 总体统计测试', () => {
    
    test('应该返回正确的总体统计数据', () => {
      addRecord({ qid: '001', ans: 'A', ok: true, time: 1000 }, mockQuestionBank);
      addRecord({ qid: '002', ans: 'A', ok: false, time: 2000 }, mockQuestionBank);
      addWrong('002');
      
      const stats = getTotalStats();
      expect(stats.total).toBe(2);
      expect(stats.correct).toBe(1);
      expect(stats.wrong).toBe(1);
      expect(stats.accuracy).toBe(50);
    });
    
    test('应该返回0当没有记录', () => {
      const stats = getTotalStats();
      expect(stats.total).toBe(0);
      expect(stats.correct).toBe(0);
      expect(stats.wrong).toBe(0);
      expect(stats.accuracy).toBe(0);
    });
    
    test('应该正确计算大量记录的统计', () => {
      for (let i = 0; i < 100; i++) {
        addRecord({ qid: '001', ans: 'A', ok: i < 80, time: i * 1000 }, mockQuestionBank);
      }
      
      const stats = getTotalStats();
      expect(stats.total).toBe(100);
      expect(stats.correct).toBe(80);
      expect(stats.accuracy).toBe(80);
    });
  });
  
  describe('getCategoryStats - 分类统计测试', () => {
    
    test('应该返回正确的分类统计数据', () => {
      addRecord({ qid: '001', ans: 'A', ok: true, time: 1000 }, mockQuestionBank);
      addRecord({ qid: '001', ans: 'A', ok: false, time: 2000 }, mockQuestionBank);
      addRecord({ qid: '002', ans: 'A', ok: true, time: 3000 }, mockQuestionBank);
      
      const stats = getCategoryStats();
      expect(stats['专辑']).toBeDefined();
      expect(stats['专辑'].t).toBe(2);
      expect(stats['专辑'].c).toBe(1);
      expect(stats['歌曲']).toBeDefined();
      expect(stats['歌曲'].t).toBe(1);
      expect(stats['歌曲'].c).toBe(1);
    });
    
    test('应该返回空对象当没有分类记录', () => {
      const stats = getCategoryStats();
      expect(stats).toEqual({});
    });
    
    test('应该正确处理多个分类', () => {
      const multiBank = [
        { id: '001', category: '专辑', question: 'Q1', options: [{ key: 'A', text: 'A' }], answer: 'A', explanation: '' },
        { id: '002', category: '歌曲', question: 'Q2', options: [{ key: 'A', text: 'A' }], answer: 'A', explanation: '' },
        { id: '003', category: '个人信息', question: 'Q3', options: [{ key: 'A', text: 'A' }], answer: 'A', explanation: '' },
        { id: '004', category: '获奖记录', question: 'Q4', options: [{ key: 'A', text: 'A' }], answer: 'A', explanation: '' }
      ];
      
      addRecord({ qid: '001', ans: 'A', ok: true, time: 1000 }, multiBank);
      addRecord({ qid: '002', ans: 'A', ok: true, time: 2000 }, multiBank);
      addRecord({ qid: '003', ans: 'A', ok: false, time: 3000 }, multiBank);
      addRecord({ qid: '004', ans: 'A', ok: true, time: 4000 }, multiBank);
      
      const stats = getCategoryStats();
      expect(Object.keys(stats)).toHaveLength(4);
    });
  });
  
  describe('边界条件和极端情况测试', () => {
    
    test('应该处理大量历史记录', () => {
      for (let i = 0; i < 1000; i++) {
        addRecord({ qid: '001', ans: 'A', ok: true, time: i }, mockQuestionBank);
      }
      
      const data = getUserData();
      expect(data.history).toHaveLength(1000);
      expect(data.stats.total).toBe(1000);
    });
    
    test('应该处理大量错题记录', () => {
      for (let i = 0; i < 100; i++) {
        addWrong(`q${i}`);
      }
      
      const wrongList = getWrongList();
      expect(wrongList).toHaveLength(100);
    });
    
    test('应该处理超大错题次数', () => {
      for (let i = 0; i < 1000; i++) {
        addWrong('001');
      }
      
      const wrongList = getWrongList();
      expect(wrongList[0].cnt).toBe(1000);
    });
    
    test('应该处理时间戳边界值', () => {
      // 最小时间戳
      addRecord({ qid: '001', ans: 'A', ok: true, time: 0 }, mockQuestionBank);
      
      // 最大合理时间戳（2030年）
      addRecord({ qid: '002', ans: 'A', ok: true, time: 1893456000000 }, mockQuestionBank);
      
      const data = getUserData();
      expect(data.history).toHaveLength(2);
    });
    
    test('应该处理空题库的答题记录', () => {
      const record = { qid: '001', ans: 'A', ok: true, time: 1000 };
      addRecord(record, []);
      
      const data = getUserData();
      expect(data.history).toHaveLength(1);
      expect(data.stats.total).toBe(1);
      // 分类统计不应该更新
      expect(Object.keys(data.stats.cats)).toHaveLength(0);
    });
    
    test('应该处理localStorage存储限制', () => {
      // 模拟大量数据
      const largeData = {
        history: [],
        wrong: [],
        stats: { total: 0, correct: 0, cats: {} }
      };
      
      // 添加大量历史记录
      for (let i = 0; i < 10000; i++) {
        largeData.history.push({
          qid: `q${i}`,
          ans: 'A',
          ok: true,
          time: i
        });
      }
      
      saveUserData(largeData);
      const loaded = getUserData();
      expect(loaded.history).toHaveLength(10000);
    });
    
    test('应该处理并发写入', () => {
      // 模拟连续快速写入
      for (let i = 0; i < 10; i++) {
        addRecord({ qid: '001', ans: 'A', ok: true, time: i }, mockQuestionBank);
        addWrong(`q${i}`);
      }
      
      const data = getUserData();
      expect(data.history).toHaveLength(10);
      expect(data.wrong).toHaveLength(10);
    });
    
    test('应该处理特殊字符在数据中', () => {
      const record = {
        qid: '001',
        ans: 'A',
        ok: true,
        time: 1000,
        special: '<>&"\'\n\t'
      };
      
      saveUserData({
        history: [record],
        wrong: [],
        stats: { total: 1, correct: 1, cats: {} }
      });
      
      const loaded = getUserData();
      expect(loaded.history[0].special).toBe('<>&"\'\n\t');
    });
    
    test('应该处理Unicode字符在数据中', () => {
      const record = {
        qid: '001',
        ans: 'A',
        ok: true,
        time: 1000,
        unicode: '林俊杰💜音乐'
      };
      
      saveUserData({
        history: [record],
        wrong: [],
        stats: { total: 1, correct: 1, cats: {} }
      });
      
      const loaded = getUserData();
      expect(loaded.history[0].unicode).toBe('林俊杰💜音乐');
    });
    
    test('应该处理空分类名称', () => {
      const emptyCategoryBank = [
        { id: '001', category: '', question: 'Q1', options: [{ key: 'A', text: 'A' }], answer: 'A', explanation: '' }
      ];
      
      addRecord({ qid: '001', ans: 'A', ok: true, time: 1000 }, emptyCategoryBank);
      
      const stats = getCategoryStats();
      expect(stats['']).toBeDefined();
    });
    
    test('应该处理分类名称中的特殊字符', () => {
      const specialCategoryBank = [
        { id: '001', category: '专辑<特殊>', question: 'Q1', options: [{ key: 'A', text: 'A' }], answer: 'A', explanation: '' }
      ];
      
      addRecord({ qid: '001', ans: 'A', ok: true, time: 1000 }, specialCategoryBank);
      
      const stats = getCategoryStats();
      expect(stats['专辑<特殊>']).toBeDefined();
    });
  });
});