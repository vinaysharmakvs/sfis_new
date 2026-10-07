import { randomInt } from 'node:crypto';
import { grades, sections, slotsForGrade } from './booking-rules.js';

function shuffle(items) {
 const result=[...items];
 for(let i=result.length-1;i>0;i--){const j=randomInt(i+1);[result[i],result[j]]=[result[j],result[i]];}
 return result;
}

export async function setReservationCount(pool,{grade,section,count}) {
 if(!grades.includes(grade)||!sections.includes(section)||!Number.isInteger(count)||count<0||count>slotsForGrade(grade).length)
  return {http:400,error:'Choose a valid grade and section, and enter a whole-number reservation count within the classroom capacity.'};
 const client=await pool.connect();
 try {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['booking-grade:'+grade]);
  const approved=await client.query("SELECT assigned_section AS section,assigned_slot AS slot FROM sfis.classroom_bookings WHERE grade=$1 AND status='approved'",[grade]);
  const occupied=new Set(approved.rows.filter(r=>r.section===section).map(r=>r.slot));
  const existing=await client.query('SELECT slot FROM sfis.booking_reservations WHERE grade=$1 AND section=$2',[grade,section]);
  const retained=shuffle(existing.rows.map(r=>r.slot).filter(slot=>!occupied.has(slot))).slice(0,Math.min(count,Math.max(0,slotsForGrade(grade).length-occupied.size)));
  const target=Math.min(count,Math.max(0,slotsForGrade(grade).length-occupied.size));
  if(count>target){await client.query('ROLLBACK');return {http:409,error:`Cannot reserve ${count} places: ${occupied.size} places are already approved in this grade.`};}
  await client.query('DELETE FROM sfis.booking_reservations WHERE grade=$1 AND section=$2',[grade,section]);
  for(const slot of retained)await client.query("INSERT INTO sfis.booking_reservations(grade,section,slot) VALUES($1,$2,$3)",[grade,section,slot]);
  const need=count-retained.length;
  if(need>0){
   const allReservations=await client.query('SELECT slot FROM sfis.booking_reservations WHERE grade=$1 AND section=$2',[grade,section]);
   const blocked=new Set([...occupied,...allReservations.rows.map(r=>r.slot)]);
   const options=shuffle(slotsForGrade(grade).filter(slot=>!blocked.has(slot)).map(slot=>({section,slot})));
   if(options.length<need){await client.query('ROLLBACK');return {http:409,error:'There are not enough unassigned places available to set this reservation count.'};}
   for(const item of options.slice(0,need))await client.query("INSERT INTO sfis.booking_reservations(grade,section,slot) VALUES($1,$2,$3)",[grade,item.section,item.slot]);
  }
  const rows=await client.query('SELECT grade,section,slot,label,created_at FROM sfis.booking_reservations WHERE grade=$1 AND section=$2 ORDER BY slot',[grade,section]);
  await client.query('COMMIT');
  return {http:200,saved:true,grade,section,count:rows.rowCount,reservations:rows.rows};
 } catch(error) {await client.query('ROLLBACK').catch(()=>{});throw error;}
 finally {client.release();}
}
