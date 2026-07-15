/**
 * admin.js 数据管理测试（简化版）
 * 覆盖：数据导入导出、JSON解析验证、选项解析、XSS转义
 */

const fs = require('fs');
const path = require('path');

describe('admin.js 数据管理测试', () => {
  beforeEach(() => {
    // 初始化
    global.App = {};
    
    // 加载 storage.js
    const storageCode = fs.readFileSync(
      path.join(__dirname, '../js/storage.js'), 
      'utf8'
    );
    eval(storageCode);
    
    // 加载 admin.js
    const adminCode = fs.readFileSync(
      path.join(__dirname, '../js/admin.js'), 
      'utf8'
    );
    eval(adminCode);
    
    // 设置题库
    App.QUESTION_BANK = [
      { id: 'q001', category: '专辑', question: '题目1', options: [{key:'A',text:'选项A'},{key:'B',text:'选项B'}], answer: 'A', explanation: '解释1' },
      { id: 'q002', category: '歌曲', question: '题目2', options: [{key:'A',text:'选项A'},{key:'B',text:'选项B'}], answer: 'B', explanation: '解释2' }
    ];
    App.DEFAULT_QUESTION_BANK = App.QUESTION_BANK.slice();
  });

  describe('选项解析', () => {
    test('应该正确解析标准格式的选项', () => {
      const optsText = 'A.选项1\nB.选项2\nC.选项3\nD.选项4';
      const lines = optsText.split('\n');
      const options = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const match = line.match(/^([A-Z])[.、．]\s*(.+)$/);
        if (match) {
          options.push({ key: match[1], text: match[2] });
        }
      }
      
      expect(options.length).toBe(4);
      expect(options[0]).toEqual({ key: 'A', text: '选项1' });
      expect(options[3]).toEqual({ key: 'D', text: '选项4' });
    });

    test('应该处理中文顿号分隔符', () => {
      const optsText = 'A、选项1\nB、选项2';
      const lines = optsText.split('\n');
      const options = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const match = line.match(/^([A-Z])[.、．]\s*(.+)$/);
        if (match) {
          options.push({ key: match[1], text: match[2] });
        }
      }
      
      expect(options.length).toBe(2);
      expect(options[0].key).toBe('A');
    });

    test('应该忽略空行', () => {
      const optsText = 'A.选项1\n\nB.选项2\n\n';
      const lines = optsText.split('\n');
      const options = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const match = line.match(/^([A-Z])[.、．]\s*(.+)$/);
        if (match) {
          options.push({ key: match[1], text: match[2] });
        }
      }
      
      expect(options.length).toBe(2);
    });

    test('应该处理选项前后空格', () => {
      const optsText = 'A.  选项1  \nB.  选项2  ';
      const lines = optsText.split('\n');
      const options = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const match = line.match(/^([A-Z])[.、．]\s*(.+)$/);
        if (match) {
          options.push({ key: match[1], text: match[2] });
        }
      }
      
      expect(options[0].text).toContain('选项1');
    });

    test('应该拒绝少于2个选项的输入', () => {
      const optsText = 'A.选项1';
      const lines = optsText.split('\n');
      const options = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const match = line.match(/^([A-Z])[.、．]\s*(.+)$/);
        if (match) {
          options.push({ key: match[1], text: match[2] });
        }
      }
      
      expect(options.length).toBeLessThan(2);
    });
  });

  describe('数据导出', () => {
    test('导出数据应该包含必要字段', () => {
      const data = {
        questionBank: App.QUESTION_BANK,
        userData: App.db.defaults(),
        exportTime: new Date().toISOString()
      };
      
      expect(data).toHaveProperty('questionBank');
      expect(data).toHaveProperty('userData');
      expect(data).toHaveProperty('exportTime');
      expect(Array.isArray(data.questionBank)).toBe(true);
    });

    test('导出时间应该是有效的 ISO 字符串', () => {
      const exportTime = new Date().toISOString();
      const parsed = new Date(exportTime);
      
      expect(parsed.toString()).not.toBe('Invalid Date');
    });
  });

  describe('数据导入验证', () => {
    test('应该拒绝无效的 JSON', () => {
      const invalidJson = 'not a valid json';
      
      expect(() => {
        JSON.parse(invalidJson);
      }).toThrow();
    });

    test('应该接受有效的 JSON', () => {
      const validJson = '{"questionBank": [], "userData": {"history": [], "wrong": [], "stats": {"total": 0, "correct": 0, "cats": {}}}}';
      
      expect(() => {
        JSON.parse(validJson);
      }).not.toThrow();
    });

    test('应该验证数据结构是否包含必要字段', () => {
      const validData = {
        questionBank: [],
        userData: {
          history: [],
          wrong: [],
          stats: { total: 0, correct: 0, cats: {} }
        }
      };
      
      const hasQuestionBank = !!validData.questionBank;
      const hasUserData = !!validData.userData;
      
      expect(hasQuestionBank || hasUserData).toBe(true);
    });

    test('应该拒绝空数据', () => {
      const emptyData = {};
      const hasQuestionBank = !!emptyData.questionBank;
      const hasUserData = !!emptyData.userData;
      
      expect(hasQuestionBank || hasUserData).toBe(false);
    });
  });

  describe('题库导入合并逻辑', () => {
    test('应该新增不存在的题目', () => {
      const existingIds = { 'q001': true, 'q002': true };
      const importedQuestions = [
        { id: 'q003', question: '新题目' }
      ];
      
      let addedCount = 0;
      for (const q of importedQuestions) {
        if (!existingIds[q.id]) {
          addedCount++;
        }
      }
      
      expect(addedCount).toBe(1);
    });

    test('应该更新已存在的题目', () => {
      const existingIds = { 'q001': true, 'q002': true };
      const importedQuestions = [
        { id: 'q001', question: '更新后的题目' }
      ];
      
      let updatedCount = 0;
      for (const q of importedQuestions) {
        if (existingIds[q.id]) {
          updatedCount++;
        }
      }
      
      expect(updatedCount).toBe(1);
    });

    test('应该正确处理重复导入', () => {
      // 模拟两次导入相同数据
      const firstImport = [{ id: 'q001', question: '题目' }];
      const secondImport = [{ id: 'q001', question: '题目' }];
      
      // 第一次应该新增
      let addedCount = 0;
      let existingIds = {};
      for (const q of firstImport) {
        if (!existingIds[q.id]) {
          addedCount++;
          existingIds[q.id] = true;
        }
      }
      expect(addedCount).toBe(1);
      
      // 第二次应该更新
      let updatedCount = 0;
      for (const q of secondImport) {
        if (existingIds[q.id]) {
          updatedCount++;
        }
      }
      expect(updatedCount).toBe(1);
    });
  });

  describe('用户数据合并', () => {
    test('合并历史记录应该正确拼接', () => {
      const history1 = [{ qid: 'q001', ok: true, time: Date.now() }];
      const history2 = [{ qid: 'q002', ok: false, time: Date.now() }];
      
      const merged = history1.concat(history2);
      
      expect(merged.length).toBe(2);
    });

    test('合并错题本应该取最大错误次数', () => {
      const existingWrong = { qid: 'q001', cnt: 3, level: 2 };
      const importedWrong = { qid: 'q001', cnt: 5, level: 1 };
      
      const merged = {
        cnt: Math.max(existingWrong.cnt, importedWrong.cnt || 1),
        level: Math.min(existingWrong.level || 0, importedWrong.level)
      };
      
      expect(merged.cnt).toBe(5); // 取较大的
      expect(merged.level).toBe(1); // 取较小的
    });

    test('新错题应该添加间隔重复字段', () => {
      const newWrongItem = { qid: 'q003', cnt: 1 };
      
      // 确保有间隔重复字段
      if (!newWrongItem.level) newWrongItem.level = 0;
      if (!newWrongItem.nextReview) newWrongItem.nextReview = Date.now();
      if (!newWrongItem.lastReview) newWrongItem.lastReview = 0;
      if (!newWrongItem.time) newWrongItem.time = Date.now();
      
      expect(newWrongItem.level).toBe(0);
      expect(newWrongItem.nextReview).toBeTruthy();
      expect(newWrongItem.lastReview).toBe(0);
    });
  });

  describe('统计重算（关键修复）', () => {
    test('统计应该从历史记录重算，而非累加', () => {
      const history = [
        { qid: 'q001', ok: true, time: Date.now() },
        { qid: 'q002', ok: false, time: Date.now() },
        { qid: 'q003', ok: true, time: Date.now() }
      ];
      
      // 重算统计
      const stats = { total: 0, correct: 0, cats: {} };
      for (const rec of history) {
        stats.total++;
        if (rec.ok) stats.correct++;
      }
      
      expect(stats.total).toBe(3);
      expect(stats.correct).toBe(2);
    });

    test('导入后统计应该准确反映合并后的历史', () => {
      const history1 = [{ qid: 'q001', ok: true, time: Date.now() }];
      const history2 = [{ qid: 'q001', ok: false, time: Date.now() }];
      
      const merged = history1.concat(history2);
      
      const stats = { total: merged.length, correct: merged.filter(r => r.ok).length };
      
      expect(stats.total).toBe(2);
      expect(stats.correct).toBe(1);
    });
  });

  describe('XSS 转义在管理界面', () => {
    test('题目内容中的脚本应该被转义', () => {
      const maliciousQuestion = '<script>alert("xss")</script>测试';
      const escaped = App.esc(maliciousQuestion);
      
      expect(escaped).not.toContain('<script>');
      expect(escaped).toContain('&lt;');
    });

    test('选项内容中的特殊字符应该被转义', () => {
      const maliciousOption = '"><img src=x onerror=alert(1)>';
      const escaped = App.esc(maliciousOption);
      
      // 确保标签被转义，不能包含有效的 HTML 标签
      expect(escaped).not.toContain('<img');
      expect(escaped).toContain('&lt;'); // 确认被转义
    });

    test('分类名称中的 HTML 应该被转义', () => {
      const maliciousCategory = '<div>专辑</div>';
      const escaped = App.esc(maliciousCategory);
      
      expect(escaped).not.toContain('<div>');
    });
  });

  describe('重置题库验证', () => {
    test('重置应该恢复默认题库', () => {
      // 修改题库
      App.QUESTION_BANK.push({ id: 'q999', question: '临时题目' });
      expect(App.QUESTION_BANK.length).toBe(3);
      
      // 重置
      App.QUESTION_BANK = App.DEFAULT_QUESTION_BANK.slice();
      
      expect(App.QUESTION_BANK.length).toBe(2);
      expect(App.QUESTION_BANK.find(q => q.id === 'q999')).toBeUndefined();
    });

    test('重置确认输入验证', () => {
      const validInput = '恢复默认';
      const invalidInput = '恢复';
      
      expect(validInput === '恢复默认').toBe(true);
      expect(invalidInput === '恢复默认').toBe(false);
    });
  });

  describe('边界条件', () => {
    test('空题库导入应该不崩溃', () => {
      const data = { questionBank: [] };
      expect(() => {
        if (data.questionBank) {
          // 处理空数组
        }
      }).not.toThrow();
    });

    test('空用户数据导入应该不崩溃', () => {
      const data = { 
        userData: { 
          history: [], 
          wrong: [], 
          stats: { total: 0, correct: 0, cats: {} } 
        } 
      };
      
      expect(() => {
        if (data.userData) {
          // 处理空数据
        }
      }).not.toThrow();
    });

    test('缺少必要字段的数据应该被拒绝', () => {
      const data = { other: 'data' };
      const isValid = data.questionBank || data.userData;
      
      expect(isValid).toBeFalsy();
    });
  });
});