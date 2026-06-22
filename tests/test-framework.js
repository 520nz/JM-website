/**
 * 简易测试框架
 * 用于测试林俊杰粉丝答题网站的核心逻辑
 */

// 模拟 localStorage
class MockLocalStorage {
  constructor() {
    this.store = {};
  }
  
  getItem(key) {
    return this.store[key] || null;
  }
  
  setItem(key, value) {
    this.store[key] = value.toString();
  }
  
  removeItem(key) {
    delete this.store[key];
  }
  
  clear() {
    this.store = {};
  }
}

// 全局模拟 localStorage
global.localStorage = new MockLocalStorage();

// 测试工具函数
let testResults = [];
let passedCount = 0;
let failedCount = 0;

function test(name, fn) {
  try {
    fn();
    passedCount++;
    testResults.push({ name, passed: true });
    console.log(`✓ ${name}`);
  } catch (error) {
    failedCount++;
    testResults.push({ name, passed: false, error: error.message });
    console.log(`✗ ${name}`);
    console.log(`  Error: ${error.message}`);
  }
}

function assertEqual(actual, expected, message = '') {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(`${message}\nExpected: ${expectedStr}\nActual: ${actualStr}`);
  }
}

function assertTrue(value, message = '') {
  if (!value) {
    throw new Error(`${message}\nExpected true but got ${value}`);
  }
}

function assertFalse(value, message = '') {
  if (value) {
    throw new Error(`${message}\nExpected false but got ${value}`);
  }
}

function assertThrows(fn, expectedMessage = null, message = '') {
  let threw = false;
  let errorMsg = '';
  try {
    fn();
  } catch (e) {
    threw = true;
    errorMsg = e.message;
  }
  if (!threw) {
    throw new Error(`${message}\nExpected function to throw but it didn't`);
  }
  if (expectedMessage && errorMsg !== expectedMessage) {
    throw new Error(`${message}\nExpected error: "${expectedMessage}"\nActual error: "${errorMsg}"`);
  }
}

// 重置 localStorage 状态
function resetStorage() {
  global.localStorage.clear();
}

// 导出测试工具
module.exports = {
  test,
  assertEqual,
  assertTrue,
  assertFalse,
  assertThrows,
  resetStorage,
  MockLocalStorage,
  getResults: () => ({ passedCount, failedCount, testResults })
};