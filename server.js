/* ============================================================
   我的世界 · 方块乐园 — 局域网静态服务器 (零依赖)
   用法: node server.js [端口]   默认 8080
   特性: /ping 心跳 · gzip 压缩 · ETag/304 缓存
============================================================ */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');

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
const GZIPABLE = ['.html', '.css', '.js', '.svg', '.json', '.csv', '.md'];

http.createServer((req, res)=>{
  let p = decodeURIComponent((req.url||'/').split('?')[0]);
  if(p === '/') p = '/index.html';

  /* 心跳端点: 客户端每 10 秒探测, 服务停止后 pad 60 秒内锁定 */
  if(p === '/ping'){
    res.writeHead(200, {'Content-Type':'text/plain', 'Cache-Control':'no-store'});
    return res.end('ok');
  }

  const file = path.normalize(path.join(ROOT, p));
  if(!file.startsWith(ROOT)){ res.writeHead(403); return res.end('403'); }
  fs.stat(file, (err, st)=>{
    if(err || !st.isFile()){ res.writeHead(404); return res.end('404 Not Found'); }

    /* ETag 协商缓存: 未变化直接 304 */
    const etag = '"' + st.size + '-' + st.mtimeMs + '"';
    if(req.headers['if-none-match'] === etag){
      res.writeHead(304, {'ETag': etag});
      return res.end();
    }

    const ext = path.extname(file).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const headers = {
      'Content-Type': type,
      'ETag': etag,
      'Cache-Control': 'no-cache'
    };

    /* 大文本资源 gzip (three.js 600KB → ~150KB) */
    if(GZIPABLE.includes(ext) && st.size > 1024 && /gzip/.test(req.headers['accept-encoding']||'')){
      fs.readFile(file, (e2, raw)=>{
        if(e2){ res.writeHead(404); return res.end(); }
        const gz = zlib.gzipSync(raw);
        headers['Content-Encoding'] = 'gzip';
        headers['Content-Length'] = gz.length;
        res.writeHead(200, headers);
        res.end(gz);
      });
      return;
    }

    headers['Content-Length'] = st.size;
    res.writeHead(200, headers);
    fs.createReadStream(file).on('error', ()=>{ res.writeHead(500); res.end(); })
      .pipe(res);
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
