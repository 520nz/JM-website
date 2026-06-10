// Jest setup file for jsdom environment
// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString(); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i) => Object.keys(store)[i] || null,
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
});

// Mock window methods
global.alert = jest.fn();
global.confirm = jest.fn(() => true);
global.URL = {
  createObjectURL: jest.fn(() => 'blob:mock-url'),
  revokeObjectURL: jest.fn(),
};

// Mock Blob
global.Blob = class Blob {
  constructor(parts, options) {
    this.parts = parts;
    this.type = options?.type || '';
  }
};

// Mock FileReader
global.FileReader = class FileReader {
  constructor() {
    this.result = null;
    this.onload = null;
    this.onerror = null;
  }
  readAsText(file) {
    // Simulate async read
    setTimeout(() => {
      if (this.onload) {
        this.result = file.parts?.[0] || '';
        this.onload({ target: { result: this.result } });
      }
    }, 0);
  }
};

// Mock document methods for DOM manipulation
global.document.getElementById = jest.fn((id) => {
  const element = {
    innerHTML: '',
    textContent: '',
    value: '',
    style: { display: '', opacity: '', pointerEvents: '' },
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      contains: jest.fn(() => false),
    },
    addEventListener: jest.fn(),
    onclick: null,
  };
  return element;
});

global.document.createElement = jest.fn((tag) => {
  return {
    href: '',
    download: '',
    click: jest.fn(),
    style: {},
  };
});

global.document.querySelectorAll = jest.fn(() => []);
global.document.querySelector = jest.fn(() => null);

// Mock Date.now for consistent testing
const originalDateNow = Date.now;
let mockDateNow = originalDateNow();
Date.now = jest.fn(() => mockDateNow);

global.setMockDateNow = (value) => {
  mockDateNow = value;
};

global.resetMockDateNow = () => {
  mockDateNow = originalDateNow();
};