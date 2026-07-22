// 测试环境设置
import { vi } from 'vitest';

// 模拟 IndexedDB
const mockIndexedDB = {
  open: vi.fn(() => {
    const result = {
      result: {
        objectStoreNames: { contains: vi.fn(() => false) },
        createObjectStore: vi.fn(),
        transaction: vi.fn(() => ({
          objectStore: vi.fn(() => ({
            put: vi.fn(),
            get: vi.fn(),
            getAll: vi.fn(() => []),
            clear: vi.fn()
          })),
          oncomplete: null,
          onerror: null
        }))
      },
      onupgradeneeded: null,
      onsuccess: null,
      onerror: null
    };
    
    // 触发成功回调
    setTimeout(() => {
      if (result.onsuccess) {
        result.onsuccess({ target: result });
      }
    }, 0);
    
    return result;
  })
};

global.indexedDB = mockIndexedDB;
global.sessionStorage = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn()
};

// 模拟 document
if (typeof document === 'undefined') {
  global.document = {
    createElement: vi.fn(() => ({
      textContent: '',
      innerHTML: ''
    }))
  };
}