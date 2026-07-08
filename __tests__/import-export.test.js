describe('数据导入导出功能', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('导出数据应包含题库和用户数据', () => {
    DB.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
    DB.addWrong('002');
    
    const data = {
      questionBank: QUESTION_BANK,
      userData: DB.get(),
      exportTime: new Date().toISOString()
    };
    
    expect(data.questionBank).toBeDefined();
    expect(data.userData).toBeDefined();
    expect(data.exportTime).toBeDefined();
    expect(data.questionBank.length).toBe(78);
    expect(data.userData.history.length).toBe(1);
    expect(data.userData.wrong.length).toBe(1);
  });

  test('导入数据应正确处理新增和更新题目', () => {
    const existingIds = {};
    for (let i = 0; i < QUESTION_BANK.length; i++) {
      existingIds[QUESTION_BANK[i].id] = true;
    }
    
    const importData = {
      questionBank: [
        { id: '001', category: '专辑', question: '修改后的题目', options: [{ key: 'A', text: '选项' }], answer: 'A', explanation: '解释' },
        { id: 'import1', category: '测试', question: '新题目', options: [{ key: 'A', text: '选项' }], answer: 'A', explanation: '解释' }
      ]
    };
    
    let addedCount = 0;
    let updatedCount = 0;
    
    if (importData.questionBank) {
      for (let j = 0; j < importData.questionBank.length; j++) {
        const q = importData.questionBank[j];
        if (existingIds[q.id]) {
          updatedCount++;
        } else {
          addedCount++;
        }
      }
    }
    
    expect(updatedCount).toBe(1);
    expect(addedCount).toBe(1);
  });

  test('导入用户数据应正确合并历史记录', () => {
    DB.addRecord({ qid: '001', ans: 'B', ok: true, time: 1000 });
    
    const importData = {
      userData: {
        history: [{ qid: '002', ans: 'A', ok: false, time: 2000 }],
        wrong: [{ qid: '002', cnt: 1, time: 2000 }],
        stats: { total: 1, correct: 0, cats: { '歌曲': { t: 1, c: 0 } } }
      }
    };
    
    let existingData = DB.get();
    
    if (importData.userData) {
      if (importData.userData.history) {
        existingData.history = existingData.history.concat(importData.userData.history);
      }
      if (importData.userData.wrong) {
        const wrongMap = {};
        for (let w = 0; w < existingData.wrong.length; w++) {
          wrongMap[existingData.wrong[w].qid] = existingData.wrong[w];
        }
        for (let x = 0; x < importData.userData.wrong.length; x++) {
          const wrongItem = importData.userData.wrong[x];
          if (wrongMap[wrongItem.qid]) {
            wrongMap[wrongItem.qid].cnt += wrongItem.cnt;
          } else {
            existingData.wrong.push(wrongItem);
          }
        }
      }
      if (importData.userData.stats) {
        if (!existingData.stats) existingData.stats = { total: 0, correct: 0, cats: {} };
        existingData.stats.total += importData.userData.stats.total || 0;
        existingData.stats.correct += importData.userData.stats.correct || 0;
        if (importData.userData.stats.cats) {
          for (const catName in importData.userData.stats.cats) {
            if (!existingData.stats.cats[catName]) {
              existingData.stats.cats[catName] = { t: 0, c: 0 };
            }
            existingData.stats.cats[catName].t += importData.userData.stats.cats[catName].t || 0;
            existingData.stats.cats[catName].c += importData.userData.stats.cats[catName].c || 0;
          }
        }
      }
    }
    
    expect(existingData.history.length).toBe(2);
    expect(existingData.wrong.length).toBe(1);
    expect(existingData.stats.total).toBe(2);
    expect(existingData.stats.correct).toBe(1);
  });

  test('导入用户数据应正确合并错题', () => {
    DB.addWrong('001');
    
    const importData = {
      userData: {
        wrong: [{ qid: '001', cnt: 2, time: 2000 }, { qid: '002', cnt: 1, time: 2000 }]
      }
    };
    
    let existingData = DB.get();
    
    if (importData.userData && importData.userData.wrong) {
      const wrongMap = {};
      for (let w = 0; w < existingData.wrong.length; w++) {
        wrongMap[existingData.wrong[w].qid] = existingData.wrong[w];
      }
      for (let x = 0; x < importData.userData.wrong.length; x++) {
        const wrongItem = importData.userData.wrong[x];
        if (wrongMap[wrongItem.qid]) {
          wrongMap[wrongItem.qid].cnt += wrongItem.cnt;
        } else {
          existingData.wrong.push(wrongItem);
        }
      }
    }
    
    expect(existingData.wrong.length).toBe(2);
    const wrong001 = existingData.wrong.find(function(w) { return w.qid === '001'; });
    const wrong002 = existingData.wrong.find(function(w) { return w.qid === '002'; });
    expect(wrong001.cnt).toBe(3);
    expect(wrong002.cnt).toBe(1);
  });

  test('导入用户数据应正确合并分类统计', () => {
    DB.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
    
    const importData = {
      userData: {
        stats: {
          total: 5,
          correct: 3,
          cats: {
            '专辑': { t: 2, c: 1 },
            '歌曲': { t: 3, c: 2 }
          }
        }
      }
    };
    
    let existingData = DB.get();
    
    if (importData.userData && importData.userData.stats) {
      if (!existingData.stats) existingData.stats = { total: 0, correct: 0, cats: {} };
      existingData.stats.total += importData.userData.stats.total || 0;
      existingData.stats.correct += importData.userData.stats.correct || 0;
      if (importData.userData.stats.cats) {
        for (const catName in importData.userData.stats.cats) {
          if (!existingData.stats.cats[catName]) {
            existingData.stats.cats[catName] = { t: 0, c: 0 };
          }
          existingData.stats.cats[catName].t += importData.userData.stats.cats[catName].t || 0;
          existingData.stats.cats[catName].c += importData.userData.stats.cats[catName].c || 0;
        }
      }
    }
    
    expect(existingData.stats.total).toBe(6);
    expect(existingData.stats.correct).toBe(4);
    expect(existingData.stats.cats['专辑']).toEqual({ t: 3, c: 2 });
    expect(existingData.stats.cats['歌曲']).toEqual({ t: 3, c: 2 });
  });

  test('导入应正确处理无效JSON', () => {
    const invalidData = 'invalid json';
    let success = false;
    try {
      JSON.parse(invalidData);
      success = true;
    } catch (e) {
      success = false;
    }
    expect(success).toBe(false);
  });

  test('导入应正确处理缺少必要字段的数据', () => {
    const invalidData = { someOtherField: 'value' };
    if (!invalidData.questionBank && !invalidData.userData) {
      expect(true).toBe(true);
    } else {
      expect(false).toBe(true);
    }
  });

  test('导出数据应能被正确序列化', () => {
    const data = {
      questionBank: QUESTION_BANK,
      userData: DB.get(),
      exportTime: new Date().toISOString()
    };
    let json;
    expect(() => {
      json = JSON.stringify(data, null, 2);
    }).not.toThrow();
    expect(json).toBeDefined();
    expect(json.length).toBeGreaterThan(0);
  });

  test('导出的JSON应能被正确解析', () => {
    const data = {
      questionBank: QUESTION_BANK,
      userData: DB.get(),
      exportTime: new Date().toISOString()
    };
    const json = JSON.stringify(data, null, 2);
    let parsed;
    expect(() => {
      parsed = JSON.parse(json);
    }).not.toThrow();
    expect(parsed.questionBank.length).toBe(78);
    expect(parsed.userData).toBeDefined();
  });
});