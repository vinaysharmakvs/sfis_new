import {reviewBooking} from '../lib/booking-approval.js';
import {ageEligibility} from '../lib/booking-rules.js';
import {bookingsCsv} from '../lib/booking-report.js';
import {createHash, randomBytes, timingSafeEqual} from 'node:crypto';
import {leadsCsv,gradeOrder,enquiryType} from '../lib/grade-report.js';
import {getPool} from '../database/connection.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const statuses=['new','contacted','discussion','admitted','closed'];
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const send=(code,data)=>{res.statusCode=code;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
 const cookie=(value,age)=>res.setHeader('Set-Cookie',`sfis_founder=${value}; Path=/api/founders; HttpOnly; SameSite=Strict; Max-Age=${age}${process.env.VERCEL?' ; Secure':''}`);
 if(!['GET','POST','PATCH','DELETE'].includes(req.method))return send(405,{error:'Method not allowed.'});
 if(req.headers['sec-fetch-site']==='cross-site')return send(403,{error:'Please use the founder dashboard.'});
 if(req.headers.origin){const expected=`${process.env.VERCEL?'https':'http'}://${req.headers.host}`;if(req.headers.origin!==expected)return send(403,{error:'Invalid request origin.'});}
 const passcode=process.env.FOUNDER_PASSCODE;
 if(!passcode||passcode.length<12)return send(503,{error:'Founder access has not been configured.'});
 let body={};
 if(['POST','PATCH'].includes(req.method)){
 if(!String(req.headers['content-type']||'').startsWith('application/json'))return send(415,{error:'JSON required.'});
 try{let raw=req.body;if(!raw){raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>4096)return send(413,{error:'Request too large.'});}}body=typeof raw==='string'?JSON.parse(raw):raw;if(!body||typeof body!=='object'||Array.isArray(body)||JSON.stringify(body).length>4096)throw Error();}catch{return send(400,{error:'Invalid request.'});}
 }
 try{
 const pool=getPool();
 if(req.method==='POST'){
 const ip=process.env.VERCEL?String(req.headers['x-vercel-forwarded-for']||req.headers['x-forwarded-for']||'unknown').split(',')[0].trim():req.socket.remoteAddress;
 const key=hash(String(ip));
 const attempt=await pool.query(`INSERT INTO sfis.founder_login_attempts (key,attempts,started_at) VALUES ($1,1,NOW()) ON CONFLICT (key) DO UPDATE SET attempts=CASE WHEN founder_login_attempts.started_at<NOW()-INTERVAL '15 minutes' THEN 1 ELSE founder_login_attempts.attempts+1 END, started_at=CASE WHEN founder_login_attempts.started_at<NOW()-INTERVAL '15 minutes' THEN NOW() ELSE founder_login_attempts.started_at END RETURNING attempts`,[key]);
 if(attempt.rows[0].attempts>10){res.setHeader('Retry-After','900');return send(429,{error:'Too many attempts. Try again in 15 minutes.'});}
 if(typeof body.passcode!=='string'||!timingSafeEqual(Buffer.from(hash(body.passcode)),Buffer.from(hash(passcode))))return send(401,{error:'Incorrect passcode.'});
 const token=randomBytes(32).toString('hex');
 await pool.query("INSERT INTO sfis.founder_sessions (token_hash,passcode_hash,expires_at) VALUES ($1,$2,NOW()+INTERVAL '8 hours')",[hash(token),hash(passcode)]);
 await pool.query("DELETE FROM sfis.founder_sessions WHERE expires_at<NOW()");
 cookie(token,28800);return send(200,{authenticated:true});
 }
 const token=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('sfis_founder='))?.slice(13);
 if(!token||!/^[a-f0-9]{64}$/.test(token))return send(401,{error:'Please sign in.'});
 const session=await pool.query('SELECT token_hash FROM sfis.founder_sessions WHERE token_hash=$1 AND passcode_hash=$2 AND expires_at>NOW()',[hash(token),hash(passcode)]);
 if(!session.rowCount)return send(401,{error:'Your session has expired. Please sign in.'});
 if(req.method==='DELETE'){await pool.query('DELETE FROM sfis.founder_sessions WHERE token_hash=$1',[hash(token)]);cookie('',0);return send(200,{signedOut:true});}
 if(req.method==='PATCH' && body.type==='booking'){const result=await reviewBooking(pool,body);const {http,...payload}=result;return send(http,payload);}
 if(req.method==='PATCH'){
 if(typeof body.id!=='string'||!/^[a-f0-9-]{36}$/i.test(body.id)||!statuses.includes(body.status)||typeof body.notes!=='string'||body.notes.length>2000)return send(400,{error:'Choose a valid status and keep notes under 2,000 characters.'});
 const updated=await pool.query('UPDATE sfis.parent_interests SET status=$2,founder_notes=$3,updated_at=NOW() WHERE id=$1 RETURNING id',[body.id,body.status,body.notes.trim()]);
 return updated.rowCount?send(200,{saved:true}):send(404,{error:'Lead not found.'});
 }
 const bookingUrl=new URL(req.url,'http://localhost');
 if(bookingUrl.searchParams.get('view')==='bookings'){
 const query=(bookingUrl.searchParams.get('q')||'').slice(0,150),bookingStatus=bookingUrl.searchParams.get('status')||'',grade=bookingUrl.searchParams.get('grade')||'',section=bookingUrl.searchParams.get('section')||'';
 const result=await pool.query("SELECT id,booking_code,grade,section,slot,child_name,to_char(child_dob,'YYYY-MM-DD') AS child_dob,father_name,mother_name,locality,mobile,status,assigned_section,assigned_slot,rejection_reason,reviewed_at,created_at FROM sfis.classroom_bookings WHERE ($1='' OR concat_ws(' ',booking_code,id::text,child_name,father_name,mother_name,mobile,locality) ILIKE '%'||$1||'%') AND ($2='' OR status=$2) AND ($3='' OR grade=$3) AND ($4='' OR section=$4 OR assigned_section=$4) ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,created_at DESC LIMIT 10001",[query,bookingStatus,grade,section]);
 if(result.rows.length>10000)return send(413,{error:'Please narrow your booking filters to fewer than 10,000 requests.'});
 const bookings=result.rows.map(b=>({...b,eligibility:ageEligibility(b.child_dob,b.grade)}));
 if(bookingUrl.searchParams.get('export')==='csv'){res.statusCode=200;res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="sfis-classroom-bookings.csv"');return res.end(bookingsCsv(bookings));}
 const summary=await pool.query("SELECT count(*)::int AS total,count(*) FILTER(WHERE status='pending')::int AS pending,count(*) FILTER(WHERE status='approved')::int AS approved,count(*) FILTER(WHERE status='rejected')::int AS rejected FROM sfis.classroom_bookings");
 return send(200,{bookings,summary:summary.rows[0]});
 }
 const url=new URL(req.url,'http://localhost');const q=(url.searchParams.get('q')||'').slice(0,150),status=url.searchParams.get('status')||'',grade=url.searchParams.get('grade')||'';const page=Math.max(1,Math.min(100000,parseInt(url.searchParams.get('page'))||1));
 const params=[q,status,grade];const where=`WHERE ($1='' OR concat_ws(' ',child_name,parent_name,mobile,locality) ILIKE '%'||$1||'%') AND ($2='' OR status=$2) AND ($3='' OR upcoming_grade=$3)`;
 if(url.searchParams.get('export')==='csv'){
 const exported=await pool.query(`SELECT id,child_name,parent_name,mobile,locality,upcoming_grade,current_grade,current_school,kidsverse_student,status,founder_notes,created_at FROM sfis.parent_interests ${where} ORDER BY upcoming_grade,created_at DESC,id LIMIT 10001`,params);
 if(exported.rows.length>10000)return send(413,{error:'More than 10,000 matching leads. Filter by grade or status before exporting.'});
 res.statusCode=200;res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="sfis-grade-enquiries.csv"');return res.end(leadsCsv(exported.rows));
 }
 const grouped=await pool.query(`SELECT upcoming_grade, count(*)::int AS count FROM sfis.parent_interests ${where} GROUP BY upcoming_grade`,params);
 const counts=new Map(grouped.rows.map(row=>[row.upcoming_grade,row.count]));
 const gradeCounts=[...new Set([...gradeOrder,...counts.keys()])].map(grade=>({grade,count:counts.get(grade)||0,enquiryType:enquiryType(grade)}));
 const list=await pool.query(`SELECT id,child_name,parent_name,mobile,locality,upcoming_grade,current_grade,current_school,kidsverse_student,status,founder_notes,created_at,updated_at FROM sfis.parent_interests ${where} ORDER BY created_at DESC,id DESC LIMIT 30 OFFSET $4`,[...params,(page-1)*30]);
 const count=await pool.query(`SELECT count(*)::int AS total FROM sfis.parent_interests ${where}`,params);
 const summary=await pool.query("SELECT count(*)::int AS total,count(*) FILTER(WHERE status='new')::int AS new,count(*) FILTER(WHERE status IN ('contacted','discussion'))::int AS following_up,count(*) FILTER(WHERE status='admitted')::int AS admitted FROM sfis.parent_interests");
 return send(200,{leads:list.rows,total:count.rows[0].total,summary:summary.rows[0],gradeCounts,page});
 }catch{return send(503,{error:'Unable to access leads right now. Please try again.'});}
}
