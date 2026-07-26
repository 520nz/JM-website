describe('Admin Module', () => {
  beforeEach(() => {
    global.window = {};
    global.document = {
      createElement: (tag) => ({
        textContent: '',
        innerHTML: '',
        classList: { add: jest.fn(), remove: jest.fn(), toggle: jest.fn(), contains: jest.fn() },
        style: {}
      }),
      querySelectorAll: jest.fn(() => []),
      querySelector: jest.fn(() => null),
      getElementById: jest.fn(() => ({
        value: '',
        textContent: '',
        innerHTML: '',
        style: {},
        appendChild: jest.fn()
      })),
      addEventListener: jest.fn(),
      body: { appendChild: jest.fn(), removeChild: jest.fn() }
    };
    global.Promise = Promise;
    global.alert = jest.fn();
    global.confirm = jest.fn(() => true);
    global.URL = {
      createObjectURL: jest.fn(() => 'blob://test'),
      revokeObjectURL: jest.fn()
    };
    global.Blob = jest.fn();
    global.indexedDB = {
      open: jest.fn(() => ({
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
        addEventListener: jest.fn(),
        dispatchEvent: jest.fn()
      }))
    };
    global.App = {};
    jest.resetModules();
  });

  test('closeModal should hide modal', () => {
    require('../js/storage');
    require('../js/admin');
    
    const modal = { style: { display: 'block' } };
    document.getElementById = jest.fn((id) => {
      if (id === 'editModal') return modal;
      return { value: '', textContent: '', innerHTML: '', style: {} };
    });
    
    App.closeModal();
    
    expect(modal.style.display).toBe('none');
  });

  test('closeResetModal should hide reset modal', () => {
    require('../js/storage');
    require('../js/admin');
    
    const modal = { style: { display: 'flex' } };
    document.getElementById = jest.fn((id) => {
      if (id === 'resetModal') return modal;
      return { value: '', textContent: '', innerHTML: '', style: {} };
    });
    
    App.closeResetModal();
    
    expect(modal.style.display).toBe('none');
  });
});