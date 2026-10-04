/* ============================================================
   我的世界 · 方块乐园 — 局域网静态服务器 (零依赖)
   用法: node server.js [端口]   默认 8080
   平板在同一 WiFi 下浏览器访问 http://<电脑IP>:端口
============================================================ */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = parseInt(process.argv[2] || '8080', 10);
const ROOT = __dirname;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.csv':  'text/csv; charset=utf-8',
  '.md':   'text/markdown; charset=utf-8',
  '.ico':  'image/x-icon'
};

http.createServer((req, res)=>{
  let p = decodeURIComponent((req.url||'/').split('?')[0]);
  if(p === '/') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p));
  if(!file.startsWith(ROOT)){ res.writeHead(403); return res.end('403'); }   // 防目录穿越
  fs.readFile(file, (err, data)=>{
    if(err){ res.writeHead(404); return res.end('404 Not Found'); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  });
}).listen(PORT, '0.0.0.0', ()=>{
  console.log('我的世界 · 方块乐园 已启动 (端口 ' + PORT + ')');
  const nets = os.networkInterfaces();
  let shown = false;
  for(const name of Object.keys(nets)){
    for(const n of nets[name]){
      if(n.family === 'IPv4' && !n.internal){
        console.log('  平板浏览器访问 ▶ http://' + n.address + ':' + PORT);
        shown = true;
      }
    }
  }
  if(!shown) console.log('  本机访问 ▶ http://127.0.0.1:' + PORT);
  console.log('  (若平板打不开, 请允许 Node.js 通过 Windows 防火墙: 专用网络)');
});
