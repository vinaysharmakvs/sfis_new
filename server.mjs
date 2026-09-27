import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import handler from './api/interest.js';
const root=path.resolve('dist');
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.mp4':'video/mp4','.ico':'image/x-icon'};
http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/interest')return await handler(req,res);
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
 const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
 const info=await stat(file);if(!info.isFile())throw new Error();
 res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-cache');
 const bytes=await readFile(file);const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
 if(range){const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),bytes.length-1):bytes.length-1;if(start>end){res.writeHead(416);return res.end();}res.writeHead(206,{'Content-Range':`bytes ${start}-${end}/${bytes.length}`,'Accept-Ranges':'bytes','Content-Length':end-start+1});return res.end(req.method==='HEAD'?undefined:bytes.subarray(start,end+1));}
 res.writeHead(200,{'Content-Length':bytes.length});res.end(req.method==='HEAD'?undefined:bytes);
 }catch{res.writeHead(404);res.end('Not found');}}).listen(8766,'127.0.0.1',()=>console.log('SFIS: http://127.0.0.1:8766'));
