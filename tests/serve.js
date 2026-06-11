#!/usr/bin/env node
/**
 * 简易静态服务器（零依赖，仅用于本地验证）
 * 用法：node tests/serve.js  →  访问 http://localhost:8765/
 */
'use strict';
var http = require('http');
var fs = require('fs');
var path = require('path');
var url = require('url');

var PORT = 8765;
var ROOT = path.join(__dirname, '..');
var MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js':   'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.svg':  'image/svg+xml'
};

http.createServer(function (req, res) {
    var pathname = decodeURIComponent(url.parse(req.url).pathname);
    if (pathname === '/') pathname = '/index.html';
    var filepath = path.join(ROOT, pathname);
    if (filepath.indexOf(ROOT) !== 0) { res.writeHead(403); return res.end('Forbidden'); }
    fs.readFile(filepath, function (err, data) {
        if (err) { res.writeHead(404); return res.end('Not found: ' + pathname); }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(filepath)] || 'text/plain' });
        res.end(data);
    });
}).listen(PORT, function () {
    console.log('Server: http://localhost:' + PORT + '/');
    console.log('Root:   ' + ROOT);
    console.log('按 Ctrl+C 停止');
});
