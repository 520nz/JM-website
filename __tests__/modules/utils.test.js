/**
 * 工具函数模块测试
 */

const {
  shuffle,
  fmtTime,
  parseOptions,
  validateQuestion,
  getCountByMode,
  calculateAccuracy
} = require('../../src/utils.js');

describe('工具函数模块', () => {
  describe('shuffle', () => {
    test('应返回新数组而非原数组', () => {
      const arr = [1, 2, 3, 4, 5];
      const shuffled = shuffle(arr);
      
      expect(shuffled).not.toBe(arr);
      expect(arr).toEqual([1, 2, 3, 4, 5]); // 原数组不变
    });

    test('打乱后应包含相同元素', () => {
      const arr = [1, 2, 3, 4, 5];
      const shuffled = shuffle(arr);
      
      expect(shuffled.sort()).toEqual(arr.sort());
    });

    test('空数组应返回空数组', () => {
      expect(shuffle([])).toEqual([]);
    });

    test('单元素数组应返回相同元素', () => {
      expect(shuffle([1])).toEqual([1]);
    });

    test('多次打乱应产生不同结果（概率性）', () => {
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const results = new Set();
      
      // 运行多次检查是否有不同的打乱结果
      for (let i = 0; i < 10; i++) {
        results.add(shuffle(arr).join(','));
      }
      
      // 至少应该有一些不同的结果
      expect(results.size).toBeGreaterThan(1);
    });
  });

  describe('fmtTime', () => {
    test('应正确格式化毫秒为分钟和秒', () => {
      expect(fmtTime(0)).toBe('0分0秒');
      expect(fmtTime(1000)).toBe('0分1秒');
      expect(fmtTime(60000)).toBe('1分0秒');
      expect(fmtTime(90000)).toBe('1分30秒');
      expect(fmtTime(3661000)).toBe('61分1秒');
    });

    test('应正确处理小数毫秒', () => {
      expect(fmtTime(1500)).toBe('0分1秒');
      expect(fmtTime(59999)).toBe('0分59秒');
    });
  });

  describe('parseOptions', () => {
    test('应正确解析标准格式选项', () => {
      const text = 'A.选项一\nB.选项二\nC.选项三\nD.选项四';
      const result = parseOptions(text);
      
      expect(result.length).toBe(4);
      expect(result[0]).toEqual({ key: 'A', text: '选项一' });
      expect(result[3]).toEqual({ key: 'D', text: '选项四' });
    });

    test('应支持中文顿号分隔', () => {
      const text = 'A、选项一\nB、选项二';
      const result = parseOptions(text);
      
      expect(result.length).toBe(2);
      expect(result[0]).toEqual({ key: 'A', text: '选项一' });
    });

    test('应支持全角点号', () => {
      const text = 'A．选项一\nB．选项二';
      const result = parseOptions(text);
      
      expect(result.length).toBe(2);
      expect(result[0]).toEqual({ key: 'A', text: '选项一' });
    });

    test('应忽略空行', () => {
      const text = 'A.选项一\n\nB.选项二\n';
      const result = parseOptions(text);
      
      expect(result.length).toBe(2);
    });

    test('应忽略无效格式行', () => {
      const text = 'A.选项一\n无效行\nB.选项二';
      const result = parseOptions(text);
      
      expect(result.length).toBe(2);
    });

    test('空字符串应返回空数组', () => {
      expect(parseOptions('')).toEqual([]);
      expect(parseOptions('\n\n')).toEqual([]);
    });
  });

  describe('validateQuestion', () => {
    const validQuestion = {
      id: '001',
      category: '专辑',
      question: '测试题目',
      options: [
        { key: 'A', text: '选项A' },
        { key: 'B', text: '选项B' }
      ],
      answer: 'A'
    };

    test('有效题目应通过验证', () => {
      const result = validateQuestion(validQuestion);
      
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    test('缺少ID应验证失败', () => {
      const q = Object.assign({}, validQuestion, { id: '' });
      const result = validateQuestion(q);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('题目ID必须是非空字符串');
    });

    test('缺少分类应验证失败', () => {
      const q = Object.assign({}, validQuestion, { category: '' });
      const result = validateQuestion(q);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('分类必须是非空字符串');
    });

    test('缺少题目内容应验证失败', () => {
      const q = Object.assign({}, validQuestion, { question: '' });
      const result = validateQuestion(q);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('题目内容必须是非空字符串');
    });

    test('选项少于2个应验证失败', () => {
      const q = Object.assign({}, validQuestion, { options: [{ key: 'A', text: '选项A' }] });
      const result = validateQuestion(q);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('选项必须是至少包含2个元素的数组');
    });

    test('选项key无效应验证失败', () => {
      const q = Object.assign({}, validQuestion, { 
        options: [{ key: 'X', text: '选项X' }, { key: 'Y', text: '选项Y' }]
      });
      const result = validateQuestion(q);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('选项key必须是A/B/C/D之一');
    });

    test('答案无效应验证失败', () => {
      const q = Object.assign({}, validQuestion, { answer: 'X' });
      const result = validateQuestion(q);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('答案必须是A/B/C/D之一');
    });

    test('多个错误应全部返回', () => {
      const q = { id: '', category: '', question: '', options: [], answer: '' };
      const result = validateQuestion(q);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('getCountByMode', () => {
    test('快速模式应返回10题', () => {
      expect(getCountByMode('quick')).toBe(10);
    });

    test('标准模式应返回20题', () => {
      expect(getCountByMode('standard')).toBe(20);
    });

    test('强化模式应返回30题', () => {
      expect(getCountByMode('intensive')).toBe(30);
    });

    test('未知模式应返回默认10题', () => {
      expect(getCountByMode('unknown')).toBe(10);
      expect(getCountByMode('')).toBe(10);
    });
  });

  describe('calculateAccuracy', () => {
    test('应正确计算正确率', () => {
      expect(calculateAccuracy(7, 10)).toBe(70);
      expect(calculateAccuracy(1, 3)).toBe(33);
      expect(calculateAccuracy(2, 3)).toBe(67);
    });

    test('全对应返回100', () => {
      expect(calculateAccuracy(10, 10)).toBe(100);
    });

    test('全错应返回0', () => {
      expect(calculateAccuracy(0, 10)).toBe(0);
    });

    test('总数为0应返回0', () => {
      expect(calculateAccuracy(0, 0)).toBe(0);
    });

    test('负数应正常处理', () => {
      expect(calculateAccuracy(-1, 10)).toBe(0);
      expect(calculateAccuracy(5, -1)).toBe(0);
    });
  });
});
