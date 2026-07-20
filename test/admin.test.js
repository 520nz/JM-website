require('../js/data.js');
require('../js/storage.js');
require('../js/quiz.js');
require('../js/admin.js');

describe('admin.js - 选项解析逻辑', () => {
    function parseOptions(optsText) {
        var lines = optsText.split('\n');
        var options = [];
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;
            var match = line.match(/^([A-Z])[.、．]\s*(.+)$/);
            if (match) {
                options.push({ key: match[1], text: match[2] });
            }
        }
        return options;
    }

    test('应正确解析标准格式选项', () => {
        const opts = parseOptions('A.选项1\nB.选项2\nC.选项3\nD.选项4');
        expect(opts.length).toBe(4);
        expect(opts[0]).toEqual({ key: 'A', text: '选项1' });
        expect(opts[1]).toEqual({ key: 'B', text: '选项2' });
        expect(opts[2]).toEqual({ key: 'C', text: '选项3' });
        expect(opts[3]).toEqual({ key: 'D', text: '选项4' });
    });

    test('应正确解析带空格的选项', () => {
        const opts = parseOptions('A. 第一个选项\nB. 第二个选项');
        expect(opts.length).toBe(2);
        expect(opts[0]).toEqual({ key: 'A', text: '第一个选项' });
        expect(opts[1]).toEqual({ key: 'B', text: '第二个选项' });
    });

    test('应忽略空行', () => {
        const opts = parseOptions('A.选项1\n\nB.选项2\n\nC.选项3');
        expect(opts.length).toBe(3);
    });

    test('应支持中文句号格式', () => {
        const opts = parseOptions('A．选项1\nB．选项2');
        expect(opts.length).toBe(2);
        expect(opts[0]).toEqual({ key: 'A', text: '选项1' });
    });

    test('应支持中文顿号格式', () => {
        const opts = parseOptions('A、选项1\nB、选项2');
        expect(opts.length).toBe(2);
        expect(opts[0]).toEqual({ key: 'A', text: '选项1' });
    });

    test('应忽略无效格式的行', () => {
        const opts = parseOptions('A.选项1\n无效行\nB.选项2\n123\nC.选项3');
        expect(opts.length).toBe(3);
    });

    test('应解析带特殊字符的选项', () => {
        const opts = parseOptions('A.<script>test</script>\nB."引号测试"\nC.特殊&字符');
        expect(opts.length).toBe(3);
        expect(opts[0].text).toBe('<script>test</script>');
        expect(opts[1].text).toBe('"引号测试"');
    });
});

describe('admin.js - 分类统计', () => {
    test('应正确提取分类', () => {
        const cats = {};
        for (var i = 0; i < window.App.QUESTION_BANK.length; i++) {
            cats[window.App.QUESTION_BANK[i].category] = true;
        }
        expect(Object.keys(cats)).toContain('专辑');
        expect(Object.keys(cats)).toContain('歌曲');
        expect(Object.keys(cats)).toContain('个人信息');
        expect(Object.keys(cats)).toContain('获奖记录');
    });
});