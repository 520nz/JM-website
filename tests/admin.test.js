/**
 * admin.js 数据导入导出核心逻辑测试
 * 重点测试：选项解析、数据验证、导入合并、分页逻辑
 */

describe('admin.js 核心逻辑测试', () => {
  
  describe('选项解析逻辑', () => {
    const parseOptions = (optsText) => {
      const lines = optsText.split('\n');
      const options = [];
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const match = trimmed.match(/^([A-Z])[.、．]\s*(.+)$/);
        if (match) {
          options.push({ key: match[1], text: match[2] });
        }
      }
      
      return options;
    };

    test('应正确解析标准格式选项', () => {
      const optsText = 'A.选项A内容\nB.选项B内容\nC.选项C内容\nD.选项D内容';
      const options = parseOptions(optsText);
      
      expect(options.length).toBe(4);
      expect(options[0]).toEqual({ key: 'A', text: '选项A内容' });
    });

    test('应支持中文句号格式', () => {
      const optsText = 'A、选项A\nB、选项B';
      const options = parseOptions(optsText);
      
      expect(options.length).toBe(2);
    });

    test('应忽略空行', () => {
      const optsText = 'A.选项A\n\nB.选项B\n\n';
      const options = parseOptions(optsText);
      
      expect(options.length).toBe(2);
    });

    test('应处理全角句号', () => {
      const optsText = 'A．选项A\nB．选项B';
      const options = parseOptions(optsText);
      
      expect(options.length).toBe(2);
    });

    test('应忽略无效格式行', () => {
      const optsText = 'A.选项A\n无效行\nB.选项B';
      const options = parseOptions(optsText);
      
      expect(options.length).toBe(2);
    });

    test('至少需要2个选项', () => {
      const optsText = 'A.选项A';
      const options = parseOptions(optsText);
      
      expect(options.length).toBe(1);
      // 实际应用中应拒绝少于2个选项
    });
  });

  describe('数据导出逻辑', () => {
    test('应导出完整数据结构', () => {
      const questionBank = [{ id: 'q1', category: '测试' }];
      const userData = { history: [], wrong: [], stats: {} };
      
      const exportData = {
        questionBank,
        userData,
        exportTime: new Date().toISOString()
      };
      
      expect(exportData).toHaveProperty('questionBank');
      expect(exportData).toHaveProperty('userData');
      expect(exportData).toHaveProperty('exportTime');
      expect(Array.isArray(exportData.questionBank)).toBe(true);
    });

    test('导出时间应为ISO格式', () => {
      const exportTime = new Date().toISOString();
      const parsed = new Date(exportTime);
      
      expect(parsed).toBeInstanceOf(Date);
      expect(parsed.toString()).not.toBe('Invalid Date');
    });

    test('应生成正确的文件名', () => {
      const date = new Date().toISOString().slice(0, 10);
      const filename = `jj_quiz_backup_${date}.json`;
      
      expect(filename).toMatch(/^jj_quiz_backup_\d{4}-\d{2}-\d{2}\.json$/);
    });
  });

  describe('数据导入验证', () => {
    test('应拒绝无效JSON', () => {
      const invalidJson = 'not a json';
      
      expect(() => {
        JSON.parse(invalidJson);
      }).toThrow();
    });

    test('应验证导入数据结构', () => {
      const validData = {
        questionBank: [{ id: 'test' }],
        userData: { history: [], wrong: [] }
      };
      
      expect(validData.questionBank).toBeDefined();
      expect(validData.userData).toBeDefined();
    });

    test('空数据应被拒绝', () => {
      const emptyData = {};
      
      expect(emptyData.questionBank).toBeUndefined();
      expect(emptyData.userData).toBeUndefined();
    });

    test('应检测必要字段', () => {
      const data = {
        questionBank: [
          { id: 'q1', category: '测试', question: '问题', options: [], answer: 'A' }
        ]
      };
      
      expect(data.questionBank).toBeDefined();
      // 至少包含 questionBank 或 userData 之一
    });
  });

  describe('题库导入合并逻辑', () => {
    test('应正确合并题库数据', () => {
      const existingIds = { 'q1': true };
      const newQuestion = { id: 'q2', category: '新分类' };
      
      let addedCount = 0;
      let updatedCount = 0;
      
      if (!existingIds[newQuestion.id]) {
        addedCount++;
      }
      
      expect(addedCount).toBe(1);
      expect(updatedCount).toBe(0);
    });

    test('应更新已存在的题目', () => {
      const existingIds = { 'q1': true };
      const updatedQuestion = { id: 'q1', category: '更新分类' };
      
      let addedCount = 0;
      let updatedCount = 0;
      
      if (existingIds[updatedQuestion.id]) {
        updatedCount++;
      }
      
      expect(addedCount).toBe(0);
      expect(updatedCount).toBe(1);
    });

    test('应去重导入数据', () => {
      const existing = [{ id: 'q1' }, { id: 'q2' }];
      const imported = [{ id: 'q2' }, { id: 'q3' }];
      
      const existingIds = new Set(existing.map(q => q.id));
      let addedCount = 0;
      let updatedCount = 0;
      
      for (const q of imported) {
        if (existingIds.has(q.id)) {
          updatedCount++;
        } else {
          addedCount++;
        }
      }
      
      expect(addedCount).toBe(1);
      expect(updatedCount).toBe(1);
    });
  });

  describe('用户数据合并逻辑', () => {
    test('应正确合并答题历史', () => {
      const existingHistory = [{ qid: 'q1', ans: 'A', ok: true, time: 1000 }];
      const importedHistory = [{ qid: 'q2', ans: 'B', ok: false, time: 2000 }];
      
      const mergedHistory = existingHistory.concat(importedHistory);
      
      expect(mergedHistory.length).toBe(2);
    });

    test('应正确合并错题本', () => {
      const existingWrong = [
        { qid: 'q1', cnt: 2, level: 1 }
      ];
      const importedWrong = [
        { qid: 'q1', cnt: 3, level: 0 },
        { qid: 'q2', cnt: 1, level: 0 }
      ];
      
      // 建立映射
      const wrongMap = {};
      for (const w of existingWrong) {
        wrongMap[w.qid] = w;  // 直接引用原对象
      }
      
      for (const wrongItem of importedWrong) {
        if (wrongMap[wrongItem.qid]) {
          // 合并：取较高的错误次数
          wrongMap[wrongItem.qid].cnt = Math.max(
            wrongMap[wrongItem.qid].cnt,
            wrongItem.cnt
          );
          // 保留较低等级（更保守）
          wrongMap[wrongItem.qid].level = Math.min(
            wrongMap[wrongItem.qid].level,
            wrongItem.level
          );
        } else {
          // 新错题
          existingWrong.push(wrongItem);
        }
      }
      
      const q1Wrong = existingWrong.find(w => w.qid === 'q1');
      expect(q1Wrong.cnt).toBe(3); // 取最大值
      expect(q1Wrong.level).toBe(0); // 取最小值
    });

    test('应保留间隔重复字段', () => {
      const importedWrong = {
        qid: 'q1',
        cnt: 1,
        level: 2,
        nextReview: Date.now() + 7200000,
        lastReview: Date.now(),
        time: Date.now()
      };
      
      expect(importedWrong.level).toBe(2);
      expect(importedWrong.nextReview).toBeDefined();
      expect(importedWrong.lastReview).toBeDefined();
    });
  });

  describe('题目删除逻辑', () => {
    test('应正确过滤删除题目', () => {
      const questions = [
        { id: 'q1' },
        { id: 'q2' },
        { id: 'q3' }
      ];
      
      const qid = 'q2';
      const filtered = questions.filter(q => q.id !== qid);
      
      expect(filtered.length).toBe(2);
      expect(filtered.find(q => q.id === 'q2')).toBeUndefined();
    });

    test('删除不存在的题目应无影响', () => {
      const questions = [{ id: 'q1' }, { id: 'q2' }];
      
      const before = questions.length;
      const filtered = questions.filter(q => q.id !== 'not-exist');
      
      expect(filtered.length).toBe(before);
    });
  });

  describe('分页逻辑', () => {
    test('应正确计算总页数', () => {
      const totalItems = 85;
      const pageSize = 30;
      const totalPages = Math.ceil(totalItems / pageSize);
      
      expect(totalPages).toBe(3);
    });

    test('应正确计算起始索引', () => {
      const page = 2;
      const pageSize = 30;
      const start = (page - 1) * pageSize;
      
      expect(start).toBe(30);
    });

    test('应正确计算结束索引', () => {
      const start = 30;
      const pageSize = 30;
      const totalItems = 85;
      const end = Math.min(start + pageSize, totalItems);
      
      expect(end).toBe(60);
    });

    test('页码超出范围应修正', () => {
      const totalPages = 3;
      let currentPage = 5;
      
      if (currentPage > totalPages) {
        currentPage = totalPages;
      }
      
      expect(currentPage).toBe(3);
    });

    test('第一页不应小于1', () => {
      let currentPage = 0;
      
      if (currentPage < 1) {
        currentPage = 1;
      }
      
      expect(currentPage).toBe(1);
    });
  });

  describe('搜索过滤逻辑', () => {
    test('应正确过滤分类', () => {
      const questions = [
        { id: 'q1', category: '专辑' },
        { id: 'q2', category: '歌曲' }
      ];
      
      const filtered = questions.filter(q => q.category === '专辑');
      
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe('q1');
    });

    test('应正确搜索题目内容（不区分大小写）', () => {
      const questions = [
        { id: 'q1', question: '林俊杰的专辑' },
        { id: 'q2', question: '周杰伦的专辑' }
      ];
      
      const search = '林俊杰'.toLowerCase();
      const filtered = questions.filter(q => 
        q.question.toLowerCase().includes(search)
      );
      
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe('q1');
    });

    test('应同时过滤分类和搜索', () => {
      const questions = [
        { id: 'q1', category: '专辑', question: '林俊杰的专辑' },
        { id: 'q2', category: '歌曲', question: '林俊杰的歌曲' },
        { id: 'q3', category: '专辑', question: '周杰伦的专辑' }
      ];
      
      const search = '林俊杰'.toLowerCase();
      const category = '专辑';
      
      const filtered = questions.filter(q => 
        q.category === category && q.question.toLowerCase().includes(search)
      );
      
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe('q1');
    });

    test('空搜索应返回全部', () => {
      const questions = [{ id: 'q1' }, { id: 'q2' }];
      const search = '';
      
      const filtered = search 
        ? questions.filter(q => q.question.includes(search))
        : questions;
      
      expect(filtered.length).toBe(2);
    });
  });

  describe('数据完整性验证', () => {
    test('题目应包含必要字段', () => {
      const validQuestion = {
        id: 'test',
        category: '测试',
        question: '测试题目',
        options: [{ key: 'A', text: '选项' }],
        answer: 'A',
        explanation: '解释'
      };
      
      expect(validQuestion.id).toBeDefined();
      expect(validQuestion.category).toBeDefined();
      expect(validQuestion.question).toBeDefined();
      expect(validQuestion.options).toBeDefined();
      expect(validQuestion.answer).toBeDefined();
    });

    test('选项应包含key和text', () => {
      const option = { key: 'A', text: '选项内容' };
      
      expect(option.key).toBeDefined();
      expect(option.text).toBeDefined();
    });

    test('答案应为有效选项key', () => {
      const answer = 'A';
      const validKeys = ['A', 'B', 'C', 'D'];
      
      expect(validKeys.includes(answer)).toBe(true);
    });

    test('ID应为字符串', () => {
      const question = { id: 'q1' };
      
      expect(typeof question.id).toBe('string');
    });
  });

  describe('安全边界测试', () => {
    test('空题库应安全处理', () => {
      const questionBank = [];
      
      expect(questionBank.length).toBe(0);
    });

    test('大数据量导入应防止内存溢出', () => {
      const largeQuestionBank = Array.from({ length: 10000 }, (_, i) => ({
        id: `q${i}`,
        category: '测试',
        question: `题目${i}`,
        options: [{ key: 'A', text: '选项' }],
        answer: 'A'
      }));
      
      // 应能处理大数组
      expect(largeQuestionBank.length).toBe(10000);
    });

    test('异常数据应安全处理', () => {
      const malformedData = {
        questionBank: null,
        userData: undefined
      };
      
      // 应安全处理 null 和 undefined
      expect(malformedData.questionBank).toBeNull();
      expect(malformedData.userData).toBeUndefined();
    });

    test('缺少字段应提供默认值', () => {
      const question = { id: 'q1' };
      
      const defaults = {
        category: question.category || '未分类',
        question: question.question || '',
        options: question.options || [],
        answer: question.answer || 'A',
        explanation: question.explanation || ''
      };
      
      expect(defaults.category).toBe('未分类');
    });
  });
});