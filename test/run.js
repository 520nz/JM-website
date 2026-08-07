// ============================================================
// test/run.js - 轻量级测试运行器（describe/it + beforeEach/afterEach）
// ============================================================
const fs = require('fs');
const path = require('path');

const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';

const results = [];
let currentSuite = '';
let beforeHooks = [];
let afterHooks = [];

global.describe = (name, fn) => {
    const prevBefore = beforeHooks;
    const prevAfter = afterHooks;
    beforeHooks = [];
    afterHooks = [];
    currentSuite = name;
    console.log(`\n${BOLD}${CYAN}▲ ${name}${RESET}`);
    try {
        fn();
    } finally {
        beforeHooks = prevBefore;
        afterHooks = prevAfter;
    }
};

global.it = (name, fn) => {
    const fullName = `${currentSuite} › ${name}`;
    try {
        for (const h of beforeHooks) h();
        fn();
        for (const h of afterHooks) h();
        results.push({ ok: true, name: fullName });
        console.log(`  ${GREEN}✓${RESET} ${name}`);
    } catch (e) {
        results.push({ ok: false, name: fullName, err: e });
        console.log(`  ${RED}✗${RESET} ${name}`);
        console.log(`    ${RED}${e.stack}${RESET}`);
    }
};

global.beforeEach = (fn) => { beforeHooks.push(fn); };
global.afterEach = (fn) => { afterHooks.unshift(fn); };

const testDir = path.resolve(__dirname);
const files = fs.readdirSync(testDir)
    .filter(f => f.endsWith('.test.js'))
    .sort();

for (const f of files) {
    require(path.join(testDir, f));
}

const passed = results.filter(r => r.ok).length;
const failed = results.filter(r => !r.ok).length;
const total = results.length;

console.log(`\n${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
console.log(`${BOLD}总计: ${total}  ${GREEN}通过: ${passed}${RESET}  ${RED}失败: ${failed}${RESET}`);

if (failed > 0) {
    console.log(`\n${BOLD}${RED}失败详情:${RESET}`);
    results.filter(r => !r.ok).forEach(r => {
        console.log(`  ${RED}✗${RESET} ${r.name}`);
        console.log(`    ${YELLOW}${r.err.message}${RESET}`);
    });
    process.exit(1);
} else {
    console.log(`\n${GREEN}${BOLD}全部通过 ✓${RESET}`);
    process.exit(0);
}
