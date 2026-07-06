const { parseOptions, validateQuestionData, QUESTION_BANK, DEFAULT_QUESTION_BANK } = require('../src/app');

describe('Admin/Question Management', () => {
    describe('parseOptions()', () => {
        it('should parse options with period separator', () => {
            const optsText = 'A.选项1\nB.选项2\nC.选项3\nD.选项4';
            const options = parseOptions(optsText);
            
            expect(options.length).toBe(4);
            expect(options[0]).toEqual({ key: 'A', text: '选项1' });
            expect(options[1]).toEqual({ key: 'B', text: '选项2' });
            expect(options[2]).toEqual({ key: 'C', text: '选项3' });
            expect(options[3]).toEqual({ key: 'D', text: '选项4' });
        });

        it('should parse options with Chinese period separator', () => {
            const optsText = 'A．选项1\nB．选项2';
            const options = parseOptions(optsText);
            
            expect(options.length).toBe(2);
            expect(options[0]).toEqual({ key: 'A', text: '选项1' });
            expect(options[1]).toEqual({ key: 'B', text: '选项2' });
        });

        it('should parse options with Chinese comma separator', () => {
            const optsText = 'A、选项1\nB、选项2';
            const options = parseOptions(optsText);
            
            expect(options.length).toBe(2);
            expect(options[0]).toEqual({ key: 'A', text: '选项1' });
            expect(options[1]).toEqual({ key: 'B', text: '选项2' });
        });

        it('should handle extra whitespace', () => {
            const optsText = 'A.  选项1  \nB.选项2\n\nC. 选项3\n\n\nD.选项4';
            const options = parseOptions(optsText);
            
            expect(options.length).toBe(4);
            expect(options[0]).toEqual({ key: 'A', text: '选项1' });
            expect(options[1]).toEqual({ key: 'B', text: '选项2' });
            expect(options[2]).toEqual({ key: 'C', text: '选项3' });
            expect(options[3]).toEqual({ key: 'D', text: '选项4' });
        });

        it('should handle lowercase keys', () => {
            const optsText = 'a.选项1\nb.选项2';
            const options = parseOptions(optsText);
            expect(options.length).toBe(0);
        });

        it('should handle invalid format', () => {
            const optsText = '选项1\n选项2\n选项3\n选项4';
            const options = parseOptions(optsText);
            expect(options.length).toBe(0);
        });

        it('should handle mixed valid and invalid lines', () => {
            const optsText = 'A.选项1\n无效行\nB.选项2\nC.选项3\n\nD.选项4';
            const options = parseOptions(optsText);
            
            expect(options.length).toBe(4);
            expect(options[0]).toEqual({ key: 'A', text: '选项1' });
            expect(options[1]).toEqual({ key: 'B', text: '选项2' });
            expect(options[2]).toEqual({ key: 'C', text: '选项3' });
            expect(options[3]).toEqual({ key: 'D', text: '选项4' });
        });

        it('should handle empty input', () => {
            const options = parseOptions('');
            expect(options.length).toBe(0);
        });

        it('should handle only whitespace', () => {
            const options = parseOptions('   \n  \n   ');
            expect(options.length).toBe(0);
        });

        it('should handle options with special characters', () => {
            const optsText = 'A.选项包含特殊字符@#$%\nB.选项包含中文，英文和数字123\nC.选项包含括号()[]{}';
            const options = parseOptions(optsText);
            
            expect(options.length).toBe(3);
            expect(options[0].text).toBe('选项包含特殊字符@#$%');
            expect(options[1].text).toBe('选项包含中文，英文和数字123');
            expect(options[2].text).toBe('选项包含括号()[]{}');
        });
    });

    describe('validateQuestionData()', () => {
        it('should return true for valid question data', () => {
            const result = validateQuestionData('测试题目', 'A.选项1\nB.选项2');
            expect(result).toBe(true);
        });

        it('should return false when question is empty', () => {
            const result = validateQuestionData('', 'A.选项1\nB.选项2');
            expect(result).toBe(false);
        });

        it('should return false when options is empty', () => {
            const result = validateQuestionData('测试题目', '');
            expect(result).toBe(false);
        });

        it('should return false when options has less than 2 valid options', () => {
            const result = validateQuestionData('测试题目', 'A.选项1');
            expect(result).toBe(false);
        });

        it('should return false when options has invalid format', () => {
            const result = validateQuestionData('测试题目', '选项1\n选项2');
            expect(result).toBe(false);
        });

        it('should return true when options has exactly 2 valid options', () => {
            const result = validateQuestionData('测试题目', 'A.选项1\nB.选项2');
            expect(result).toBe(true);
        });

        it('should return true when options has more than 2 valid options', () => {
            const result = validateQuestionData('测试题目', 'A.选项1\nB.选项2\nC.选项3');
            expect(result).toBe(true);
        });
    });

    describe('QUESTION_BANK', () => {
        it('should have default questions', () => {
            expect(QUESTION_BANK.length).toBeGreaterThan(0);
        });

        it('should have questions with required fields', () => {
            const q = QUESTION_BANK[0];
            expect(q.id).toBeDefined();
            expect(q.category).toBeDefined();
            expect(q.question).toBeDefined();
            expect(q.options).toBeDefined();
            expect(q.answer).toBeDefined();
            expect(q.explanation).toBeDefined();
        });

        it('should have valid options structure', () => {
            const q = QUESTION_BANK[0];
            expect(Array.isArray(q.options)).toBe(true);
            expect(q.options.length).toBeGreaterThanOrEqual(2);
            q.options.forEach(opt => {
                expect(opt.key).toBeDefined();
                expect(opt.text).toBeDefined();
            });
        });

        it('should have unique question IDs', () => {
            const ids = QUESTION_BANK.map(q => q.id);
            const uniqueIds = [...new Set(ids)];
            expect(ids.length).toBe(uniqueIds.length);
        });

        it('should have valid answer keys', () => {
            QUESTION_BANK.forEach(q => {
                const validKeys = q.options.map(opt => opt.key);
                expect(validKeys).toContain(q.answer);
            });
        });
    });

    describe('DEFAULT_QUESTION_BANK', () => {
        it('should be a copy of initial QUESTION_BANK', () => {
            expect(DEFAULT_QUESTION_BANK.length).toBe(QUESTION_BANK.length);
        });

        it('should not be affected by changes to QUESTION_BANK', () => {
            const originalLength = DEFAULT_QUESTION_BANK.length;
            QUESTION_BANK.push({ id: 'test', category: '测试', question: '测试', options: [], answer: 'A', explanation: '' });
            expect(DEFAULT_QUESTION_BANK.length).toBe(originalLength);
        });
    });

    describe('Question Categories', () => {
        it('should have defined categories', () => {
            const categories = new Set(QUESTION_BANK.map(q => q.category));
            expect(categories.size).toBeGreaterThan(0);
            expect(categories.has('专辑')).toBe(true);
            expect(categories.has('歌曲')).toBe(true);
            expect(categories.has('个人信息')).toBe(true);
            expect(categories.has('获奖记录')).toBe(true);
        });

        it('should have reasonable distribution across categories', () => {
            const catCounts = {};
            QUESTION_BANK.forEach(q => {
                catCounts[q.category] = (catCounts[q.category] || 0) + 1;
            });
            
            expect(catCounts['专辑']).toBeGreaterThan(0);
            expect(catCounts['歌曲']).toBeGreaterThan(0);
            expect(catCounts['个人信息']).toBeGreaterThan(0);
            expect(catCounts['获奖记录']).toBeGreaterThan(0);
        });
    });
});