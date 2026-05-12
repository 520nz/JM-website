// 工具函数模块测试
const { shuffle, fmtTime } = require('../src/utils');

describe('Utils Module', () => {
  describe('shuffle function', () => {
    test('should return array of same length', () => {
      const arr = [1, 2, 3, 4, 5];
      const shuffled = shuffle(arr);
      expect(shuffled.length).toBe(arr.length);
    });

    test('should not modify original array', () => {
      const arr = [1, 2, 3, 4, 5];
      const arrCopy = [...arr];
      shuffle(arr);
      expect(arr).toEqual(arrCopy);
    });

    test('should contain all original elements', () => {
      const arr = [1, 2, 3, 4, 5];
      const shuffled = shuffle(arr);
      const sorted = [...shuffled].sort((a, b) => a - b);
      expect(sorted).toEqual(arr);
    });

    test('should work with empty array', () => {
      expect(shuffle([])).toEqual([]);
    });

    test('should work with single element array', () => {
      expect(shuffle([42])).toEqual([42]);
    });
  });

  describe('fmtTime function', () => {
    test('should format 0 milliseconds correctly', () => {
      expect(fmtTime(0)).toBe('0分0秒');
    });

    test('should format less than 1 minute correctly', () => {
      expect(fmtTime(30000)).toBe('0分30秒');
      expect(fmtTime(59999)).toBe('0分59秒');
    });

    test('should format minutes and seconds correctly', () => {
      expect(fmtTime(60000)).toBe('1分0秒');
      expect(fmtTime(90000)).toBe('1分30秒');
      expect(fmtTime(120000)).toBe('2分0秒');
      expect(fmtTime(150000)).toBe('2分30秒');
    });

    test('should truncate milliseconds', () => {
      expect(fmtTime(60500)).toBe('1分0秒'); // 60.5秒 → 1分0秒
    });
  });
});
