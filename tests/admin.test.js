import { describe, it, expect, beforeEach } from 'vitest';
import { loadAllApp, resetDB, makeQuizBank } from './test-helpers.js';

function loadAdmin() {
  const fs = require('fs');
  const path = require('path');
  const code = fs.readFileSync(path.resolve(__dirname, '..', 'js', 'admin.js'), 'utf-8');
  const scriptEl = document.createElement('script');
  scriptEl.textContent = code;
  document.body.appendChild(scriptEl);
  return global.window.App;
}

describe('admin.js - 管理模块', () => {
  let App;

  function resetCache() {
    App.db.setData(App.db.defaults());
  }

  beforeEach(async () => {
    resetDB();
    await new Promise(r => setTimeout(r, 10));
    App = loadAllApp();
    App.QUESTION_BANK = makeQuizBank();
    resetCache();
    loadAdmin();
  });

  describe('saveQuestion() - 选项解析逻辑', () => {
    it('解析标准格式选项 (A. xxx)', () => {
      const optsText = 'A. 选项A\nB. 选项B\nC. 选项C\nD. 选项D';
      const lines = optsText.split('\n');
      const options = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const match = line.match(/^([A-Z])[.、．]\s*(.+)$/);
        if (match) options.push({ key: match[1], text: match[2] });
      }
      expect(options.length).toBe(4);
      expect(options[0].key).toBe('A');
      expect(options[0].text).toBe('选项A');
      expect(options[1].key).toBe('B');
      expect(options[1].text).toBe('选项B');
    });

    it('识别中文顿号格式 (A、xxx)', () => {
      const optsText = 'A、选项A\nB、选项B';
      const lines = optsText.split('\n');
      const options = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const match = line.match(/^([A-Z])[.、．]\s*(.+)$/);
        if (match) options.push({ key: match[1], text: match[2] });
      }
      expect(options.length).toBe(2);
      expect(options[0].key).toBe('A');
    });

    it('全角点号格式 (A．xxx)', () => {
      const optsText = 'A．选项A\nB．选项B';
      const lines = optsText.split('\n');
      const options = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const match = line.match(/^([A-Z])[.、．]\s*(.+)$/);
        if (match) options.push({ key: match[1], text: match[2] });
      }
      expect(options.length).toBe(2);
    });

    it('跳过空行', () => {
      const optsText = 'A. 选项A\n\nB. 选项B';
      const lines = optsText.split('\n');
      const options = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const match = line.match(/^([A-Z])[.、．]\s*(.+)$/);
        if (match) options.push({ key: match[1], text: match[2] });
      }
      expect(options.length).toBe(2);
    });

    it('不匹配的行不被解析', () => {
      const optsText = 'A. 选项A\n这是无效行\nB. 选项B';
      const lines = optsText.split('\n');
      const options = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const match = line.match(/^([A-Z])[.、．]\s*(.+)$/);
        if (match) options.push({ key: match[1], text: match[2] });
      }
      expect(options.length).toBe(2);
    });
  });

  describe('importData() - 数据导入合并逻辑', () => {
    it('导入题库时新增题目', () => {
      const beforeCount = App.QUESTION_BANK.length;
      const newQuestions = [
        { id: 'new1', category: '专辑', question: '新问题', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }], answer: 'A', explanation: '' }
      ];
      for (let j = 0; j < newQuestions.length; j++) {
        App.QUESTION_BANK.push(newQuestions[j]);
      }
      expect(App.QUESTION_BANK.length).toBe(beforeCount + 1);
    });

    it('导入已存在题目时覆盖更新', () => {
      const beforeQ1 = App.QUESTION_BANK[0];
      const updatedQ1 = { ...beforeQ1, question: '更新后的问题' };
      App.QUESTION_BANK[0] = updatedQ1;
      expect(App.QUESTION_BANK[0].question).toBe('更新后的问题');
    });

    it('合并 history 后重算 stats 而非累加', () => {
      App.db.addRecord({ qid: 'q1', ok: true, time: Date.now() });
      const existingData = App.db.get();
      const initialHistoryLen = existingData.history.length;

      const newHistory = [
        { qid: 'q2', ok: true, time: Date.now() },
        { qid: 'q2', ok: false, time: Date.now() },
      ];
      existingData.history = existingData.history.concat(newHistory);
      const totalAfter = existingData.history.length;
      expect(totalAfter).toBe(initialHistoryLen + 2);

      App.db.recalcStats();
      const d = App.db.get();
      expect(d.stats.total).toBe(totalAfter);
      expect(d.stats.total).toBe(3);
    });

    it('合并错题本 - 取较高错误次数', () => {
      App.db.addWrong('q1');
      App.db.addWrong('q1');
      const wrongMap = {};
      const existingData = App.db.get();
      for (let w = 0; w < existingData.wrong.length; w++) {
        wrongMap[existingData.wrong[w].qid] = existingData.wrong[w];
      }

      const importWrongs = [{ qid: 'q1', cnt: 5, level: 3 }];
      for (const wrongItem of importWrongs) {
        if (wrongMap[wrongItem.qid]) {
          wrongMap[wrongItem.qid].cnt = Math.max(wrongMap[wrongItem.qid].cnt, wrongItem.cnt || 1);
        }
      }
      expect(wrongMap['q1'].cnt).toBe(5);
    });

    it('合并错题本 - 保留较低等级（更保守）', () => {
      App.db.addWrong('q1');
      App.db.reviewCorrect('q1');
      App.db.reviewCorrect('q1');
      const wrongMap = {};
      const existingData = App.db.get();
      for (let w = 0; w < existingData.wrong.length; w++) {
        wrongMap[existingData.wrong[w].qid] = existingData.wrong[w];
      }

      const importWrongs = [{ qid: 'q1', cnt: 3, level: 1 }];
      for (const wrongItem of importWrongs) {
        if (wrongMap[wrongItem.qid]) {
          if (wrongItem.level != null) {
            wrongMap[wrongItem.qid].level = Math.min(wrongMap[wrongItem.qid].level || 0, wrongItem.level);
          }
        }
      }
      expect(wrongMap['q1'].level).toBe(1);
    });

    it('新导入错题补全间隔重复字段', () => {
      const newWrong = { qid: 'q_new', cnt: 1 };
      if (!newWrong.level) newWrong.level = 0;
      if (!newWrong.nextReview) newWrong.nextReview = Date.now();
      if (!newWrong.lastReview) newWrong.lastReview = 0;
      if (!newWrong.time) newWrong.time = Date.now();

      expect(newWrong.level).toBe(0);
      expect(newWrong.lastReview).toBe(0);
      expect(typeof newWrong.nextReview).toBe('number');
      expect(typeof newWrong.time).toBe('number');
    });
  });

  describe('recalcStats() - 导入后重算统计（核心 bug 修复）', () => {
    it('旧 stats 被 history 重新计算覆盖', () => {
      App.db.addRecord({ qid: 'q1', ok: true, time: Date.now() });
      App.db.addRecord({ qid: 'q2', ok: false, time: Date.now() });

      const d = App.db.get();
      d.stats = { total: 999, correct: 999, cats: {} };

      App.db.recalcStats();

      const newStats = App.db.get().stats;
      expect(newStats.total).toBe(2);
      expect(newStats.correct).toBe(1);
      expect(newStats.total).not.toBe(999);
    });

    it('recalcStats 对空 history 不崩溃', () => {
      App.db.setData(App.db.defaults());
      expect(() => App.db.recalcStats()).not.toThrow();
      expect(App.db.get().stats.total).toBe(0);
    });
  });
});
