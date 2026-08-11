import FakeIndexedDB from 'fake-indexeddb';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  runScripts: 'dangerously',
  resources: 'usable',
});

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.sessionStorage = dom.window.sessionStorage;
global.localStorage = dom.window.localStorage;

dom.window.indexedDB = FakeIndexedDB;
// 某些环境下 indexedDB 可能不存在
if (typeof global.indexedDB === 'undefined') {
  global.indexedDB = FakeIndexedDB;
}
