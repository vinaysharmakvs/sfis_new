import {getPool} from '../database/connection.mjs';
export const grades=['Playway','Nursery','LKG','UKG','Grade 1','Grade 2','Grade 3','Grade 4','Grade 5'];
export function validate(body){
 if(!body||typeof body!=='object'||Array.isArray(body))return null;
 const fields=['childName','parentName','locality'];
 const skipSchool=body.currentGrade==='Not yet in school'||['Playway','Nursery'].includes(body.upcomingGrade);
 if(!skipSchool)fields.push('currentSchool');
 for(const key of fields)if(typeof body[key]!=='string'||body[key].trim().length<2||body[key].trim().length>150)return null;
 if(!grades.includes(body.upcomingGrade)||!['Not yet in school',...grades].includes(body.currentGrade))return null;
 if(typeof body.mobile!=='string'||! /^[6-9]\d{9}$/.test(body.mobile)||!['yes','no'].includes(body.kidsverse)||body.consent!==true)return null;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId))return null;
 return {...body,...Object.fromEntries(fields.map(k=>[k,body[k].trim()])),currentSchool:body.currentGrade==='Not yet in school'?'Not yet in school':skipSchool?'Not requested':body.currentSchool.trim()};
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 const send=(status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
 if(req.method!=='POST'){res.setHeader('Allow','POST');return send(405,{error:'Please submit the registration form.'});}
 if(!String(req.headers['content-type']||'').startsWith('application/json'))return send(415,{error:'Please submit the registration form.'});
 if(req.headers['sec-fetch-site']==='cross-site')return send(403,{error:'Please use the form on our website.'});
 let body=req.body;
 try{if(!body){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>8192)return send(413,{error:'Submission too large.'});}body=JSON.parse(raw);}else if(typeof body==='string')body=JSON.parse(body);}catch{return send(400,{error:'Please check the form and try again.'});}
 if(body.website)return send(400,{error:'Unable to accept this submission.'});
 const data=validate(body);if(!data)return send(400,{error:'Please complete all fields, enter a valid 10-digit mobile number and give contact consent.'});
 let client;
 try{
 client=await getPool().connect();await client.query('BEGIN');
 await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[data.mobile]);
 const existing=await client.query('SELECT id FROM sfis.parent_interests WHERE id=$1',[data.requestId]);
 if(!existing.rowCount){
 const recent=await client.query("SELECT count(*)::int AS count FROM sfis.parent_interests WHERE mobile=$1 AND created_at>NOW()-INTERVAL '1 hour'",[data.mobile]);
 if(recent.rows[0].count>=5){await client.query('ROLLBACK');return send(429,{error:'Too many enquiries from this number. Please try again in an hour or contact the school.'});}
 await client.query('INSERT INTO sfis.parent_interests (id,child_name,upcoming_grade,current_grade,current_school,parent_name,mobile,locality,kidsverse_student,contact_consent) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)',[data.requestId,data.childName,data.upcomingGrade,data.currentGrade,data.currentSchool,data.parentName,data.mobile,data.locality,data.kidsverse==='yes']);
 }
 await client.query('COMMIT');return send(201,{saved:true,reference:data.requestId});
 }catch{if(client)await client.query('ROLLBACK').catch(()=>{});return send(503,{error:'We could not save your interest right now. Please try again later or call +91 88267 58881.'});}finally{client?.release();}
}
