const { JSDOM } = require('jsdom');
require('fake-indexeddb/auto');

describe('admin.js', () => {
  let App;

  beforeEach(() => {
    const dom = new JSDOM('<!DOCTYPE html><html><body><select id="categoryFilter"><option value=""></option></select><select id="editCategory"><option value="专辑">专辑</option></select><div id="questionList"></div><input type="text" id="searchInput" value="" /><div id="editModal"></div><input type="hidden" id="editId" value="" /><textarea id="editQuestion"></textarea><textarea id="editOptions"></textarea><select id="editAnswer"><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option></select><textarea id="editExplanation"></textarea><div id="modalTitle"></div><div id="resetModal"></div><input type="text" id="resetConfirmInput" value="" /><button id="resetConfirmBtn"></button></body></html>');
    global.document = dom.window.document;
    global.window = dom.window;
    global.Date = dom.window.Date;
    global.URL = { createObjectURL: jest.fn(), revokeObjectURL: jest.fn() };
    global.alert = jest.fn();
    global.confirm = jest.fn().mockReturnValue(true);
    global.sessionStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn()
    };

    App = {};
    window.App = App;
    jest.resetModules();
  });

  beforeEach(async () => {
    require('./data');
    require('./storage');
    await App.db.init();
    require('./admin');
  });

  describe('updateCategoryFilter', () => {
    it('should populate category filter options', () => {
      App.updateCategoryFilter();
      const select = document.getElementById('categoryFilter');
      expect(select.innerHTML).toContain('全部类别');
      expect(select.innerHTML).toContain('专辑');
      expect(select.innerHTML).toContain('歌曲');
    });
  });

  describe('updateEditCategoryOptions', () => {
    it('should populate edit category options', () => {
      App.updateEditCategoryOptions();
      const select = document.getElementById('editCategory');
      expect(select.innerHTML).toContain('专辑');
      expect(select.innerHTML).toContain('歌曲');
    });
  });

  describe('renderQuestionList', () => {
    it('should render all questions when no filter', () => {
      App.renderQuestionList();
      const list = document.getElementById('questionList');
      expect(list.innerHTML).toContain('乐行者');
    });

    it('should filter by category', () => {
      document.getElementById('categoryFilter').value = '专辑';
      App.renderQuestionList();
      const list = document.getElementById('questionList');
      expect(list.innerHTML).toContain('乐行者');
    });

    it('should filter by search', () => {
      document.getElementById('searchInput').value = '乐行者';
      App.renderQuestionList();
      const list = document.getElementById('questionList');
      expect(list.innerHTML).toContain('乐行者');
    });
  });

  describe('filterQuestions', () => {
    it('should call renderQuestionList', () => {
      App.filterQuestions();
      const list = document.getElementById('questionList');
      expect(list.innerHTML).toContain('乐行者');
    });
  });

  describe('showAddForm', () => {
    it('should reset form fields', () => {
      App.showAddForm();
      expect(document.getElementById('editId').value).toBe('');
      expect(document.getElementById('editQuestion').value).toBe('');
      expect(document.getElementById('editAnswer').value).toBe('A');
    });

    it('should set default category to 专辑', () => {
      App.showAddForm();
      expect(document.getElementById('editCategory').value).toBe('专辑');
    });
  });

  describe('showEditForm', () => {
    it('should populate form with existing question', () => {
      App.showEditForm('001');
      expect(document.getElementById('editId').value).toBe('001');
      expect(document.getElementById('editQuestion').value).toContain('乐行者');
      expect(document.getElementById('editAnswer').value).toBe('B');
    });

    it('should do nothing for non-existent id', () => {
      App.showEditForm('nonexistent');
      expect(document.getElementById('editId').value).toBe('');
    });
  });

  describe('closeModal', () => {
    it('should hide edit modal', () => {
      document.getElementById('editModal').style.display = 'block';
      App.closeModal();
      expect(document.getElementById('editModal').style.display).toBe('none');
    });
  });

  describe('saveQuestion', () => {
    it('should add new question', () => {
      const initialLength = App.QUESTION_BANK.length;
      document.getElementById('editId').value = '';
      document.getElementById('editCategory').value = '专辑';
      document.getElementById('editQuestion').value = '测试题目';
      document.getElementById('editOptions').value = 'A.选项1\nB.选项2\nC.选项3\nD.选项4';
      document.getElementById('editAnswer').value = 'A';
      document.getElementById('editExplanation').value = '测试解析';
      App.saveQuestion();
      expect(App.QUESTION_BANK.length).toBe(initialLength + 1);
    });

    it('should edit existing question', () => {
      App.showEditForm('001');
      document.getElementById('editQuestion').value = '修改后的题目';
      App.saveQuestion();
      const q = App.db.findQ('001');
      expect(q.question).toBe('修改后的题目');
    });

    it('should validate required fields', () => {
      document.getElementById('editId').value = '';
      document.getElementById('editQuestion').value = '';
      document.getElementById('editOptions').value = '';
      App.saveQuestion();
      expect(alert).toHaveBeenCalled();
    });

    it('should validate at least 2 options', () => {
      document.getElementById('editId').value = '';
      document.getElementById('editQuestion').value = '测试题目';
      document.getElementById('editOptions').value = 'A.选项1';
      App.saveQuestion();
      expect(alert).toHaveBeenCalled();
    });
  });

  describe('deleteQuestion', () => {
    it('should delete question', () => {
      const initialLength = App.QUESTION_BANK.length;
      App.deleteQuestion('001');
      expect(App.QUESTION_BANK.length).toBe(initialLength - 1);
      expect(App.db.findQ('001')).toBeNull();
    });

    it('should cancel deletion when user declines', () => {
      global.confirm = jest.fn().mockReturnValue(false);
      const initialLength = App.QUESTION_BANK.length;
      App.deleteQuestion('001');
      expect(App.QUESTION_BANK.length).toBe(initialLength);
    });
  });

  describe('showResetConfirm', () => {
    it('should show reset modal', () => {
      App.showResetConfirm();
      expect(document.getElementById('resetModal').style.display).toBe('flex');
    });

    it('should clear input', () => {
      document.getElementById('resetConfirmInput').value = 'test';
      App.showResetConfirm();
      expect(document.getElementById('resetConfirmInput').value).toBe('');
    });
  });

  describe('closeResetModal', () => {
    it('should hide reset modal', () => {
      document.getElementById('resetModal').style.display = 'flex';
      App.closeResetModal();
      expect(document.getElementById('resetModal').style.display).toBe('none');
    });
  });

  describe('checkResetInput', () => {
    it('should enable button when correct text entered', () => {
      document.getElementById('resetConfirmInput').value = '恢复默认';
      App.checkResetInput();
      const btn = document.getElementById('resetConfirmBtn');
      expect(btn.style.opacity).toBe('1');
      expect(btn.style.pointerEvents).toBe('auto');
    });

    it('should disable button when incorrect text', () => {
      document.getElementById('resetConfirmInput').value = 'wrong';
      App.checkResetInput();
      const btn = document.getElementById('resetConfirmBtn');
      expect(btn.style.opacity).toBe('0.5');
      expect(btn.style.pointerEvents).toBe('none');
    });
  });

  describe('resetQuestionBank', () => {
    it('should call store reset', () => {
      App.store.reset = jest.fn().mockResolvedValue();
      App.resetQuestionBank();
      expect(App.store.reset).toHaveBeenCalled();
    });

    it('should close reset modal', () => {
      document.getElementById('resetModal').style.display = 'flex';
      App.store.reset = jest.fn().mockResolvedValue();
      App.resetQuestionBank();
      expect(document.getElementById('resetModal').style.display).toBe('none');
    });
  });

  describe('exportData', () => {
    it('should export data', () => {
      App.exportData();
      expect(alert).toHaveBeenCalled();
    });
  });
});
