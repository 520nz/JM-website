// 轻量级测试运行器

const results = { passed: 0, failed: 0, errors: [] };
let currentSuite = '';
let beforeEachFn = null;

function describe(name, fn) {
  currentSuite = name;
  beforeEachFn = null;
  console.log(`\n📦 ${name}`);
  console.log('─'.repeat(40));
  fn();
}

function beforeEach(fn) {
  beforeEachFn = fn;
}

function it(name, fn) {
  try {
    if (beforeEachFn) beforeEachFn();
    fn();
    results.passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    results.failed++;
    results.errors.push({ suite: currentSuite, name, error: err });
    console.log(`  ❌ ${name}`);
    console.log(`     ${err.message}`);
  }
}

function expect(actual) {
  const makeChain = (negate) => {
    const api = {
      toBe(expected) {
        const pass = actual !== expected;
        if (negate ? !pass : pass) {
          throw new Error(`Expected ${JSON.stringify(actual)} ${negate ? 'not ' : ''}to be ${JSON.stringify(expected)}`);
        }
      },
      toEqual(expected) {
        const pass = JSON.stringify(actual) !== JSON.stringify(expected);
        if (negate ? !pass : pass) {
          throw new Error(`Expected ${JSON.stringify(actual)} ${negate ? 'not ' : ''}to equal ${JSON.stringify(expected)}`);
        }
      },
      toBeTruthy() {
        const pass = !actual;
        if (negate ? !pass : pass) {
          throw new Error(`Expected ${JSON.stringify(actual)} ${negate ? 'not ' : ''}to be truthy`);
        }
      },
      toBeFalsy() {
        const pass = actual;
        if (negate ? !pass : pass) {
          throw new Error(`Expected ${JSON.stringify(actual)} ${negate ? 'not ' : ''}to be falsy`);
        }
      },
      toContain(value) {
        let pass;
        if (typeof actual === 'string') {
          pass = !actual.includes(value);
        } else if (Array.isArray(actual)) {
          pass = !actual.includes(value);
        } else {
          throw new Error(`Cannot check contains on ${typeof actual}`);
        }
        if (negate ? !pass : pass) {
          throw new Error(`Expected ${JSON.stringify(actual)} ${negate ? 'not ' : ''}to contain ${JSON.stringify(value)}`);
        }
      },
      toBeGreaterThan(expected) {
        const pass = actual <= expected;
        if (negate ? !pass : pass) {
          throw new Error(`Expected ${actual} ${negate ? 'not ' : ''}> ${expected}`);
        }
      },
      toBeLessThan(expected) {
        const pass = actual >= expected;
        if (negate ? !pass : pass) {
          throw new Error(`Expected ${actual} ${negate ? 'not ' : ''}< ${expected}`);
        }
      },
      toBeBetween(min, max) {
        const pass = actual < min || actual > max;
        if (negate ? !pass : pass) {
          throw new Error(`Expected ${actual} ${negate ? 'not ' : ''}to be between ${min} and ${max}`);
        }
      },
      toHaveLength(n) {
        const pass = actual.length !== n;
        if (negate ? !pass : pass) {
          throw new Error(`Expected length ${actual.length} ${negate ? 'not ' : ''}to be ${n}`);
        }
      },
      toHaveProperty(key) {
        const pass = !(key in actual);
        if (negate ? !pass : pass) {
          throw new Error(`Expected object ${negate ? 'not ' : ''}to have property "${key}"`);
        }
      },
      toBeInstanceOf(klass) {
        const pass = !(actual instanceof klass);
        if (negate ? !pass : pass) {
          throw new Error(`Expected ${negate ? 'not ' : ''}to be instance of ${klass.name}`);
        }
      },
      toBeAnArray() {
        const pass = !Array.isArray(actual);
        if (negate ? !pass : pass) {
          throw new Error(`Expected ${JSON.stringify(actual)} ${negate ? 'not ' : ''}to be an array`);
        }
      },
      toBeAFunction() {
        const pass = typeof actual !== 'function';
        if (negate ? !pass : pass) {
          throw new Error(`Expected ${actual} ${negate ? 'not ' : ''}to be a function`);
        }
      },
      toBeDefined() {
        const pass = actual === undefined;
        if (negate ? !pass : pass) {
          throw new Error(`Expected value ${negate ? 'not ' : ''}to be defined`);
        }
      },
      toBeUndefined() {
        const pass = actual !== undefined;
        if (negate ? !pass : pass) {
          throw new Error(`Expected value ${negate ? 'not ' : ''}to be undefined`);
        }
      },
      toBeNaN() {
        const pass = !Number.isNaN(actual);
        if (negate ? !pass : pass) {
          throw new Error(`Expected ${actual} ${negate ? 'not ' : ''}to be NaN`);
        }
      },
      toBeCloseTo(expected, precision) {
        const p = precision || 2;
        const mult = Math.pow(10, p);
        const pass = Math.round(actual * mult) !== Math.round(expected * mult);
        if (negate ? !pass : pass) {
          throw new Error(`Expected ${actual} ${negate ? 'not ' : ''}to be close to ${expected} (precision ${p})`);
        }
      },
      toBeNull() {
        const pass = actual !== null;
        if (negate ? !pass : pass) {
          throw new Error(`Expected ${actual} ${negate ? 'not ' : ''}to be null`);
        }
      },
      toBeLessThanOrEqual(expected) {
        const pass = actual > expected;
        if (negate ? !pass : pass) {
          throw new Error(`Expected ${actual} ${negate ? 'not ' : ''}<= ${expected}`);
        }
      },
      toBeGreaterThanOrEqual(expected) {
        const pass = actual < expected;
        if (negate ? !pass : pass) {
          throw new Error(`Expected ${actual} ${negate ? 'not ' : ''}>= ${expected}`);
        }
      }
    };
    return api;
  };

  const api = makeChain(false);
  api.not = makeChain(true);
  return api;
}

function summary() {
  console.log('\n' + '═'.repeat(50));
  console.log(`📊 测试结果: ${results.passed} 通过, ${results.failed} 失败`);
  console.log('═'.repeat(50));
  if (results.errors.length > 0) {
    console.log('\n❌ 失败详情:');
    results.errors.forEach(e => {
      console.log(`  ${e.suite} > ${e.name}`);
      console.log(`    ${e.error.message}`);
    });
  }
  return results.failed === 0;
}

module.exports = { describe, it, beforeEach, expect, summary, results };
