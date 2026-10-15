import {createHash, randomInt, randomUUID} from 'node:crypto';
import {getPool} from '../database/connection.mjs';
import {clientKey, rateLimit} from '../lib/booking-security.js';
import {issueCaptcha, consumeCaptcha} from '../lib/booking-captcha.js';
import careers from '../content/careers.json' with {type:'json'};

const roles=careers.roles;
const roleBySlug=new Map(roles.map(role=>[role.slug,role]));
const digest=value=>createHash('sha256').update(value).digest('hex');
const mobilePattern=/^[6-9][0-9]{9}$/;
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const mimeByExtension={'.pdf':'application/pdf','.doc':'application/msword','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'};
const maxResumeBytes=2_621_440;

export function validateApplication(body){
 if(!body||typeof body!=='object'||Array.isArray(body))return null;
 const role=roleBySlug.get(body.roleSlug);
 if(!role||typeof body.requestId!=='string'||!uuidPattern.test(body.requestId))return null;
 if(typeof body.name!=='string'||body.name.trim().length<2||body.name.trim().length>150)return null;
 if(typeof body.email!=='string'||body.email.trim().length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()))return null;
 if(typeof body.mobile!=='string'||!mobilePattern.test(body.mobile))return null;
 if(body.consent!==true||body.website)return null;
 const whyJoin=role.category==='campus-operations'?'':typeof body.whyJoin==='string'?body.whyJoin.trim():'';
 if(role.category!=='campus-operations'&&(whyJoin.length<20||whyJoin.length>2000))return null;
 if(typeof body.resumeName!=='string'||body.resumeName.length>180)return null;
 const fileName=body.resumeName.split(/[\\/]/).pop().replace(/[\r\n\0]/g,'').trim();
 const extension=fileName.slice(fileName.lastIndexOf('.')).toLowerCase(),expectedType=mimeByExtension[extension];
 if(!expectedType||body.resumeType!==expectedType||typeof body.resumeData!=='string'||body.resumeData.length>3_500_000)return null;
 if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(body.resumeData))return null;
 const resume=Buffer.from(body.resumeData,'base64');if(!resume.length||resume.length>maxResumeBytes||resume.toString('base64')!==body.resumeData)return null;
 const signature=resume.subarray(0,8);
 const signatureOK=extension==='.pdf'?resume.subarray(0,5).toString()==='%PDF-':extension==='.doc'?signature.equals(Buffer.from([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1])):signature.subarray(0,4).equals(Buffer.from([0x50,0x4b,0x03,0x04]));
 if(!signatureOK)return null;
 const fields={id:body.requestId,role, name:body.name.trim(),email:body.email.trim().toLowerCase(),mobile:body.mobile,whyJoin,resumeName:fileName,resumeType:expectedType,resume};
 fields.payloadHash=digest(JSON.stringify({id:fields.id,name:fields.name,email:fields.email,mobile:fields.mobile,role:role.slug,whyJoin,resumeHash:digest(resume),consent:true}));
 return fields;
}

function response(res,status,data){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(data));}
function originAllowed(req){if(req.headers['sec-fetch-site']==='cross-site')return false;if(!req.headers.origin)return true;try{return new URL(req.headers.origin).host===req.headers.host;}catch{return false;}}
async function readBody(req){let body=req.body;if(!body){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>3_800_000)throw Object.assign(Error('Submission too large. The resume must be 2.5 MB or smaller.'),{status:413});}body=JSON.parse(raw);}else if(typeof body==='string')body=JSON.parse(body);if(!body||typeof body!=='object'||Array.isArray(body)||JSON.stringify(body).length>3_800_000)throw Error('Invalid submission.');return body;}

export function createCareerHandler(poolProvider=getPool){return async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return response(res,405,{error:'Method not allowed.'});}
 if(!originAllowed(req))return response(res,403,{error:'Please use the Stone Field careers page.'});
 const url=new URL(req.url,'http://localhost');let pool;
 try{
  pool=poolProvider();const ip=clientKey(req);
  if(req.method==='GET'){
   if(url.searchParams.get('action')!=='captcha'||!['career-application','career-status'].includes(url.searchParams.get('purpose')))return response(res,400,{error:'Choose a valid verification type.'});
   if(!await rateLimit(pool,'career-captcha:'+ip,40))return response(res,429,{error:'Too many verification requests. Please try again later.'});
   return response(res,200,await issueCaptcha(pool,url.searchParams.get('purpose')));
  }
  const body=await readBody(req);if(body.website)return response(res,400,{error:'Unable to accept this submission.'});
  if(body.action==='status'){
   if(typeof body.mobile!=='string'||!mobilePattern.test(body.mobile))return response(res,400,{error:'Enter the registered 10-digit mobile number.'});
   if(!await rateLimit(pool,'career-status:'+ip,12))return response(res,429,{error:'Too many status checks. Please try again later.'});
   if(!await consumeCaptcha(pool,body.captchaId,body.captchaAnswer,'career-status'))return response(res,400,{code:'CAPTCHA_INVALID',error:'Verification failed or expired. Please complete a new code.'});
   const result=await pool.query('SELECT application_ref,role_title,status,created_at,updated_at FROM sfis.career_applications WHERE mobile=$1 ORDER BY created_at DESC LIMIT 20',[body.mobile]);
   return response(res,200,{applications:result.rows});
  }
  if(body.action!=='apply')return response(res,400,{error:'Choose an application action.'});
  const application=validateApplication(body);if(!application)return response(res,400,{error:'Check your name, email, WhatsApp number, role requirements, consent and resume. Resumes must be PDF, DOC or DOCX files no larger than 2.5 MB.'});
  if(!await rateLimit(pool,'career-apply:'+ip,20))return response(res,429,{error:'Too many applications from this connection. Please try again later.'});
  let client;
  try{
   client=await pool.connect();await client.query('BEGIN');
   await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['career-request:'+application.id]);
   const existing=await client.query('SELECT application_ref,status,payload_hash FROM sfis.career_applications WHERE request_id=$1',[application.id]);
   if(existing.rowCount){await client.query('COMMIT');return existing.rows[0].payload_hash===application.payloadHash?response(res,200,{saved:true,reference:existing.rows[0].application_ref,status:existing.rows[0].status}):response(res,409,{error:'This application attempt was already used. Please refresh the form and submit again.'});}
   if(!await consumeCaptcha(client,body.captchaId,body.captchaAnswer,'career-application')){await client.query('ROLLBACK');return response(res,400,{code:'CAPTCHA_INVALID',error:'Verification failed or expired. Please complete a new code.'});}
   let saved=null;
   for(let attempt=0;attempt<100&&!saved;attempt++){
    const applicationRef=`SF-C-${randomInt(100000,1000000)}`;
    const insert=await client.query(`INSERT INTO sfis.career_applications
      (id,request_id,application_ref,applicant_name,email,mobile,role_slug,role_title,why_join,resume_name,resume_type,resume_size,resume_data,consent,payload_hash)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true,$14)
      ON CONFLICT(application_ref) DO NOTHING RETURNING id,application_ref,status`,
     [randomUUID(),application.id,applicationRef,application.name,application.email,application.mobile,application.role.slug,application.role.title,application.whyJoin,application.resumeName,application.resumeType,application.resume.length,application.resume,application.payloadHash]);
    if(insert.rowCount)saved=insert.rows[0];
   }
   if(!saved){await client.query('ROLLBACK');return response(res,503,{error:'We could not issue an application reference. Please try again.'});}
   await client.query("INSERT INTO sfis.career_application_events(application_id,event_type,new_status,note) VALUES($1,'submitted','received','Application received')",[saved.id]);
   await client.query('COMMIT');return response(res,201,{saved:true,reference:saved.application_ref,status:saved.status});
  }catch(error){if(client)await client.query('ROLLBACK').catch(()=>{});if(error.code==='23505')return response(res,409,{error:'This application attempt already exists. Please refresh and try again.'});throw error;}finally{client?.release();}
 }catch(error){if(error.status)return response(res,error.status,{error:error.message});console.error('Careers service:',error.code||error.name);return response(res,503,{error:'The careers service is temporarily unavailable. Please try again later.'});}
};}
export default createCareerHandler();
