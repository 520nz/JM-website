// admin.js 单元测试：覆盖题目 CRUD、选项解析与数据导入合并逻辑

function loadApp() {
  window.App = {};
  require('../data.js');
  require('../storage.js');
  require('../admin.js');
}

function mockForm(values) {
  const byId = {};
  Object.keys(values).forEach(id => {
    byId[id] = { value: values[id] };
  });
  const orig = document.getElementById;
  document.getElementById = function(id) {
    return byId[id] !== undefined ? byId[id] : orig.call(document, id);
  };
  return () => { document.getElementById = orig; };
}

describe('admin.js question CRUD', () => {
  beforeEach(() => {
    jest.resetModules();
    global.createTestIndexedDB();
    loadApp();
  });

  test('saveQuestion 新增题目并解析多种分隔符格式', () => {
    document.body.innerHTML =
      '<div id="editModal"></div>' +
      '<input id="searchInput" value=""><select id="categoryFilter"><option value=""></option></select><div id="questionList"></div>';
    const restore = mockForm({
      editId: '',
      editCategory: '专辑',
      editQuestion: '测试题',
      editOptions: 'A.选项1\nB.选项2\nC、选项3\nD．选项4',
      editAnswer: 'B',
      editExplanation: '解析'
    });

    window.App.saveQuestion();

    const q = window.App.QUESTION_BANK[window.App.QUESTION_BANK.length - 1];
    expect(q.question).toBe('测试题');
    expect(q.options.length).toBe(4);
    expect(q.options[2].key).toBe('C');
    expect(q.options[2].text).toBe('选项3');
    expect(q.answer).toBe('B');
    restore();
  });

  test('saveQuestion 编辑题目更新现有记录', () => {
    document.body.innerHTML =
      '<div id="editModal"></div>' +
      '<input id="searchInput" value=""><select id="categoryFilter"><option value=""></option></select><div id="questionList"></div>';
    const firstId = window.App.QUESTION_BANK[0].id;
    const restore = mockForm({
      editId: firstId,
      editCategory: '专辑',
      editQuestion: '修改后题目',
      editOptions: 'A.新A\nB.新B',
      editAnswer: 'A',
      editExplanation: '新解析'
    });

    window.App.saveQuestion();

    const q = window.App.QUESTION_BANK.find(x => x.id === firstId);
    expect(q.question).toBe('修改后题目');
    expect(q.options.length).toBe(2);
    expect(q.answer).toBe('A');
    restore();
  });

  test('saveQuestion 选项少于 2 个时不保存', () => {
    const len = window.App.QUESTION_BANK.length;
    const restore = mockForm({
      editId: '',
      editCategory: '专辑',
      editQuestion: '测试题',
      editOptions: 'A.唯一选项',
      editAnswer: 'A',
      editExplanation: ''
    });
    // 阻止 alert 弹窗
    const origAlert = window.alert;
    window.alert = jest.fn();
    window.App.saveQuestion();
    expect(window.App.QUESTION_BANK.length).toBe(len);
    window.alert = origAlert;
    restore();
  });

  test('deleteQuestion 删除指定题目', () => {
    document.body.innerHTML = '<input id="searchInput" value=""><select id="categoryFilter"><option value=""></option></select><div id="questionList"></div>';
    const firstId = window.App.QUESTION_BANK[0].id;
    const origConfirm = window.confirm;
    window.confirm = () => true;
    window.App.deleteQuestion(firstId);
    window.confirm = origConfirm;
    expect(window.App.QUESTION_BANK.find(q => q.id === firstId)).toBeUndefined();
  });
});

describe('admin.js import/export', () => {
  beforeEach(async () => {
    jest.resetModules();
    global.createTestIndexedDB();
    loadApp();
    await window.App.db.init();
  });

  test('exportData 生成包含题库与用户数据的 JSON', () => {
    const origCreateObjectURL = URL.createObjectURL;
    const origRevokeObjectURL = URL.revokeObjectURL;
    const origAlert = window.alert;
    const origCreateElement = document.createElement;
    URL.createObjectURL = jest.fn(() => 'blob:fake');
    URL.revokeObjectURL = jest.fn();
    window.alert = jest.fn();
    document.createElement = function(tag) {
      if (tag === 'a') {
        return { href: '', download: '', click: jest.fn() };
      }
      return origCreateElement.call(document, tag);
    };

    window.App.exportData();

    expect(URL.createObjectURL).toHaveBeenCalled();
    const blob = URL.createObjectURL.mock.calls[0][0];
    expect(blob.type).toBe('application/json');

    URL.createObjectURL = origCreateObjectURL;
    URL.revokeObjectURL = origRevokeObjectURL;
    window.alert = origAlert;
    document.createElement = origCreateElement;
  });

  test('importData 合并题库并新增不存在的题目', () => {
    const len = window.App.QUESTION_BANK.length;
    const data = {
      questionBank: [{
        id: 'new-imported',
        category: '测试',
        question: '导入题',
        options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }],
        answer: 'A',
        explanation: ''
      }]
    };

    const file = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const event = { target: { files: [file] } };
    const origAlert = window.alert;
    window.alert = jest.fn();
    window.App.importData(event);

    // FileReader 是异步的，需要等待
    return new Promise(resolve => setTimeout(resolve, 100)).then(() => {
      expect(window.App.QUESTION_BANK.length).toBe(len + 1);
      expect(window.App.QUESTION_BANK.some(q => q.id === 'new-imported')).toBe(true);
      window.alert = origAlert;
    });
  });

  test('importData 合并用户数据时通过 recalcStats 避免 stats 累加', () => {
    window.App.db.addRecord({ qid: '001', ans: 'A', ok: true, time: Date.now() });

    const data = {
      userData: {
        history: [{ qid: '002', ans: 'B', ok: false, time: Date.now() }],
        wrong: [{ qid: '002', cnt: 1, level: 0, time: Date.now(), nextReview: Date.now() }]
      }
    };

    const file = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const event = { target: { files: [file] } };
    const origAlert = window.alert;
    window.alert = jest.fn();
    window.App.importData(event);

    return new Promise(resolve => setTimeout(resolve, 100)).then(() => {
      const d = window.App.db.get();
      expect(d.history.length).toBe(2);
      expect(d.stats.total).toBe(2); // 不是 1+1 直接累加，而是重算
      expect(d.stats.correct).toBe(1);
      window.alert = origAlert;
    });
  });

  test('importData 对错误 JSON 给出提示', () => {
    const file = new Blob(['not json'], { type: 'application/json' });
    const event = { target: { files: [file] } };
    const origAlert = window.alert;
    window.alert = jest.fn();
    window.App.importData(event);

    return new Promise(resolve => setTimeout(resolve, 100)).then(() => {
      expect(window.alert).toHaveBeenCalled();
      const msg = window.alert.mock.calls[0][0];
      expect(msg).toContain('导入失败');
      window.alert = origAlert;
    });
  });

  test('importData 对缺少有效字段的文件给出提示', () => {
    const file = new Blob([JSON.stringify({ foo: 'bar' })], { type: 'application/json' });
    const event = { target: { files: [file] } };
    const origAlert = window.alert;
    window.alert = jest.fn();
    window.App.importData(event);

    return new Promise(resolve => setTimeout(resolve, 100)).then(() => {
      expect(window.alert).toHaveBeenCalled();
      const msg = window.alert.mock.calls[0][0];
      expect(msg).toContain('导入失败');
      window.alert = origAlert;
    });
  });
});

describe('admin.js reset confirmation', () => {
  beforeEach(() => {
    jest.resetModules();
    global.createTestIndexedDB();
    loadApp();
  });

  test('checkResetInput 在输入正确确认文本时启用按钮', () => {
    const btn = { style: {} };
    const input = { value: '恢复默认' };
    const restore = mockForm({ resetConfirmInput: '恢复默认', resetConfirmBtn: 'btn' });
    const origGet = document.getElementById;
    document.getElementById = function(id) {
      if (id === 'resetConfirmInput') return input;
      if (id === 'resetConfirmBtn') return btn;
      return origGet.call(document, id);
    };

    window.App.checkResetInput();
    expect(btn.style.opacity).toBe('1');
    expect(btn.style.pointerEvents).toBe('auto');

    input.value = '错误输入';
    window.App.checkResetInput();
    expect(btn.style.opacity).toBe('0.5');
    expect(btn.style.pointerEvents).toBe('none');

    restore();
  });
});
