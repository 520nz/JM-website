// 测试：验证 QuestionStore.load() 不会污染 DEFAULT_QUESTION_BANK

// 模拟浏览器环境的 localStorage
var localStorageMock = (function() {
    var store = {};
    return {
        getItem: function(key) { return store[key] || null; },
        setItem: function(key, value) { store[key] = value; },
        removeItem: function(key) { delete store[key]; }
    };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// 加载 data.js
var fs = require('fs');
eval(fs.readFileSync('./js/data.js', 'utf8'));

// 记录原始默认题库的数量和第一个题目的ID
var originalCount = DEFAULT_QUESTION_BANK.length;
var originalFirstId = DEFAULT_QUESTION_BANK[0].id;
console.log('原始默认题库数量:', originalCount);
console.log('原始默认题库第一题ID:', originalFirstId);

// 加载 storage.js（会定义 QuestionStore）
eval(fs.readFileSync('./js/storage.js', 'utf8'));

// 模拟：用户修改了题库并保存
var modifiedBank = QUESTION_BANK.slice(0, 5); // 只保留前5题
QUESTION_BANK = modifiedBank;
QuestionStore.save();
console.log('\n用户修改后，保存到 localStorage 的题目数:', modifiedBank.length);

// 模拟：页面刷新，调用 QuestionStore.load()
QuestionStore.load();
console.log('load() 后 QUESTION_BANK 数量:', QUESTION_BANK.length);

// 关键检查：DEFAULT_QUESTION_BANK 是否被污染
console.log('\n=== 关键检查 ===');
console.log('DEFAULT_QUESTION_BANK 数量:', DEFAULT_QUESTION_BANK.length);
console.log('原始数量:', originalCount);

if (DEFAULT_QUESTION_BANK.length === originalCount) {
    console.log('\n✅ PASS: DEFAULT_QUESTION_BANK 未被污染，保持原始数量');
} else {
    console.log('\n❌ FAIL: DEFAULT_QUESTION_BANK 被污染了！');
    process.exit(1);
}

// 测试 reset() 功能
QuestionStore.reset();
console.log('\nreset() 后 QUESTION_BANK 数量:', QUESTION_BANK.length);

if (QUESTION_BANK.length === originalCount) {
    console.log('✅ PASS: reset() 正确恢复了默认题库数量');
} else {
    console.log('❌ FAIL: reset() 未能恢复默认题库数量');
    process.exit(1);
}

if (QUESTION_BANK[0].id === originalFirstId) {
    console.log('✅ PASS: reset() 后第一题ID正确，数据一致');
} else {
    console.log('❌ FAIL: reset() 后题目数据不一致');
    process.exit(1);
}

console.log('\n🎉 所有测试通过！Bug 已修复。');
