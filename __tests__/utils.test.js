const { shuffle, fmtTime } = require('../src/utils');

describe('Utils 工具函数', () => {
  describe('shuffle 函数', () => {
    test('应该返回一个与原数组长度相同的数组', () => {
      const arr = [1, 2, 3, 4, 5];
      const result = shuffle(arr);
      expect(result.length).toBe(arr.length);
    });

    test('应该包含原数组的所有元素', () => {
      const arr = [1, 2, 3, 4, 5];
      const result = shuffle(arr);
      expect(result.sort()).toEqual(arr.sort());
    });

    test('不应该修改原数组', () => {
      const arr = [1, 2, 3, 4, 5];
      const originalArr = [...arr];
      shuffle(arr);
      expect(arr).toEqual(originalArr);
    });

    test('对于空数组，应该返回空数组', () => {
      expect(shuffle([])).toEqual([]);
    });

    test('对于单元素数组，应该返回相同的数组', () => {
      const arr = [1];
      expect(shuffle(arr)).toEqual(arr);
    });
  });

  describe('fmtTime 函数', () => {
    test('应该正确格式化毫秒为时间字符串', () => {
      expect(fmtTime(0)).toBe('0分0秒');
      expect(fmtTime(500)).toBe('0分0秒');
      expect(fmtTime(1000)).toBe('0分1秒');
      expect(fmtTime(60000)).toBe('1分0秒');
      expect(fmtTime(61000)).toBe('1分1秒');
      expect(fmtTime(125000)).toBe('2分5秒');
    });
  });
});
