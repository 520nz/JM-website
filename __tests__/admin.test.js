describe('题库管理功能', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('选项解析应正确处理标准格式', () => {
    const optsText = 'A.选项1\nB.选项2\nC.选项3\nD.选项4';
    const lines = optsText.split('\n');
    const options = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const match = line.match(/^([A-D])[.、．]\s*(.+)$/);
      if (match) {
        options.push({ key: match[1], text: match[2] });
      }
    }
    expect(options.length).toBe(4);
    expect(options[0]).toEqual({ key: 'A', text: '选项1' });
    expect(options[1]).toEqual({ key: 'B', text: '选项2' });
    expect(options[2]).toEqual({ key: 'C', text: '选项3' });
    expect(options[3]).toEqual({ key: 'D', text: '选项4' });
  });

  test('选项解析应支持中文句号', () => {
    const optsText = 'A．选项1\nB、选项2';
    const lines = optsText.split('\n');
    const options = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const match = line.match(/^([A-D])[.、．]\s*(.+)$/);
      if (match) {
        options.push({ key: match[1], text: match[2] });
      }
    }
    expect(options.length).toBe(2);
    expect(options[0]).toEqual({ key: 'A', text: '选项1' });
    expect(options[1]).toEqual({ key: 'B', text: '选项2' });
  });

  test('选项解析应跳过空行', () => {
    const optsText = 'A.选项1\n\nB.选项2';
    const lines = optsText.split('\n');
    const options = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const match = line.match(/^([A-D])[.、．]\s*(.+)$/);
      if (match) {
        options.push({ key: match[1], text: match[2] });
      }
    }
    expect(options.length).toBe(2);
  });

  test('选项解析应忽略无效格式的行', () => {
    const optsText = 'A.选项1\n无效行\nB.选项2\nC.选项3';
    const lines = optsText.split('\n');
    const options = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const match = line.match(/^([A-D])[.、．]\s*(.+)$/);
      if (match) {
        options.push({ key: match[1], text: match[2] });
      }
    }
    expect(options.length).toBe(3);
    expect(options[0].key).toBe('A');
    expect(options[1].key).toBe('B');
    expect(options[2].key).toBe('C');
  });

  test('新增题目应正确添加到题库', () => {
    const originalLength = QUESTION_BANK.length;
    const newQuestion = {
      id: 'new001',
      category: '测试',
      question: '测试题目',
      options: [{ key: 'A', text: '选项A' }, { key: 'B', text: '选项B' }],
      answer: 'A',
      explanation: '测试解释'
    };
    QUESTION_BANK.push(newQuestion);
    expect(QUESTION_BANK.length).toBe(originalLength + 1);
    expect(QUESTION_BANK[QUESTION_BANK.length - 1].id).toBe('new001');
    expect(QUESTION_BANK[QUESTION_BANK.length - 1].question).toBe('测试题目');
  });

  test('编辑题目应正确更新题库', () => {
    const originalQuestion = QUESTION_BANK[0];
    const originalText = originalQuestion.question;
    QUESTION_BANK[0].question = '修改后的题目';
    expect(QUESTION_BANK[0].question).toBe('修改后的题目');
    expect(QUESTION_BANK[0].id).toBe(originalQuestion.id);
  });

  test('删除题目应正确从题库移除', () => {
    const originalLength = QUESTION_BANK.length;
    const idToDelete = QUESTION_BANK[0].id;
    QUESTION_BANK = QUESTION_BANK.filter(function(q) { return q.id !== idToDelete; });
    expect(QUESTION_BANK.length).toBe(originalLength - 1);
    expect(DB.findQ(idToDelete)).toBeNull();
  });

  test('题库应能正确过滤分类', () => {
    const catFilter = '专辑';
    const filtered = [];
    for (let i = 0; i < QUESTION_BANK.length; i++) {
      if (QUESTION_BANK[i].category === catFilter) {
        filtered.push(QUESTION_BANK[i]);
      }
    }
    expect(filtered.length).toBe(15);
  });

  test('题库应能正确搜索题目', () => {
    const search = '江南';
    const filtered = [];
    for (let i = 0; i < QUESTION_BANK.length; i++) {
      if (QUESTION_BANK[i].question.toLowerCase().indexOf(search) !== -1) {
        filtered.push(QUESTION_BANK[i]);
      }
    }
    expect(filtered.length).toBeGreaterThan(0);
    for (let i = 0; i < filtered.length; i++) {
      expect(filtered[i].question).toContain('江南');
    }
  });

  test('新增题目ID应唯一', () => {
    const ids = {};
    for (let i = 0; i < QUESTION_BANK.length; i++) {
      ids[QUESTION_BANK[i].id] = (ids[QUESTION_BANK[i].id] || 0) + 1;
    }
    for (const id in ids) {
      expect(ids[id]).toBe(1);
    }
  });

  test('答案应在选项范围内', () => {
    for (let i = 0; i < QUESTION_BANK.length; i++) {
      const q = QUESTION_BANK[i];
      const optionKeys = q.options.map(function(o) { return o.key; });
      expect(optionKeys).toContain(q.answer);
    }
  });
});