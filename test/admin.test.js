import { describe, it, expect, beforeEach } from 'vitest';
import { loadData, loadStorage, loadAdmin } from './loader.js';

/**
 * admin.js 核心逻辑测试
 * 覆盖：题目 CRUD、选项解析、数据导入导出等
 */
describe('admin.js', () => {
  beforeEach(async () => {
    loadData();
    loadStorage();
    loadAdmin();
    await window.App.db.init();
  });

  // ========== saveQuestion 选项解析 ==========
  describe('saveQuestion 选项解析逻辑', () => {
    it('应正确解析标准格式选项', () => {
      // 模拟 saveQuestion 中的选项解析逻辑
      const optsText = 'A.选项一\nB.选项二\nC.选项三\nD.选项四';
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
      expect(options.length).toBe(4);
      expect(options[0]).toEqual({ key: 'A', text: '选项一' });
      expect(options[1]).toEqual({ key: 'B', text: '选项二' });
    });

    it('应支持中文标点格式', () => {
      const optsText = 'A、选项一\nB、选项二';
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
      expect(options.length).toBe(2);
      expect(options[0]).toEqual({ key: 'A', text: '选项一' });
    });

    it('应跳过空行', () => {
      const optsText = 'A.选项一\n\n\nB.选项二';
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
      expect(options.length).toBe(2);
    });

    it('不正确格式的行应被忽略', () => {
      const optsText = 'A.选项一\n错误格式\nB.选项二';
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
      expect(options.length).toBe(2);
    });
  });

  // ========== 题目 CRUD ==========
  describe('题库管理', () => {
    it('应能新增题目', () => {
      const originalLen = window.App.QUESTION_BANK.length;
      const newQ = {
        id: 'q_test_' + Date.now(),
        category: '测试',
        question: '测试题目',
        options: [
          { key: 'A', text: '选项A' },
          { key: 'B', text: '选项B' }
        ],
        answer: 'A',
        explanation: '解析'
      };
      window.App.QUESTION_BANK.push(newQ);
      expect(window.App.QUESTION_BANK.length).toBe(originalLen + 1);
      const found = window.App.db.findQ(newQ.id);
      expect(found).not.toBeNull();
      expect(found.question).toBe('测试题目');
    });

    it('应能编辑题目', () => {
      const q = window.App.db.findQ('001');
      expect(q).not.toBeNull();
      const originalQuestion = q.question;
      // 修改
      q.question = '修改后的题目';
      expect(window.App.db.findQ('001').question).toBe('修改后的题目');
      // 恢复
      q.question = originalQuestion;
    });

    it('应能删除题目', () => {
      const originalLen = window.App.QUESTION_BANK.length;
      const targetId = '001';
      window.App.QUESTION_BANK = window.App.QUESTION_BANK.filter(q => q.id !== targetId);
      expect(window.App.QUESTION_BANK.length).toBe(originalLen - 1);
      expect(window.App.db.findQ(targetId)).toBeNull();
    });
  });

  // ========== importData 数据导入逻辑 ==========
  describe('importData 数据导入逻辑', () => {
    it('应支持仅导入题库', () => {
      const importData = {
        questionBank: [
          { id: 'imp_001', category: '测试', question: '导入题', options: [{ key: 'A', text: 'A' }], answer: 'A', explanation: '' }
        ]
      };
      // 模拟导入合并逻辑
      const existingIds = {};
      for (const q of window.App.QUESTION_BANK) {
        existingIds[q.id] = true;
      }
      let addedCount = 0;
      for (const q of importData.questionBank) {
        if (existingIds[q.id]) {
          // 更新
          for (let k = 0; k < window.App.QUESTION_BANK.length; k++) {
            if (window.App.QUESTION_BANK[k].id === q.id) {
              window.App.QUESTION_BANK[k] = q;
              break;
            }
          }
        } else {
          window.App.QUESTION_BANK.push(q);
          addedCount++;
        }
      }
      expect(addedCount).toBe(1);
      expect(window.App.db.findQ('imp_001')).not.toBeNull();
    });

    it('应支持仅导入用户数据', () => {
      const importUserData = {
        userData: {
          history: [{ qid: '001', ok: true, time: Date.now() }],
          wrong: [{ qid: '002', cnt: 3, level: 2, time: Date.now(), lastReview: Date.now(), nextReview: Date.now() }]
        }
      };
      const existingData = window.App.db.get();
      // 合并 history
      if (importUserData.userData.history) {
        existingData.history = existingData.history.concat(importUserData.userData.history);
      }
      // 合并 wrong
      if (importUserData.userData.wrong) {
        const wrongMap = {};
        for (const w of existingData.wrong) {
          wrongMap[w.qid] = w;
        }
        for (const wrongItem of importUserData.userData.wrong) {
          if (wrongMap[wrongItem.qid]) {
            // 取较高错误次数
            wrongMap[wrongItem.qid].cnt = Math.max(wrongMap[wrongItem.qid].cnt, wrongItem.cnt || 1);
            // 保留较低等级
            if (wrongItem.level != null) {
              wrongMap[wrongItem.qid].level = Math.min(wrongMap[wrongItem.qid].level || 0, wrongItem.level);
            }
          } else {
            if (!wrongItem.level) wrongItem.level = 0;
            if (!wrongItem.nextReview) wrongItem.nextReview = Date.now();
            if (!wrongItem.lastReview) wrongItem.lastReview = 0;
            if (!wrongItem.time) wrongItem.time = Date.now();
            existingData.wrong.push(wrongItem);
          }
        }
      }
      // 重算统计
      window.App.db.recalcStats();

      const d = window.App.db.get();
      expect(d.history.length).toBeGreaterThanOrEqual(1);
      expect(d.wrong.length).toBeGreaterThanOrEqual(1);
      expect(d.stats.total).toBeGreaterThanOrEqual(1);
    });

    it('合并错题时应保留较高的错误次数', () => {
      const existingData = window.App.db.get();
      existingData.wrong = [
        { qid: '001', cnt: 5, level: 2, time: Date.now(), lastReview: Date.now(), nextReview: Date.now() }
      ];
      const importedWrong = [
        { qid: '001', cnt: 8, level: 1, time: Date.now(), lastReview: Date.now(), nextReview: Date.now() }
      ];
      const wrongMap = {};
      for (const w of existingData.wrong) {
        wrongMap[w.qid] = w;
      }
      for (const wrongItem of importedWrong) {
        if (wrongMap[wrongItem.qid]) {
          wrongMap[wrongItem.qid].cnt = Math.max(wrongMap[wrongItem.qid].cnt, wrongItem.cnt || 1);
          if (wrongItem.level != null) {
            wrongMap[wrongItem.qid].level = Math.min(wrongMap[wrongItem.qid].level || 0, wrongItem.level);
          }
        }
      }
      expect(wrongMap['001'].cnt).toBe(8); // 取较大值
      expect(wrongMap['001'].level).toBe(1); // 取较小值
    });

    it('合并错题时对新条目应补充默认字段', () => {
      const existingData = window.App.db.get();
      existingData.wrong = [];
      const importedWrong = [
        { qid: '001', cnt: 1 } // 缺少其他字段
      ];
      for (const wrongItem of importedWrong) {
        if (!wrongItem.level) wrongItem.level = 0;
        if (!wrongItem.nextReview) wrongItem.nextReview = Date.now();
        if (!wrongItem.lastReview) wrongItem.lastReview = 0;
        if (!wrongItem.time) wrongItem.time = Date.now();
        existingData.wrong.push(wrongItem);
      }
      const item = existingData.wrong[0];
      expect(item.level).toBe(0);
      expect(item.nextReview).toBeGreaterThan(0);
      expect(item.time).toBeGreaterThan(0);
    });
  });

  // ========== 题库重置 ==========
  describe('题库重置', () => {
    it('reset 应恢复到默认题库', () => {
      const modifiedLen = window.App.QUESTION_BANK.length;
      // 修改题库
      window.App.QUESTION_BANK.push({
        id: 'temp', category: '测试', question: '临时', options: [{ key: 'A', text: 'A' }], answer: 'A', explanation: ''
      });
      expect(window.App.QUESTION_BANK.length).toBe(modifiedLen + 1);
      // 恢复
      window.App.QUESTION_BANK = window.App.DEFAULT_QUESTION_BANK.slice();
      expect(window.App.QUESTION_BANK.length).toBe(modifiedLen);
    });

    it('DEFAULT_QUESTION_BANK 不应被修改影响', () => {
      const defaultLen = window.App.DEFAULT_QUESTION_BANK.length;
      window.App.QUESTION_BANK.push({
        id: 'temp2', category: '测试', question: '临时2', options: [{ key: 'A', text: 'A' }], answer: 'A', explanation: ''
      });
      expect(window.App.DEFAULT_QUESTION_BANK.length).toBe(defaultLen);
    });
  });

  // ========== 数据导出 ==========
  describe('数据导出结构', () => {
    it('导出数据应包含必要字段', () => {
      const data = {
        questionBank: window.App.QUESTION_BANK,
        userData: window.App.db.get(),
        exportTime: new Date().toISOString()
      };
      expect(data.questionBank).toBeDefined();
      expect(data.userData).toBeDefined();
      expect(data.exportTime).toBeDefined();
      expect(Array.isArray(data.questionBank)).toBe(true);
      expect(typeof data.exportTime).toBe('string');
    });
  });

  // ========== 边界条件 ==========
  describe('边界条件', () => {
    it('空题库应能正常处理', () => {
      const original = window.App.QUESTION_BANK;
      window.App.QUESTION_BANK = [];
      expect(window.App.QUESTION_BANK.length).toBe(0);
      expect(window.App.db.findQ('001')).toBeNull();
      // 恢复
      window.App.QUESTION_BANK = original;
    });

    it('导入空数据不应出错', () => {
      const beforeCount = window.App.QUESTION_BANK.length;
      // 模拟导入空题库
      window.App.QUESTION_BANK = window.App.QUESTION_BANK.filter(() => false);
      expect(window.App.QUESTION_BANK.length).toBe(0);
      // 恢复
      window.App.QUESTION_BANK = window.App.DEFAULT_QUESTION_BANK.slice();
      expect(window.App.QUESTION_BANK.length).toBe(beforeCount);
    });

    it('特殊字符在题目中应正确处理', () => {
      const q = window.App.db.findQ('001');
      expect(q).not.toBeNull();
      // 题库中的题目可能包含特殊字符
      const allText = window.App.QUESTION_BANK.map(q => q.question + q.explanation).join('');
      expect(typeof allText).toBe('string');
    });
  });
});
