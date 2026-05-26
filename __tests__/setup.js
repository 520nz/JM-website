Object.defineProperty(window, 'localStorage', {
  value: {
    _data: {},
    getItem: function(key) {
      return this._data[key] || null;
    },
    setItem: function(key, value) {
      this._data[key] = value;
    },
    removeItem: function(key) {
      delete this._data[key];
    },
    clear: function() {
      this._data = {};
    }
  },
  writable: true
});

global.alert = jest.fn();
global.confirm = jest.fn().mockReturnValue(true);