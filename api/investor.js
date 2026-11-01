import {createHmac, createHash, randomBytes, timingSafeEqual} from 'node:crypto';
import {calculateInvestorModel,investorDefaults} from '../lib/investor-model.js';

const digest=value=>createHash('sha256').update(value).digest('hex');
const ttl=30*60;
const secure=process.env.VERCEL?'; Secure':'';
const cookie=(res,value,age)=>res.setHeader('Set-Cookie',`sfis_investor=${value}; Path=/api/investor; HttpOnly; SameSite=Strict; Max-Age=${age}${secure}`);
const send=(res,status,data)=>{res.statusCode=status;res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
const attempts=new Map();

function validSession(req){
  const secret=process.env.INVESTOR_SESSION_SECRET||'';
  if(secret.length<48)return false;
  const token=String(req.headers.cookie||'').split(';').map(part=>part.trim()).find(part=>part.startsWith('sfis_investor='))?.slice('sfis_investor='.length)||'';
  const [expires,nonce,signature,...extra]=token.split('.');
  if(extra.length||!/^\d{10,13}$/.test(expires||'')||!/^[a-f0-9]{64}$/.test(nonce||'')||!/^[a-f0-9]{64}$/.test(signature||'')||Number(expires)<Math.floor(Date.now()/1000))return false;
  const expected=createHmac('sha256',secret).update(`${expires}.${nonce}`).digest('hex');
  return timingSafeEqual(Buffer.from(signature),Buffer.from(expected));
}

export default async function handler(req,res){
  const localBypass=process.env.INVESTOR_LOCAL_BYPASS==='1'&&!process.env.VERCEL&&['localhost:8766','127.0.0.1:8766'].includes(String(req.headers.host||''));
  const passcode=process.env.INVESTOR_PASSCODE||'';
  const secret=process.env.INVESTOR_SESSION_SECRET||'';
  if(!localBypass&&(!passcode||secret.length<48))return send(res,503,{error:'Investor access has not been configured on this server.'});
  if(!['GET','POST','DELETE'].includes(req.method))return send(res,405,{error:'Method not allowed.'});
  if(req.headers['sec-fetch-site']==='cross-site')return send(res,403,{error:'Please open the investor page directly.'});
  if(req.headers.origin){const expected=`${process.env.VERCEL?'https':'http'}://${req.headers.host}`;if(req.headers.origin!==expected)return send(res,403,{error:'Invalid request origin.'});}
  let body={};
  if(req.method==='POST'){
    if(!String(req.headers['content-type']||'').startsWith('application/json'))return send(res,415,{error:'JSON required.'});
    try{let raw=req.body;if(!raw){raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>10000)return send(res,413,{error:'Request too large.'});}}body=typeof raw==='string'?JSON.parse(raw):raw;if(!body||typeof body!=='object'||Array.isArray(body)||JSON.stringify(body).length>10000)throw Error();}catch{return send(res,400,{error:'Invalid request.'});}
  }
  try{
    if(localBypass){
      if(req.method==='GET')return send(res,200,{defaults:investorDefaults(),model:calculateInvestorModel()});
      if(req.method==='POST'&&body.action==='calculate')return send(res,200,{model:calculateInvestorModel(body.inputs)});
      if(req.method==='DELETE')return send(res,200,{signedOut:true});
      return send(res,400,{error:'Choose a valid investor action.'});
    }
    if(req.method==='POST'&&body.action==='login'){
      const ip=process.env.VERCEL?String(req.headers['x-vercel-forwarded-for']||req.headers['x-forwarded-for']||'unknown').split(',')[0].trim():req.socket?.remoteAddress||'unknown';
      const now=Date.now();for(const[key,value]of attempts)if(now-value.startedAt>15*60*1000)attempts.delete(key);
      const key=digest(`investor:${ip}`),prior=attempts.get(key);
      if(prior&&prior.count>=10){res.setHeader('Retry-After','900');return send(res,429,{error:'Too many attempts. Try again in 15 minutes.'});}
      attempts.set(key,{count:(prior?.count||0)+1,startedAt:prior?.startedAt||now});
      const supplied=typeof body.passcode==='string'?digest(body.passcode):digest('invalid');
      if(!timingSafeEqual(Buffer.from(supplied),Buffer.from(digest(passcode))))return send(res,401,{error:'That passcode is not correct.'});
      attempts.delete(key);
      const expires=String(Math.floor(Date.now()/1000)+ttl),nonce=randomBytes(32).toString('hex');
      const signature=createHmac('sha256',secret).update(`${expires}.${nonce}`).digest('hex');
      cookie(res,`${expires}.${nonce}.${signature}`,ttl);
      return send(res,200,{authenticated:true,expiresIn:ttl});
    }
    if(req.method==='DELETE'){
      cookie(res,'',0);return send(res,200,{signedOut:true});
    }
    if(!validSession(req))return send(res,401,{error:'Enter the investor passcode to view the model.'});
    if(req.method==='GET')return send(res,200,{defaults:investorDefaults(),model:calculateInvestorModel()});
    if(body.action==='calculate')return send(res,200,{model:calculateInvestorModel(body.inputs)});
    return send(res,400,{error:'Choose a valid investor action.'});
  }catch(error){if(error instanceof Error&&/valid|whole number|between|greater than zero/.test(error.message))return send(res,400,{error:error.message});return send(res,503,{error:'Unable to open the investor model right now. Please retry.'});}
}
