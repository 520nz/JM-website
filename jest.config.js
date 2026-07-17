module.exports = {
  testEnvironment: 'jsdom',
  setupFiles: ['<rootDir>/js/__tests__/setup.js'],
  testMatch: ['<rootDir>/js/__tests__/**/*.test.js'],
  moduleFileExtensions: ['js'],
  collectCoverageFrom: ['js/*.js'],
  coveragePathIgnorePatterns: ['/__tests__/']
};
