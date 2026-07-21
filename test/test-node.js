const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="mocha"></div><div class="container"></div><div id="view-home"></div><div id="view-practice"></div><div id="quizArea"></div></body></html>', {
    url: 'http://localhost:8000/',
    pretendToBeVisual: true
});

global.window = dom.window;
global.document = dom.window.document;
global.sessionStorage = dom.window.sessionStorage;
global.Date = Date;
global.assert = require('chai').assert;
global.expect = require('chai').expect;

window.App = {};

const dataJs = fs.readFileSync(path.join(__dirname, '../js/data.js'), 'utf8');
const storageJs = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
const quizJs = fs.readFileSync(path.join(__dirname, '../js/quiz.js'), 'utf8');

eval(dataJs);
eval(storageJs);
eval(quizJs);

global.App = window.App;

require('./test-storage.js');
require('./test-quiz.js');