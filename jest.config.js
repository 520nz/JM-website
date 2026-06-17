module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['**/__tests__/**/*.js', '**/*.test.js'],
  coverageReporters: ['text', 'lcov'],
  coverageDirectory: 'coverage'
};
