import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadScript, resetAppState } from './helper.js';

describe('admin.js - 题库管理与导入导出', () => {
  beforeEach(() => {
    loadScript('js/data.js');
    loadScript('js/storage.js');
    loadScript('js/admin.js');
    resetAppState();
    vi.stubGlobal('alert', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetAppState();
  });

  describe('App.parseOptions - 选项文本解析', () => {
    it('应解析标准半角点号格式', () => {
      const opts = window.App.parseOptions('A. 选项A\nB. 选项B\nC. 选项C');
      expect(opts).toEqual([
        { key: 'A', text: '选项A' },
        { key: 'B', text: '选项B' },
        { key: 'C', text: '选项C' }
      ]);
    });

    it('应解析中文顿号与全角点号', () => {
      const opts = window.App.parseOptions('A、选项A\nB．选项B');
      expect(opts).toEqual([
        { key: 'A', text: '选项A' },
        { key: 'B', text: '选项B' }
      ]);
    });

    it('应忽略空行与多余空白', () => {
      const opts = window.App.parseOptions('  A. 选项A  \n\n  B. 选项B  ');
      expect(opts).toHaveLength(2);
    });

    it('不规范行应被跳过', () => {
      const opts = window.App.parseOptions('A. 选项A\n无效行\nB. 选项B');
      expect(opts).toHaveLength(2);
      expect(opts[0].key).toBe('A');
      expect(opts[1].key).toBe('B');
    });
  });

  describe('App.saveQuestion - 题目 CRUD', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <input id="editId" value="" />
        <select id="editCategory"><option value="专辑">专辑</option></select>
        <input id="editQuestion" value="测试题目" />
        <textarea id="editOptions">A. 选项A
B. 选项B
C. 选项C
D. 选项D</textarea>
        <input id="editAnswer" value="B" />
        <input id="editExplanation" value="解析" />
        <div id="editModal" style="display:none;"></div>
        <input id="searchInput" value="" />
        <select id="categoryFilter"><option value="">全部类别</option></select>
        <div id="questionList"></div>
      `;
    });

    it('新增题目应加入题库并生成 ID', () => {
      const beforeLen = window.App.QUESTION_BANK.length;
      window.App.saveQuestion();
      expect(window.App.QUESTION_BANK.length).toBe(beforeLen + 1);
      const q = window.App.QUESTION_BANK[window.App.QUESTION_BANK.length - 1];
      expect(q.question).toBe('测试题目');
      expect(q.options).toHaveLength(4);
      expect(q.answer).toBe('B');
      expect(q.id).toMatch(/^q\d+$/);
    });

    it('选项不足两个时应中断并提示', () => {
      document.getElementById('editOptions').value = 'A. 唯一选项';
      const beforeLen = window.App.QUESTION_BANK.length;
      window.App.saveQuestion();
      expect(window.App.QUESTION_BANK.length).toBe(beforeLen);
      expect(window.alert).toHaveBeenCalled();
    });
  });

  describe('App.mergeImportedData - 数据合并', () => {
    it('应新增不存在的题目', () => {
      const beforeLen = window.App.QUESTION_BANK.length;
      const result = window.App.mergeImportedData({
        questionBank: [
          { id: 'NEW001', category: '专辑', question: '新题', options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }], answer: 'A', explanation: '' }
        ]
      });
      expect(window.App.QUESTION_BANK.length).toBe(beforeLen + 1);
      expect(result.addedCount).toBe(1);
      expect(result.updatedCount).toBe(0);
    });

    it('应更新已存在的题目', () => {
      const existingId = window.App.QUESTION_BANK[0].id;
      const result = window.App.mergeImportedData({
        questionBank: [
          { id: existingId, category: '专辑', question: '已更新', options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }], answer: 'A', explanation: 'updated' }
        ]
      });
      expect(window.App.QUESTION_BANK[0].question).toBe('已更新');
      expect(result.addedCount).toBe(0);
      expect(result.updatedCount).toBe(1);
    });

    it('合并答题历史后应重算统计，避免累加', () => {
      const d = window.App.db.get();
      d.history = [{ qid: '001', ok: true, time: Date.now() }];
      window.App.db.recalcStats();
      expect(d.stats.total).toBe(1);

      window.App.mergeImportedData({
        userData: {
          history: [{ qid: '001', ok: false, time: Date.now() }],
          wrong: []
        }
      });

      // 总记录应为 2，正确数为 1，而不是把 stats.total 直接相加
      expect(d.history.length).toBe(2);
      expect(d.stats.total).toBe(2);
      expect(d.stats.correct).toBe(1);
    });

    it('合并错题时应取较高错误次数并保留保守等级', () => {
      const d = window.App.db.get();
      d.wrong = [{ qid: '001', cnt: 2, level: 2, nextReview: Date.now(), lastReview: 0, time: Date.now() }];

      window.App.mergeImportedData({
        userData: {
          history: [],
          wrong: [{ qid: '001', cnt: 5, level: 4, nextReview: Date.now(), lastReview: 0, time: Date.now() }]
        }
      });

      const w = d.wrong[0];
      expect(w.cnt).toBe(5);
      expect(w.level).toBe(2); // 保留较低等级
    });

    it('新错题应补充默认间隔重复字段', () => {
      const d = window.App.db.get();
      window.App.mergeImportedData({
        userData: {
          history: [],
          wrong: [{ qid: '001', cnt: 1 }]
        }
      });
      const w = d.wrong[0];
      expect(w.level).toBe(0);
      expect(w.nextReview).toBeDefined();
      expect(w.lastReview).toBe(0);
      expect(w.time).toBeDefined();
    });
  });
});
