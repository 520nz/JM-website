/**
 * admin.js 分页与管理逻辑测试
 * 覆盖缺口：管理页分页、过滤后页码调整
 */

describe('admin.js - 分页逻辑', () => {
  function setupDOM() {
    document.body.innerHTML = `
      <input id="searchInput" value="" />
      <select id="categoryFilter"><option value="">全部类别</option></select>
      <div id="questionList"></div>
      <select id="editCategory"></select>
      <div id="editModal" style="display:none"></div>
      <div id="modalTitle"></div>
      <input id="editId" value="" />
      <input id="editQuestion" value="" />
      <textarea id="editOptions">A.\nB.\nC.\nD.</textarea>
      <input id="editAnswer" value="A" />
      <input id="editExplanation" value="" />
      <div id="resetModal" style="display:none"></div>
      <input id="resetConfirmInput" value="" />
      <button id="resetConfirmBtn"></button>
    `;
  }

  beforeEach(() => {
    jest.resetModules();
    setupDOM();
    global.App = {
      QUESTION_BANK: [],
      esc: (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
      store: { save: jest.fn(), reset: jest.fn() },
      db: { get: jest.fn(() => ({})), setData: jest.fn() }
    };
    require('../admin.js');
  });

  function makeQuestions(count, prefix) {
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        id: 'q' + i,
        category: i % 2 === 0 ? '专辑' : '歌曲',
        question: (prefix || '题目') + (i + 1),
        options: [{ key: 'A', text: '选项A' }, { key: 'B', text: '选项B' }],
        answer: 'A',
        explanation: ''
      });
    }
    return arr;
  }

  it('少于 30 条时应只显示 1 页且无分页控件', () => {
    global.App.QUESTION_BANK = makeQuestions(25);
    App.renderQuestionList();
    const html = document.getElementById('questionList').innerHTML;
    expect(html).toContain('题目1');
    expect(html).not.toContain('上一页');
    expect(html).not.toContain('下一页');
  });

  it('刚好 30 条时应显示 1 页且无分页控件', () => {
    global.App.QUESTION_BANK = makeQuestions(30);
    App.renderQuestionList();
    const html = document.getElementById('questionList').innerHTML;
    expect(html).toContain('题目30');
    expect(html).not.toContain('上一页');
  });

  it('31 条时应显示分页控件且分为 2 页', () => {
    global.App.QUESTION_BANK = makeQuestions(31);
    App.renderQuestionList();
    const html = document.getElementById('questionList').innerHTML;
    expect(html).toContain('上一页');
    expect(html).toContain('下一页');
    expect(html).toContain('1 / 2 页');
    expect(html).toContain('（共31题）');
    // 第一页应显示前 30 条
    expect(html).toContain('题目1');
    expect(html).toContain('题目30');
    expect(html).not.toContain('题目31');
  });

  it('点击下一页应显示后续题目', () => {
    global.App.QUESTION_BANK = makeQuestions(35);
    App.renderQuestionList();
    App.adminNextPage();
    const html = document.getElementById('questionList').innerHTML;
    expect(html).toContain('2 / 2 页');
    expect(html).toContain('题目31');
    expect(html).toContain('题目35');
  });

  it('第一页时上一页按钮应禁用', () => {
    global.App.QUESTION_BANK = makeQuestions(35);
    App.renderQuestionList();
    const html = document.getElementById('questionList').innerHTML;
    // disabled 属性在按钮文本之前
    expect(html).toContain('disabled="" style="opacity:0.4;">上一页');
  });

  it('最后一页时下一页按钮应禁用', () => {
    global.App.QUESTION_BANK = makeQuestions(35);
    App.renderQuestionList();
    App.adminNextPage(); // 到第 2 页
    const html = document.getElementById('questionList').innerHTML;
    expect(html).toContain('disabled="" style="opacity:0.4;">下一页');
  });

  it('数据减少后若当前页超出总页数应自动调整到最后一页', () => {
    global.App.QUESTION_BANK = makeQuestions(65);
    // 先跳到第 3 页（每页30，共3页）
    App.adminNextPage();
    App.adminNextPage();
    let html = document.getElementById('questionList').innerHTML;
    expect(html).toContain('3 / 3 页');

    // 直接减少数据到 35 条（模拟删除后重新渲染）
    // 35 条 -> 2 页，原页码 3 超出范围，应自动回到第 2 页
    global.App.QUESTION_BANK = makeQuestions(35);
    App.renderQuestionList();
    html = document.getElementById('questionList').innerHTML;
    expect(html).toContain('2 / 2 页');
  });

  it('分类过滤应正确生效', () => {
    global.App.QUESTION_BANK = makeQuestions(10);
    document.getElementById('categoryFilter').innerHTML = '<option value="">全部</option><option value="专辑">专辑</option>';
    document.getElementById('categoryFilter').value = '专辑';
    App.renderQuestionList();
    const html = document.getElementById('questionList').innerHTML;
    // 10 条中 5 条是专辑（偶数索引），应只显示专辑题目
    expect(html).toContain('题目1');
    expect(html).toContain('题目3');
    expect(html).not.toContain('题目2');
    expect(html).not.toContain('题目4');
  });

  it('搜索过滤应正确生效', () => {
    global.App.QUESTION_BANK = makeQuestions(10, '搜索测试');
    document.getElementById('searchInput').value = '搜索测试1';
    App.renderQuestionList();
    const html = document.getElementById('questionList').innerHTML;
    // 只有 "搜索测试1" 和 "搜索测试10" 匹配
    expect(html).toContain('搜索测试1');
    expect(html).toContain('搜索测试10');
    expect(html).not.toContain('搜索测试2');
  });
});

describe('admin.js - 题目 CRUD', () => {
  function setupDOM() {
    document.body.innerHTML = `
      <input id="searchInput" value="" />
      <select id="categoryFilter"><option value="">全部类别</option></select>
      <div id="questionList"></div>
      <select id="editCategory"></select>
      <div id="editModal" style="display:none"></div>
      <div id="modalTitle"></div>
      <input id="editId" value="" />
      <input id="editQuestion" value="" />
      <textarea id="editOptions">A.选项A\nB.选项B\nC.选项C\nD.选项D</textarea>
      <input id="editAnswer" value="A" />
      <input id="editExplanation" value="" />
      <div id="resetModal" style="display:none"></div>
      <input id="resetConfirmInput" value="" />
      <button id="resetConfirmBtn"></button>
    `;
  }

  beforeEach(() => {
    jest.resetModules();
    setupDOM();
    global.App = {
      QUESTION_BANK: [],
      esc: (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
      store: { save: jest.fn(), reset: jest.fn() },
      db: { get: jest.fn(() => ({})), setData: jest.fn() }
    };
    require('../admin.js');
  });

  it('saveQuestion 应解析选项格式并新增题目', () => {
    document.getElementById('editQuestion').value = '新问题';
    document.getElementById('editOptions').value = 'A.答案1\nB.答案2';
    document.getElementById('editAnswer').value = 'A';
    App.saveQuestion();
    expect(App.QUESTION_BANK.length).toBe(1);
    expect(App.QUESTION_BANK[0].question).toBe('新问题');
    expect(App.QUESTION_BANK[0].options.length).toBe(2);
    expect(App.QUESTION_BANK[0].options[0].key).toBe('A');
    expect(App.QUESTION_BANK[0].options[0].text).toBe('答案1');
  });

  it('saveQuestion 应支持中文标点分隔符', () => {
    document.getElementById('editQuestion').value = '新问题';
    document.getElementById('editOptions').value = 'A、答案1\nB、答案2';
    document.getElementById('editAnswer').value = 'B';
    App.saveQuestion();
    expect(App.QUESTION_BANK[0].options[0].text).toBe('答案1');
    expect(App.QUESTION_BANK[0].answer).toBe('B');
  });

  it('saveQuestion 选项少于 2 个时应不保存', () => {
    document.getElementById('editQuestion').value = '新问题';
    document.getElementById('editOptions').value = 'A.答案1';
    const before = App.QUESTION_BANK.length;
    // mock alert
    const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});
    App.saveQuestion();
    expect(App.QUESTION_BANK.length).toBe(before);
    alertMock.mockRestore();
  });

  it('deleteQuestion 应移除指定题目', () => {
    global.App.QUESTION_BANK = [
      { id: 'q1', question: 'Q1', category: '专辑', options: [], answer: 'A', explanation: '' },
      { id: 'q2', question: 'Q2', category: '歌曲', options: [], answer: 'B', explanation: '' }
    ];
    const confirmMock = jest.spyOn(window, 'confirm').mockReturnValue(true);
    App.deleteQuestion('q1');
    expect(App.QUESTION_BANK.length).toBe(1);
    expect(App.QUESTION_BANK[0].id).toBe('q2');
    confirmMock.mockRestore();
  });
});
