import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const port = Number(process.env.PORT || 5173);
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.m4a':'audio/mp4'};
const server = http.createServer((req,res) => {
  let name;
  try { name = decodeURIComponent(new URL(req.url,'http://localhost').pathname); } catch {res.writeHead(400);res.end();return;}
  if(name.endsWith('/')) name += 'index.html';
  const target = path.resolve(root, '.' + name);
  if(!target.startsWith(root + path.sep) && target !== root){res.writeHead(403);res.end();return;}
  fs.readFile(target,(error,data)=>{
    if(error){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('页面不存在');return;}
    const ext=path.extname(target),length=data.length;
    const headers={'Content-Type':types[ext]||'application/octet-stream','Content-Length':length,'Cache-Control':'no-store'};
    if(ext==='.m4a'){
      headers['Accept-Ranges']='bytes';
      const range=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range??'');
      if(range&&(range[1]||range[2])){
        const start=range[1]?Number(range[1]):Math.max(0,length-Number(range[2]));
        const end=range[1]&&range[2]?Math.min(length-1,Number(range[2])):length-1;
        if(start>end){res.writeHead(416,{'Content-Range':`bytes */${length}`});res.end();return;}
        headers['Content-Range']=`bytes ${start}-${end}/${length}`;
        headers['Content-Length']=end-start+1;
        res.writeHead(206,headers);res.end(data.subarray(start,end+1));return;
      }
    }
    res.writeHead(200,headers);res.end(data);
  });
});
server.listen(port,'127.0.0.1',()=>process.stdout.write(`Local: http://127.0.0.1:${port}\n`));
