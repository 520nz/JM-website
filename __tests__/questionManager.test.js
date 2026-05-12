// 题目管理模块测试
const { parseOptions, filterByCategory, searchQuestions, getCategories } = require('../src/questionManager');

describe('Question Manager Module', () => {
  describe('parseOptions function', () => {
    test('should parse simple options correctly', () => {
      const optsText = 'A.选项1\nB.选项2';
      const options = parseOptions(optsText);
      expect(options).toEqual([
        { key: 'A', text: '选项1' },
        { key: 'B', text: '选项2' }
      ]);
    });

    test('should handle different separators', () => {
      const optsText = 'A.选项1\nB、选项2\nC．选项3';
      const options = parseOptions(optsText);
      expect(options).toEqual([
        { key: 'A', text: '选项1' },
        { key: 'B', text: '选项2' },
        { key: 'C', text: '选项3' }
      ]);
    });

    test('should skip empty lines', () => {
      const optsText = 'A.选项1\n\nB.选项2\n\nC.选项3';
      const options = parseOptions(optsText);
      expect(options).toEqual([
        { key: 'A', text: '选项1' },
        { key: 'B', text: '选项2' },
        { key: 'C', text: '选项3' }
      ]);
    });

    test('should ignore invalid lines', () => {
      const optsText = 'A.选项1\n无效行\nB.选项2\nAnother invalid line';
      const options = parseOptions(optsText);
      expect(options).toEqual([
        { key: 'A', text: '选项1' },
        { key: 'B', text: '选项2' }
      ]);
    });

    test('should return empty array for empty input', () => {
      expect(parseOptions('')).toEqual([]);
    });
  });

  describe('filterByCategory function', () => {
    const testQuestions = [
      { id: '1', category: '专辑', question: '题目1' },
      { id: '2', category: '歌曲', question: '题目2' },
      { id: '3', category: '专辑', question: '题目3' },
      { id: '4', category: '获奖记录', question: '题目4' }
    ];

    test('should return all questions for empty category', () => {
      expect(filterByCategory(testQuestions, '')).toEqual(testQuestions);
      expect(filterByCategory(testQuestions, null)).toEqual(testQuestions);
    });

    test('should filter by category correctly', () => {
      const filtered = filterByCategory(testQuestions, '专辑');
      expect(filtered.length).toBe(2);
      expect(filtered[0].id).toBe('1');
      expect(filtered[1].id).toBe('3');
    });

    test('should return empty array for non-existent category', () => {
      expect(filterByCategory(testQuestions, '不存在的分类')).toEqual([]);
    });
  });

  describe('searchQuestions function', () => {
    const testQuestions = [
      { id: '1', category: '专辑', question: '林俊杰的首张专辑是什么？' },
      { id: '2', category: '歌曲', question: '江南是哪张专辑的歌曲？' },
      { id: '3', category: '专辑', question: '曹操专辑发行于哪一年？' }
    ];

    test('should return all questions for empty search', () => {
      expect(searchQuestions(testQuestions, '')).toEqual(testQuestions);
      expect(searchQuestions(testQuestions, null)).toEqual(testQuestions);
    });

    test('should search correctly', () => {
      const result = searchQuestions(testQuestions, '专辑');
      expect(result.length).toBe(3); // 所有题目都包含"专辑"
    });

    test('should find partial matches', () => {
      const result = searchQuestions(testQuestions, '江南');
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('2');
    });

    test('should return empty array for no matches', () => {
      expect(searchQuestions(testQuestions, '不存在的关键词')).toEqual([]);
    });
  });

  describe('getCategories function', () => {
    const testQuestions = [
      { id: '1', category: '专辑', question: '题目1' },
      { id: '2', category: '歌曲', question: '题目2' },
      { id: '3', category: '专辑', question: '题目3' },
      { id: '4', category: '获奖记录', question: '题目4' },
      { id: '5', category: '个人信息', question: '题目5' }
    ];

    test('should get all unique categories', () => {
      const categories = getCategories(testQuestions);
      expect(categories).toContain('专辑');
      expect(categories).toContain('个人信息');
      expect(categories).toContain('获奖记录');
      expect(categories).toContain('歌曲');
      expect(categories.length).toBe(4);
    });

    test('should return empty array for no questions', () => {
      expect(getCategories([])).toEqual([]);
    });
  });
});
