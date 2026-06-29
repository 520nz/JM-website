import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DB,
  initQuestionBank,
  setQuestionBank,
  parseOptions,
  saveQuestion,
  deleteQuestion,
  importData,
  exportData,
  calculateStats,
  getTodayStats,
  resetQuestionBank,
  shuffle
} from '../src/core.js';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString(); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock
});

// 测试题库
const testBank = [
  {
    id: '001',
    category: '专辑',
    question: '林俊杰首张专辑《乐行者》发行于哪一天?',
    options: [
      { key: 'A', text: '2003年4月1日' },
      { key: 'B', text: '2003年4月10日' },
      { key: 'C', text: '2003年5月1日' },
      { key: 'D', text: '2003年5月10日' }
    ],
    answer: 'B',
    explanation: '《乐行者》于2003年4月10日正式发行'
  },
  {
    id: '002',
    category: '歌曲',
    question: '《江南》的作词人是谁?',
    options: [
      { key: 'A', text: '林俊杰' },
      { key: 'B', text: '张思尔' },
      { key: 'C', text: '李瑞洵' },
      { key: 'D', text: '方文山' }
    ],
    answer: 'C',
    explanation: '《江南》由李瑞洵作词'
  }
];

describe('数据导入功能测试', () => {
  beforeEach(() => {
    localStorage.clear();
    initQuestionBank(testBank);
  });

  describe('JSON解析和数据验证', () => {
    it('应正确导入包含题库和用户数据的完整备份', () => {
      const importDataObj = {
        questionBank: [
          {
            id: '003',
            category: '个人信息',
            question: '林俊杰的出生日期?',
            options: [
              { key: 'A', text: '1981年3月27日' },
              { key: 'B', text: '1982年3月27日' }
            ],
            answer: 'A',
            explanation: '出生于1981年'
          }
        ],
        userData: {
          history: [{ qid: '001', ans: 'B', ok: true, time: Date.now() }],
          wrong: [{ qid: '002', cnt: 2, time: Date.now() }],
          stats: { total: 5, correct: 3, cats: { '专辑': { t: 3, c: 2 } } }
        },
        exportTime: new Date().toISOString()
      };

      const result = importData(importDataObj);
      
      expect(result.addedCount).toBe(1);
      expect(result.updatedCount).toBe(0);
      expect(result.totalQuestions).toBe(3);
    });

    it('应正确处理题库数据更新', () => {
      const importDataObj = {
        questionBank: [
          {
            id: '001', // 已存在的ID
            category: '专辑',
            question: '更新后的题目',
            options: [
              { key: 'A', text: '新选项A' },
              { key: 'B', text: '新选项B' }
            ],
            answer: 'A',
            explanation: '更新说明'
          }
        ]
      };

      const result = importData(importDataObj);
      
      expect(result.addedCount).toBe(0);
      expect(result.updatedCount).toBe(1);
      
      const bank = DB.findQ('001');
      expect(bank.question).toBe('更新后的题目');
    });

    it('应拒绝空数据对象', () => {
      expect(() => importData(null)).toThrow('导入失败:数据格式不正确');
      expect(() => importData({})).toThrow('导入失败:文件中未找到有效数据');
    });

    it('应跳过不完整的题目数据', () => {
      const importDataObj = {
        questionBank: [
          { id: '003', question: '只有题目没有选项' }, // 不完整
          { id: '004', question: '完整题目', options: [{ key: 'A', text: '选项A' }], answer: 'A', explanation: '' } // 完整
        ]
      };

      const result = importData(importDataObj);
      
      expect(result.addedCount).toBe(1); // 只导入完整的一条
    });

    it('应正确合并历史记录', () => {
      // 先添加一条历史记录
      DB.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
      
      const importDataObj = {
        userData: {
          history: [
            { qid: '002', ans: 'A', ok: false, time: Date.now() - 1000 },
            { qid: '001', ans: 'C', ok: false, time: Date.now() - 500 }
          ]
        }
      };

      importData(importDataObj);
      
      const data = DB.get();
      expect(data.history.length).toBe(3); // 原有1条+新增2条
    });

    it('应正确合并错题记录', () => {
      // 先添加错题
      DB.addWrong('001');
      DB.addWrong('001'); // 再错一次
      
      const importDataObj = {
        userData: {
          wrong: [
            { qid: '001', cnt: 3, time: Date.now() }, // 已存在的错题,计数累加
            { qid: '002', cnt: 2, time: Date.now() }  // 新错题
          ]
        }
      };

      importData(importDataObj);
      
      const data = DB.get();
      const wrong001 = data.wrong.find(w => w.qid === '001');
      const wrong002 = data.wrong.find(w => w.qid === '002');
      
      expect(wrong001.cnt).toBe(5); // 原有2 + 导入3
      expect(wrong002.cnt).toBe(2);
    });

    it('应正确合并统计数据', () => {
      DB.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
      
      const importDataObj = {
        userData: {
          stats: {
            total: 10,
            correct: 7,
            cats: {
              '专辑': { t: 5, c: 3 },
              '歌曲': { t: 5, c: 4 }
            }
          }
        }
      };

      importData(importDataObj);
      
      const stats = calculateStats();
      expect(stats.total).toBe(11); // 原有1 + 导入10
      expect(stats.correct).toBe(8); // 原有1 + 导入7
      expect(stats.cats['专辑'].t).toBe(6); // 原有1 + 导入5
    });

    it('应跳过无效的错题记录', () => {
      const importDataObj = {
        userData: {
          wrong: [
            { qid: '001', cnt: 2, time: Date.now() }, // 有效
            { qid: undefined, cnt: 2 }, // 无效
            { cnt: 3 } // 无效,缺少qid
          ]
        }
      };

      importData(importDataObj);
      
      const data = DB.get();
      expect(data.wrong.length).toBe(1); // 只导入有效的一条
    });
  });
});

describe('题目编辑保存功能测试', () => {
  beforeEach(() => {
    localStorage.clear();
    initQuestionBank(testBank);
  });

  describe('选项格式解析', () => {
    it('应正确解析标准格式选项', () => {
      const optsText = 'A.选项一\nB.选项二\nC.选项三\nD.选项四';
      const options = parseOptions(optsText);
      
      expect(options.length).toBe(4);
      expect(options[0]).toEqual({ key: 'A', text: '选项一' });
      expect(options[3]).toEqual({ key: 'D', text: '选项四' });
    });

    it('应支持中文分隔符', () => {
      const optsText = 'A、选项一\nB、选项二';
      const options = parseOptions(optsText);
      
      expect(options.length).toBe(2);
      expect(options[0].text).toBe('选项一');
    });

    it('应支持全角点号', () => {
      const optsText = 'A．选项一\nB．选项二';
      const options = parseOptions(optsText);
      
      expect(options.length).toBe(2);
    });

    it('应忽略空行和无效格式', () => {
      const optsText = 'A.选项一\n\n无效行\nB.选项二\nC';
      const options = parseOptions(optsText);
      
      expect(options.length).toBe(2); // 只解析有效格式
    });

    it('应正确处理选项前后的空格', () => {
      const optsText = 'A.   前面有空格  \nB.后面有空格   ';
      const options = parseOptions(optsText);
      
      expect(options[0].text).toBe('前面有空格');
      expect(options[1].text).toBe('后面有空格');
    });
  });

  describe('题目保存验证', () => {
    it('应拒绝空题目', () => {
      expect(() => saveQuestion('', '专辑', '', 'A.选项', 'A', ''))
        .toThrow('请填写题目和选项');
    });

    it('应拒绝空选项', () => {
      expect(() => saveQuestion('', '专辑', '题目', '', 'A', ''))
        .toThrow('请填写题目和选项');
    });

    it('应拒绝少于两个选项', () => {
      expect(() => saveQuestion('', '专辑', '题目', 'A.只有一个选项', 'A', ''))
        .toThrow('请至少输入两个选项');
    });

    it('应成功新增题目', () => {
      const result = saveQuestion(
        '',
        '专辑',
        '新题目',
        'A.选项一\nB.选项二\nC.选项三',
        'A',
        '这是解析'
      );
      
      expect(result.action).toBe('add');
      expect(result.id).toMatch(/^q\d+$/);
      
      const bank = DB.findQ(result.id);
      expect(bank).toBeDefined();
      expect(bank.question).toBe('新题目');
      expect(bank.options.length).toBe(3);
    });

    it('应成功更新现有题目', () => {
      const result = saveQuestion(
        '001',
        '专辑',
        '修改后的题目',
        'A.新选项A\nB.新选项B',
        'A',
        '修改后的解析'
      );
      
      expect(result.action).toBe('update');
      expect(result.id).toBe('001');
      
      const bank = DB.findQ('001');
      expect(bank.question).toBe('修改后的题目');
      expect(bank.answer).toBe('A');
    });

    it('应正确处理不存在的ID更新', () => {
      const result = saveQuestion(
        'nonexistent',
        '专辑',
        '题目',
        'A.选项A\nB.选项B',
        'A',
        '解析'
      );
      
      expect(result.action).toBe('not_found');
    });
  });

  describe('题目删除功能', () => {
    it('应成功删除题目', () => {
      deleteQuestion('001');
      
      const bank = DB.findQ('001');
      expect(bank).toBeNull();
    });

    it('删除不存在的题目应无副作用', () => {
      deleteQuestion('nonexistent');
      
      const bankBefore = testBank.slice();
      initQuestionBank(bankBefore);
      
      expect(DB.findQ('001')).toBeDefined(); // 其他题目应保持不变
    });
  });
});

describe('统计计算功能测试', () => {
  beforeEach(() => {
    localStorage.clear();
    initQuestionBank(testBank);
  });

  it('应正确计算总体统计', () => {
    // 添加答题记录并手动添加错题(模拟答题流程)
    DB.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
    DB.addRecord({ qid: '002', ans: 'C', ok: true, time: Date.now() });
    DB.addRecord({ qid: '001', ans: 'A', ok: false, time: Date.now() });
    DB.addWrong('001'); // 答错时自动添加到错题本
    
    const stats = calculateStats();
    
    expect(stats.total).toBe(3);
    expect(stats.correct).toBe(2);
    expect(stats.accuracy).toBe(67); // 2/3 = 66.67%, round to 67
    expect(stats.wrong).toBe(1); // 错题本中有1个错题记录
  });

  it('应正确计算分类统计', () => {
    DB.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() }); // 专辑分类
    DB.addRecord({ qid: '001', ans: 'A', ok: false, time: Date.now() }); // 专辑分类
    DB.addRecord({ qid: '002', ans: 'C', ok: true, time: Date.now() }); // 歌曲分类
    
    const stats = calculateStats();
    
    expect(stats.cats['专辑']).toEqual({ t: 2, c: 1 });
    expect(stats.cats['歌曲']).toEqual({ t: 1, c: 1 });
  });

  it('应正确处理无数据情况', () => {
    const stats = calculateStats();
    
    expect(stats.total).toBe(0);
    expect(stats.correct).toBe(0);
    expect(stats.accuracy).toBe(0);
    expect(stats.wrong).toBe(0);
  });

  it('应正确计算今日统计', () => {
    const today = new Date().setHours(0, 0, 0, 0);
    
    // 今日答题
    DB.addRecord({ qid: '001', ans: 'B', ok: true, time: today + 1000 });
    DB.addRecord({ qid: '002', ans: 'C', ok: true, time: today + 2000 });
    
    // 昨日答题
    const yesterday = today - 24 * 60 * 60 * 1000;
    DB.addRecord({ qid: '001', ans: 'A', ok: false, time: yesterday });
    
    const todayStats = getTodayStats();
    
    expect(todayStats.count).toBe(2);
    expect(todayStats.correct).toBe(2);
    expect(todayStats.accuracy).toBe(100);
  });
});

describe('错题本功能测试', () => {
  beforeEach(() => {
    localStorage.clear();
    initQuestionBank(testBank);
  });

  it('应正确添加错题记录', () => {
    DB.addWrong('001');
    
    const wrong = DB.getWrong();
    expect(wrong.length).toBe(1);
    expect(wrong[0]).toEqual({ qid: '001', cnt: 1, time: expect.any(Number) });
  });

  it('应正确累加错题计数', () => {
    DB.addWrong('001');
    DB.addWrong('001');
    DB.addWrong('001');
    
    const wrong = DB.getWrong();
    expect(wrong.length).toBe(1);
    expect(wrong[0].cnt).toBe(3);
  });

  it('应正确移除错题记录', () => {
    DB.addWrong('001');
    DB.addWrong('002');
    
    DB.removeWrong('001');
    
    const wrong = DB.getWrong();
    expect(wrong.length).toBe(1);
    expect(wrong[0].qid).toBe('002');
  });

  it('应正确处理重复答错同一题', () => {
    DB.addRecord({ qid: '001', ans: 'A', ok: false, time: Date.now() });
    DB.addWrong('001'); // 第一次答错
    DB.addRecord({ qid: '001', ans: 'C', ok: false, time: Date.now() });
    DB.addWrong('001'); // 第二次答错
    
    const wrong = DB.getWrong();
    expect(wrong.length).toBe(1);
    expect(wrong[0].cnt).toBe(2);
  });

  it('答对后应不影响错题记录', () => {
    DB.addWrong('001');
    DB.addWrong('001');
    
    DB.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
    
    const wrong = DB.getWrong();
    expect(wrong[0].cnt).toBe(2); // 错题记录不会自动清除
  });
});

describe('数据导出功能测试', () => {
  beforeEach(() => {
    localStorage.clear();
    initQuestionBank(testBank);
  });

  it('应正确导出完整数据', () => {
    DB.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
    DB.addWrong('002');
    
    const exported = exportData();
    
    expect(exported.questionBank).toBeDefined();
    expect(exported.questionBank.length).toBe(2);
    expect(exported.userData).toBeDefined();
    expect(exported.userData.history.length).toBe(1);
    expect(exported.userData.wrong.length).toBe(1);
    expect(exported.exportTime).toBeDefined();
  });
});

describe('恢复默认题库功能测试', () => {
  beforeEach(() => {
    localStorage.clear();
    initQuestionBank(testBank);
  });

  it('应成功恢复默认题库', () => {
    // 先修改题库
    saveQuestion('', '专辑', '新增题目', 'A.选项A\nB.选项B', 'A', '解析');
    
    const count = resetQuestionBank();
    
    expect(count).toBe(2); // 恢复到原始题库大小
    expect(DB.findQ('001')).toBeDefined();
    expect(DB.findQ('002')).toBeDefined();
  });
});

describe('shuffle工具函数测试', () => {
  it('应保持数组元素不变', () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffle(arr);
    
    expect(shuffled.length).toBe(5);
    expect(shuffled.sort()).toEqual(arr.sort());
  });

  it('应返回新数组', () => {
    const arr = [1, 2, 3];
    const shuffled = shuffle(arr);
    
    expect(shuffled).not.toBe(arr);
  });

  it('应处理空数组', () => {
    const shuffled = shuffle([]);
    expect(shuffled.length).toBe(0);
  });

  it('应处理单元素数组', () => {
    const shuffled = shuffle([1]);
    expect(shuffled).toEqual([1]);
  });
});

describe('边界条件测试', () => {
  beforeEach(() => {
    localStorage.clear();
    initQuestionBank(testBank);
  });

  it('应处理localStorage损坏数据', () => {
    localStorage.setItem(DB.KEY, 'invalid json');
    
    const data = DB.get();
    expect(data).toEqual(DB.defaults()); // 应返回默认数据
  });

  it('应处理大量历史记录合并', () => {
    // 添加100条历史记录
    for (let i = 0; i < 100; i++) {
      DB.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() + i });
    }
    
    const importDataObj = {
      userData: {
        history: Array(50).fill({ qid: '002', ans: 'C', ok: true, time: Date.now() })
      }
    };
    
    importData(importDataObj);
    
    const data = DB.get();
    expect(data.history.length).toBe(150);
  });

  it('应处理极端统计数据', () => {
    const importDataObj = {
      userData: {
        stats: {
          total: 10000,
          correct: 9999,
          cats: {}
        }
      }
    };
    
    importData(importDataObj);
    
    const stats = calculateStats();
    expect(stats.total).toBe(10000);
    expect(stats.accuracy).toBe(100);
  });
});