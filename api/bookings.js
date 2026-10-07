import {randomInt} from 'node:crypto';
import {getPool} from '../database/connection.mjs';
import {grades,sections,earlyGrades,stoneFieldGrades,slotsForGrade,ageEligibility} from '../lib/booking-rules.js';
import {digest,clientKey,rateLimit} from '../lib/booking-security.js';
import {issueCaptcha,consumeCaptcha} from '../lib/booking-captcha.js';
export {grades,sections};
export function bookingCode(grade,number=randomInt(10000)){const early=earlyGrades.indexOf(grade);const level=early>=0?`K${early+1}`:`S${stoneFieldGrades.indexOf(grade)+1}`;return `${level}-${String(number).padStart(4,'0')}`;}
export function validateBooking(body){
 if(!body||typeof body!=='object'||Array.isArray(body))return null;
 if(!grades.includes(body.grade)||!sections.includes(body.section)||typeof body.slot!=='string'||!slotsForGrade(body.grade).includes(body.slot))return null;
 if(typeof body.requestId!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId))return null;
 const fields=['childName','fatherName','motherName','locality'];for(const key of fields)if(typeof body[key]!=='string'||body[key].trim().length<2||body[key].trim().length>150)return null;
 if(typeof body.dob!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(body.dob))return null;const d=new Date(body.dob+'T00:00:00Z');
 if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==body.dob||body.dob>new Date().toISOString().slice(0,10)||d.getUTCFullYear()<1900)return null;
 if(typeof body.mobile!=='string'||! /^[6-9]\d{9}$/.test(body.mobile)||body.consent!==true||body.website)return null;
 return {grade:body.grade,section:body.section,slot:body.slot,dob:body.dob,mobile:body.mobile,...Object.fromEntries(fields.map(k=>[k,body[k].trim()]))};
}
export function createBookingHandler(poolProvider=getPool){return async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const send=(http,data)=>{res.statusCode=http;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return send(405,{error:'Method not allowed.'});}
 if(req.headers['sec-fetch-site']==='cross-site')return send(403,{error:'Please use our website.'});
 if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)return send(403,{error:'Please use our website.'});}catch{return send(403,{error:'Invalid origin.'});}}
 const url=new URL(req.url,'http://localhost');let client;
 try{
 const pool=poolProvider(),ip=clientKey(req);
 if(req.method==='GET'){
 if(url.searchParams.get('action')==='captcha'){
 const purpose=url.searchParams.get('purpose');if(!['booking','tracking'].includes(purpose))return send(400,{error:'Choose a valid verification type.'});
 if(!await rateLimit(pool,'captcha:'+ip,80))return send(429,{error:'Too many verification requests. Please try again later.'});
 return send(200,await issueCaptcha(pool,purpose));
 }
 const grade=url.searchParams.get('grade'),section=url.searchParams.get('section');if(!grades.includes(grade)||!sections.includes(section))return send(400,{error:'Choose a grade and section.'});
 const assigned=await pool.query("SELECT assigned_slot AS slot,split_part(btrim(child_name),' ',1) AS name FROM sfis.classroom_bookings WHERE grade=$1 AND assigned_section=$2 AND status='approved'",[grade,section]);
 const waiting=await pool.query("SELECT slot,count(*)::int AS count FROM sfis.classroom_bookings WHERE grade=$1 AND section=$2 AND status='pending' GROUP BY slot",[grade,section]);
 const reserved=await pool.query("SELECT slot,label FROM sfis.booking_reservations WHERE grade=$1 AND section=$2",[grade,section]);
 return send(200,{approved:assigned.rows,pending:waiting.rows,reserved:reserved.rows,capacity:slotsForGrade(grade).length});
 }
 if(!String(req.headers['content-type']||'').startsWith('application/json'))return send(415,{error:'JSON required.'});
 let body=req.body;try{if(!body){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>8192)return send(413,{error:'Submission too large.'});}body=JSON.parse(raw);}else if(typeof body==='string')body=JSON.parse(body);if(!body||typeof body!=='object'||Array.isArray(body)||JSON.stringify(body).length>8192)throw Error();}catch{return send(400,{error:'Please check your details.'});}
 if(body.action==='track'){
 if(!await rateLimit(pool,'tracking:'+ip,30))return send(429,{error:'Too many status checks. Please try again later.'});
 const identifier=typeof body.identifier==='string'?body.identifier.trim().toUpperCase():'';if(!/^([6-9]\d{9}|(?:S[1-5]|K[1-4])-\d{4}|[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12})$/i.test(identifier))return send(400,{error:'Enter your registered 10-digit mobile number or booking ID such as S1-4827 or K1-4827.'});
 if(!await consumeCaptcha(pool,body.captchaId,body.captchaAnswer,'tracking'))return send(400,{code:'CAPTCHA_INVALID',error:'Verification failed or expired. Please complete the new CAPTCHA.'});
 const result=await pool.query('SELECT id,booking_code,status,grade,section,slot,assigned_section,assigned_slot,created_at FROM sfis.classroom_bookings WHERE mobile=$1 OR id::text=$2 OR booking_code=$3 ORDER BY created_at DESC,id LIMIT 20',[identifier,identifier.toLowerCase(),identifier]);
 return send(200,{requests:result.rows.map(r=>({reference:r.booking_code||r.id,status:r.status,grade:r.grade,requestedSection:r.section,requestedSlot:r.slot,section:r.assigned_section,slot:r.assigned_slot,createdAt:r.created_at}))});
 }
 const data=validateBooking(body);if(!data)return send(400,{error:'Complete all details, enter a valid date of birth and mobile number, and give contact consent.'});
 const age=ageEligibility(data.dob,data.grade);if(!age.eligible)return send(422,{code:'AGE_INELIGIBLE',error:age.message});
 const fingerprint=digest(JSON.stringify(data));
 if(!await rateLimit(pool,'booking:'+ip,30))return send(429,{error:'Too many booking attempts. Please try again later.'});
 // Matching retries return the saved result even when the original one-use CAPTCHA has been consumed.
 const prior=await pool.query('SELECT payload_hash,status,booking_code FROM sfis.classroom_bookings WHERE id=$1',[body.requestId]);
 if(prior.rowCount)return prior.rows[0].payload_hash===fingerprint?send(200,{saved:true,reference:prior.rows[0].booking_code||body.requestId,status:prior.rows[0].status}):send(409,{code:'REQUEST_REUSED',error:'This request ID was already used with different details. Please start a new request.'});
 if(!await consumeCaptcha(pool,body.captchaId,body.captchaAnswer,'booking'))return send(400,{code:'CAPTCHA_INVALID',error:'Verification failed or expired. Please complete the new CAPTCHA.'});
 client=await pool.connect();await client.query('BEGIN');
 await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[body.requestId]);
 const existing=await client.query('SELECT payload_hash,status,booking_code FROM sfis.classroom_bookings WHERE id=$1',[body.requestId]);
 if(existing.rowCount){await client.query('ROLLBACK');return existing.rows[0].payload_hash===fingerprint?send(200,{saved:true,reference:existing.rows[0].booking_code||body.requestId,status:existing.rows[0].status}):send(409,{error:'Request ID already used.',code:'REQUEST_REUSED'});}
 await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['booking-mobile:'+data.mobile]);
 const active=await client.query("SELECT id FROM sfis.classroom_bookings WHERE mobile=$1 AND status IN ('pending','approved')",[data.mobile]);
 if(active.rowCount){await client.query('ROLLBACK');return send(409,{code:'MOBILE_ACTIVE',error:'This mobile number already has a pending or approved request. Use Track your request to check its status.'});}
 await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['booking-grade:'+data.grade]);
 const reservation=await client.query('SELECT 1 FROM sfis.booking_reservations WHERE grade=$1 AND section=$2 AND slot=$3',[data.grade,data.section,data.slot]);
 if(reservation.rowCount){await client.query('ROLLBACK');return send(409,{code:'SLOT_RESERVED',error:'This number is reserved for a KVS student. Please choose another number.'});}
 const occupied=await client.query("SELECT id FROM sfis.classroom_bookings WHERE grade=$1 AND assigned_section=$2 AND assigned_slot=$3 AND status='approved'",[data.grade,data.section,data.slot]);
 if(occupied.rowCount){await client.query('ROLLBACK');return send(409,{code:'SLOT_TAKEN',error:'This number has been approved for another child. Please choose an available number.'});}
 let code='',inserted=false;
 for(let attempt=0;attempt<100&&!inserted;attempt++){
  code=bookingCode(data.grade);
  const saved=await client.query("INSERT INTO sfis.classroom_bookings(id,booking_code,grade,section,slot,child_name,child_dob,father_name,mother_name,locality,mobile,contact_consent,payload_hash,consent_version,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,$12,'booking-call-consent-v2','pending') ON CONFLICT (booking_code) WHERE booking_code IS NOT NULL DO NOTHING RETURNING booking_code",[body.requestId,code,data.grade,data.section,data.slot,data.childName,data.dob,data.fatherName,data.motherName,data.locality,data.mobile,fingerprint]);
  inserted=saved.rowCount===1;
 }
 if(!inserted){await client.query('ROLLBACK');return send(503,{error:'We could not issue a booking ID just now. Please try again.'});}
 await client.query('COMMIT');return send(201,{saved:true,reference:code,status:'pending'});
 }catch(error){if(client)await client.query('ROLLBACK').catch(()=>{});if(error.code==='23505')return send(409,{code:'MOBILE_ACTIVE',error:'This mobile number already has an active request. Please track your existing request.'});console.error('Booking service:',error.code||error.name);return send(503,{error:'The booking service is temporarily unavailable. Please retry or call +91 88267 58881.'});}finally{client?.release();}
};}
export default createBookingHandler();
