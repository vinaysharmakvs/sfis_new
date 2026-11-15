import {randomUUID} from 'node:crypto';
import {hashPassword,temporaryPasscode} from './school-account-security.js';

const allowedRoles=new Set(['founder','teacher','parent','operations']);
const cleanOptional=value=>typeof value==='string'?value.trim().slice(0,80)||null:null;

export function validateSchoolAccount(body){
  if(!body||typeof body!=='object'||Array.isArray(body))return null;
  const fullName=typeof body.fullName==='string'?body.fullName.trim():'';
  const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
  const mobile=typeof body.mobile==='string'?body.mobile.replace(/\D/g,''):'';
  const roleCode=typeof body.roleCode==='string'?body.roleCode:'';
  if(fullName.length<2||fullName.length>160||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return null;
  if(mobile&&(!/^[6-9][0-9]{9}$/.test(mobile)))return null;
  if(!allowedRoles.has(roleCode))return null;
  const campusCode=cleanOptional(body.campusCode),gradeCode=cleanOptional(body.gradeCode),sectionCode=cleanOptional(body.sectionCode);
  if(sectionCode&&!gradeCode)return null;
  return {fullName,email,mobile:mobile||null,roleCode,campusCode,gradeCode,sectionCode};
}

export async function createSchoolAccount(pool,body){
  const account=validateSchoolAccount(body);
  if(!account)return {error:'Enter a valid name, email, role and optional 10-digit mobile. Section scope requires a grade.'};
  const passcode=temporaryPasscode(),passwordHash=await hashPassword(passcode),userId=randomUUID(),assignmentId=randomUUID();
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    await client.query(`INSERT INTO sfis.school_users
      (id,full_name,email,mobile,password_hash,password_change_required,temporary_password_expires_at,status)
      VALUES($1,$2,$3,$4,$5,TRUE,NOW()+INTERVAL '30 days','invited')`,
    [userId,account.fullName,account.email,account.mobile,passwordHash]);
    await client.query(`INSERT INTO sfis.school_user_roles
      (id,user_id,role_code,campus_code,grade_code,section_code,reason)
      VALUES($1,$2,$3,$4,$5,$6,'Created through founder account administration')`,
    [assignmentId,userId,account.roleCode,account.campusCode,account.gradeCode,account.sectionCode]);
    await client.query('COMMIT');
    return {account:{id:userId,fullName:account.fullName,email:account.email,mobile:account.mobile,roleCode:account.roleCode,campusCode:account.campusCode,gradeCode:account.gradeCode,sectionCode:account.sectionCode,status:'invited'},temporaryPasscode:passcode};
  }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();}
}

export async function listSchoolAccounts(pool){
  const result=await pool.query(`SELECT u.id,u.full_name,u.email,u.mobile,u.status,u.password_change_required,u.created_at,
      COALESCE(json_agg(json_build_object('roleCode',r.role_code,'roleName',r.display_name,'campusCode',a.campus_code,'gradeCode',a.grade_code,'sectionCode',a.section_code)
        ORDER BY r.display_name,a.campus_code,a.grade_code,a.section_code) FILTER(WHERE a.id IS NOT NULL),'[]'::json) AS roles
    FROM sfis.school_users u
    LEFT JOIN sfis.school_user_roles a ON a.user_id=u.id AND a.revoked_at IS NULL
    LEFT JOIN sfis.school_roles r ON r.role_code=a.role_code
    GROUP BY u.id ORDER BY u.created_at DESC,u.full_name LIMIT 500`);
  return result.rows;
}

export async function resetSchoolAccountPasscode(pool,id){
  if(typeof id!=='string'||!/^[a-f0-9-]{36}$/i.test(id))return {error:'Choose a valid school account.'};
  const passcode=temporaryPasscode(),passwordHash=await hashPassword(passcode);
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const changed=await client.query(`UPDATE sfis.school_users
      SET password_hash=$2,password_change_required=TRUE,temporary_password_expires_at=NOW()+INTERVAL '30 days',status='invited',updated_at=NOW()
      WHERE id=$1 AND status<>'deactivated' RETURNING id,full_name,email`,[id,passwordHash]);
    if(!changed.rowCount){await client.query('ROLLBACK');return {error:'Account not found or deactivated.'};}
    await client.query('DELETE FROM sfis.school_user_sessions WHERE user_id=$1',[id]);
    await client.query('COMMIT');
    return {account:{id:changed.rows[0].id,fullName:changed.rows[0].full_name,email:changed.rows[0].email},temporaryPasscode:passcode};
  }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();}
}

export async function setSchoolAccountStatus(pool,id,action){
  if(typeof id!=='string'||!/^[a-f0-9-]{36}$/i.test(id)||!['suspend','restore'].includes(action))return {error:'Choose a valid account status.'};
  const status=action==='suspend'?'suspended':null;
  const result=await pool.query(`UPDATE sfis.school_users SET status=COALESCE($2,CASE WHEN password_change_required THEN 'invited' ELSE 'active' END),updated_at=NOW()
    WHERE id=$1 AND status<>'deactivated' AND password_hash IS NOT NULL RETURNING id`,[id,status]);
  if(!result.rowCount)return {error:'Account not found or deactivated.'};
  if(action==='suspend')await pool.query('DELETE FROM sfis.school_user_sessions WHERE user_id=$1',[id]);
  return {saved:true};
}
