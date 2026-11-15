// Current public booking choices. Grades 4 and 5 remain known only so older
// records can still be displayed and age-checked; they cannot receive new requests.
export const stoneFieldGrades=Array.from({length:3},(_,i)=>`Grade ${i+1}`);
export const legacyStoneFieldGrades=['Grade 4','Grade 5'];
export const earlyGrades=['Playway','Nursery','L.K.G','U.K.G'];
export const grades=[...stoneFieldGrades,...earlyGrades];
const knownGrades=[...stoneFieldGrades,...legacyStoneFieldGrades,...earlyGrades];
export const sections=['Alpha','Beta','Gamma'];
export function sectionsForGrade(grade){return grade==='Grade 3'?['Alpha']:sections;}
export const slots=['A','B','C'].flatMap(row=>Array.from({length:10},(_,i)=>row+(i+1)));
export const earlySlots=slots.slice(0,20);
export function slotsForGrade(grade){return earlyGrades.includes(grade)?earlySlots:slots;}
export const cutoff='2027-03-31';
export function ageEligibility(dob,grade){
 const date=new Date(String(dob)+'T00:00:00Z');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(dob))||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==dob||!knownGrades.includes(grade))return {eligible:false,age:null,minimum:null,message:'Choose a valid date of birth and grade.'};
 const age=2027-date.getUTCFullYear()-(dob.slice(5)>'03-31'?1:0);
 const earlyLevel=earlyGrades.indexOf(grade);
 const minimum=earlyLevel>=0?earlyLevel+2:Number(grade.slice(-1))+5;
 return {age,minimum,eligible:age>=minimum,message:`${grade} requires ${minimum} completed years by 31 March 2027. Your child will be ${age} ${age===1?'year':'years'} old on that date.`};
}
