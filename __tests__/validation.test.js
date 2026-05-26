const quiz = require('../js/quiz');

describe('Data Validation', () => {
    describe('parseOptions', () => {
        test('should parse standard format options', () => {
            const input = 'A.选项1\nB.选项2\nC.选项3\nD.选项4';
            const result = quiz.parseOptions(input);
            
            expect(result.length).toBe(4);
            expect(result[0]).toEqual({ key: 'A', text: '选项1' });
            expect(result[1]).toEqual({ key: 'B', text: '选项2' });
            expect(result[2]).toEqual({ key: 'C', text: '选项3' });
            expect(result[3]).toEqual({ key: 'D', text: '选项4' });
        });

        test('should handle Chinese period separator', () => {
            const input = 'A．选项1\nB．选项2';
            const result = quiz.parseOptions(input);
            
            expect(result.length).toBe(2);
            expect(result[0]).toEqual({ key: 'A', text: '选项1' });
        });

        test('should handle full-width period separator', () => {
            const input = 'A、选项1\nB、选项2';
            const result = quiz.parseOptions(input);
            
            expect(result.length).toBe(2);
            expect(result[0]).toEqual({ key: 'A', text: '选项1' });
        });

        test('should handle extra spaces', () => {
            const input = 'A.  选项1\nB.选项2   \n C. 选项3';
            const result = quiz.parseOptions(input);
            
            expect(result.length).toBe(3);
            expect(result[0]).toEqual({ key: 'A', text: '选项1' });
            expect(result[1]).toEqual({ key: 'B', text: '选项2' });
            expect(result[2]).toEqual({ key: 'C', text: '选项3' });
        });

        test('should ignore empty lines', () => {
            const input = 'A.选项1\n\nB.选项2\n\n\nC.选项3';
            const result = quiz.parseOptions(input);
            
            expect(result.length).toBe(3);
        });

        test('should ignore invalid format lines', () => {
            const input = 'A.选项1\ninvalid line\nB.选项2\nC\nD.选项3';
            const result = quiz.parseOptions(input);
            
            expect(result.length).toBe(3);
            expect(result[0]).toEqual({ key: 'A', text: '选项1' });
            expect(result[1]).toEqual({ key: 'B', text: '选项2' });
            expect(result[2]).toEqual({ key: 'D', text: '选项3' });
        });

        test('should return empty array for empty input', () => {
            const result = quiz.parseOptions('');
            expect(result).toEqual([]);
        });

        test('should return empty array for whitespace only', () => {
            const result = quiz.parseOptions('   \n  \n');
            expect(result).toEqual([]);
        });

        test('should handle options with special characters', () => {
            const input = 'A.这是"选项"1\nB.选项包含,逗号\nC.选项&符号';
            const result = quiz.parseOptions(input);
            
            expect(result.length).toBe(3);
            expect(result[0].text).toBe('这是"选项"1');
            expect(result[1].text).toBe('选项包含,逗号');
            expect(result[2].text).toBe('选项&符号');
        });

        test('should handle multi-line option text correctly', () => {
            const input = 'A.第一行\nB.第二行\nC.第三行';
            const result = quiz.parseOptions(input);
            
            expect(result.length).toBe(3);
            expect(result[0].text).toBe('第一行');
            expect(result[1].text).toBe('第二行');
            expect(result[2].text).toBe('第三行');
        });

        test('should only accept A-D keys', () => {
            const input = 'A.选项1\nE.无效选项\nF.无效选项\nB.选项2';
            const result = quiz.parseOptions(input);
            
            expect(result.length).toBe(2);
            expect(result[0]).toEqual({ key: 'A', text: '选项1' });
            expect(result[1]).toEqual({ key: 'B', text: '选项2' });
        });
    });
});