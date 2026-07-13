#!/usr/bin/env node
/**
 * Node.js 测试运行器 - 用于在命令行环境运行测试
 * 使用方式: node tests/node-test-runner.js
 */

// 模拟浏览器环境
const fs = require('fs');
const path = require('path');

// 创建模拟的 localStorage 和 sessionStorage
const localStorageData = {};
const sessionStorageData = {};

global.localStorage = {
    getItem: (key) => localStorageData[key] || null,
    setItem: (key, value) => { localStorageData[key] = String(value); },
    removeItem: (key) => { delete localStorageData[key]; },
    clear: () => { for (const k in localStorageData) delete localStorageData[k]; }
};

global.sessionStorage = {
    getItem: (key) => sessionStorageData[key] || null,
    setItem: (key, value) => { sessionStorageData[key] = String(value); },
    removeItem: (key) => { delete sessionStorageData[key]; },
    clear: () => { for (const k in sessionStorageData) delete sessionStorageData[k]; }
};

// 模拟 document - 支持 esc() 函数的 DOM API
global.document = {
    createElement: (tag) => {
        let textContent = '';
        return {
            get textContent() { return textContent; },
            set textContent(v) { textContent = String(v); },
            get innerHTML() {
                // 简化的 HTML 转义实现
                return textContent
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;');
            },
            className: '',
            style: {},
            value: ''
        };
    },
    getElementById: (id) => ({ textContent: '', innerHTML: '', className: '', style: {}, value: '' }),
    querySelectorAll: () => [],
    addEventListener: () => {}
};

global.window = { addEventListener: () => {} };

// 加载生产代码
const dataCode = fs.readFileSync(path.join(__dirname, '../js/data.js'), 'utf8');
const storageCode = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');

eval(dataCode);
eval(storageCode);

// 确保 DEFAULT_QUESTION_BANK
if (typeof DEFAULT_QUESTION_BANK === 'undefined') {
    DEFAULT_QUESTION_BANK = QUESTION_BANK.slice();
}

// 模拟 QuestionStore
QuestionStore = {
    save: () => localStorage.setItem('jj_question_bank', JSON.stringify(QUESTION_BANK)),
    load: () => {
        const saved = localStorage.getItem('jj_question_bank');
        if (saved) try { QUESTION_BANK = JSON.parse(saved); } catch(e) {}
    },
    reset: () => {
        localStorage.removeItem('jj_question_bank');
        QUESTION_BANK = DEFAULT_QUESTION_BANK.slice();
    }
};

// ==================== 测试框架 ====================

class NodeTestRunner {
    constructor() {
        this.groups = {};
        this.results = [];
        this.passed = 0;
        this.failed = 0;
        this.skipped = 0;
    }

    register(name, tests) {
        this.groups[name] = tests;
    }

    runTest(testName, testFn) {
        try {
            testFn();
            return { name: testName, status: 'pass', error: null };
        } catch (e) {
            return { name: testName, status: 'fail', error: e.message || String(e) };
        }
    }

    runAll() {
        this.results = [];
        this.passed = 0;
        this.failed = 0;
        this.skipped = 0;

        // 清除存储
        localStorage.clear();
        sessionStorage.clear();
        if (DB.clearCache) DB.clearCache();

        for (const groupName in this.groups) {
            const tests = this.groups[groupName];
            const groupResults = { name: groupName, tests: [] };
            let groupPassed = 0, groupFailed = 0;

            for (const testName in tests) {
                if (tests[testName] === null) {
                    groupResults.tests.push({ name: testName, status: 'skip', error: '跳过' });
                    this.skipped++;
                } else {
                    const result = this.runTest(testName, tests[testName]);
                    groupResults.tests.push(result);
                    if (result.status === 'pass') { this.passed++; groupPassed++; }
                    else { this.failed++; groupFailed++; }
                }
            }
            groupResults.passed = groupPassed;
            groupResults.failed = groupFailed;
            this.results.push(groupResults);
        }

        this.printResults();
    }

    printResults() {
        console.log('\n' + '='.repeat(60));
        console.log('  JJ Quiz App 测试结果');
        console.log('='.repeat(60) + '\n');

        const GREEN = '\x1b[32m';
        const RED = '\x1b[31m';
        const YELLOW = '\x1b[33m';
        const RESET = '\x1b[0m';
        const CYAN = '\x1b[36m';

        for (const group of this.results) {
            console.log(CYAN + '【' + group.name + '】' + RESET);
            console.log('  ' + group.passed + '/' + (group.passed + group.failed) + ' 通过');
            
            for (const test of group.tests) {
                const statusIcon = test.status === 'pass' ? GREEN + '✓' : 
                                   test.status === 'fail' ? RED + '✗' : YELLOW + '⊘';
                const statusText = test.status === 'pass' ? '通过' :
                                   test.status === 'fail' ? '失败' : '跳过';
                
                console.log('    ' + statusIcon + ' ' + test.name + RESET);
                if (test.error && test.status === 'fail') {
                    console.log(RED + '      错误: ' + test.error + RESET);
                }
            }
            console.log('');
        }

        console.log('='.repeat(60));
        console.log('  总计: ' + GREEN + this.passed + ' 通过' + RESET + 
                    ', ' + RED + this.failed + ' 失败' + RESET +
                    ', ' + YELLOW + this.skipped + ' 跳过' + RESET);
        console.log('='.repeat(60) + '\n');

        if (this.failed > 0) {
            process.exit(1);
        }
    }
}

// 断言函数
function assertEqual(actual, expected, msg) {
    if (actual !== expected) {
        throw new Error((msg || '') + ' 期望: ' + JSON.stringify(expected) + ', 实际: ' + JSON.stringify(actual));
    }
}

function assertDeepEqual(actual, expected, msg) {
    const actualStr = JSON.stringify(actual);
    const expectedStr = JSON.stringify(expected);
    if (actualStr !== expectedStr) {
        throw new Error((msg || '') + ' 期望: ' + expectedStr + ', 实际: ' + actualStr);
    }
}

function assertTrue(value, msg) {
    if (!value) throw new Error(msg || '期望 true，实际 false');
}

function assertFalse(value, msg) {
    if (value) throw new Error(msg || '期望 false，实际 true');
}

// 创建全局 TestRunner
TestRunner = new NodeTestRunner();

// ==================== 加载测试文件 ====================

// 读取并执行测试文件
const testStorage = fs.readFileSync(path.join(__dirname, 'test-storage.js'), 'utf8');
const testQuiz = fs.readFileSync(path.join(__dirname, 'test-quiz.js'), 'utf8');
const testAdmin = fs.readFileSync(path.join(__dirname, 'test-admin.js'), 'utf8');

eval(testStorage);
eval(testQuiz);
eval(testAdmin);

// 运行测试
TestRunner.runAll();