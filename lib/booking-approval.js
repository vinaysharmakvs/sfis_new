import {ageEligibility,sections,slotsForGrade} from './booking-rules.js';
export async function reviewBooking(pool,{id,decision,reason=''}){
 if(typeof id!=='string'||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id)||!['approve','reject'].includes(decision)||typeof reason!=='string'||reason.length>1000||(decision==='reject'&&reason.trim().length<3))return {http:400,error:'Choose an action and enter a rejection reason (3–1,000 characters) when rejecting.'};
 const c=await pool.connect();try{
 await c.query('BEGIN');
 const first=await c.query('SELECT grade FROM sfis.classroom_bookings WHERE id=$1',[id]);
 if(!first.rowCount){await c.query('ROLLBACK');return {http:404,error:'Booking not found.'};}
 // Every allocation in this grade uses the same transaction lock, including across sections.
 await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',['booking-grade:'+first.rows[0].grade]);
 const result=await c.query("SELECT *,to_char(child_dob,'YYYY-MM-DD') AS dob FROM sfis.classroom_bookings WHERE id=$1 FOR UPDATE",[id]);const b=result.rows[0];
 if(decision==='approve'&&b.status==='approved'){await c.query('COMMIT');return {http:200,saved:true,status:'approved',section:b.assigned_section,slot:b.assigned_slot};}
 if(b.status==='rejected'){await c.query('ROLLBACK');return decision==='reject'?{http:200,saved:true,status:'rejected'}:{http:409,error:'This request was rejected. The family may submit a new request.'};}
 let section=null,slot=null;
 if(decision==='approve'){
 const age=ageEligibility(b.dob,b.grade);if(!age.eligible){await c.query('ROLLBACK');return {http:422,error:age.message,code:'AGE_INELIGIBLE'};}
 const assigned=await c.query("SELECT assigned_section,assigned_slot FROM sfis.classroom_bookings WHERE grade=$1 AND status='approved'",[b.grade]);const occupied=new Set(assigned.rows.map(r=>r.assigned_section+':'+r.assigned_slot));
 const order=[b.section,...sections.filter(s=>s!==b.section)];
 outer:for(const s of order){for(const n of [b.slot,...slotsForGrade(b.grade).filter(x=>x!==b.slot)]){if(!occupied.has(s+':'+n)){section=s;slot=n;break outer;}}}
 if(!slot){await c.query('ROLLBACK');return {http:409,error:'All sections in this grade are full. The request remains pending.',code:'GRADE_FULL'};}
 }
 const status=decision==='approve'?'approved':'rejected';
 await c.query('UPDATE sfis.classroom_bookings SET status=$2,assigned_section=$3,assigned_slot=$4,rejection_reason=$5,reviewed_at=NOW(),updated_at=NOW() WHERE id=$1',[id,status,section,slot,decision==='reject'?reason.trim():'']);
 await c.query('INSERT INTO sfis.booking_reviews(booking_id,action,previous_status,assigned_section,assigned_slot,reason) VALUES($1,$2,$3,$4,$5,$6)',[id,status,b.status,section,slot,decision==='reject'?reason.trim():'']);
 await c.query('COMMIT');return {http:200,saved:true,status,section,slot};
 }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
}
