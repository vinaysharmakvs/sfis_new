import {createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';

const scrypt=promisify(scryptCallback);
const COST=32768;
const BLOCK_SIZE=8;
const PARALLEL=1;
const KEY_LENGTH=64;
const MAX_MEMORY=64*1024*1024;

export function digest(value){return createHash('sha256').update(value).digest('hex');}

export function temporaryPasscode(){return `SFIS-${randomBytes(15).toString('base64url')}`;}

export function validNewPassword(value){return typeof value==='string'&&value.length>=12&&value.length<=128&&!/[\u0000-\u001f\u007f]/.test(value);}

export async function hashPassword(password){
  if(typeof password!=='string'||password.length<1||password.length>256)throw new Error('Invalid password.');
  const salt=randomBytes(16);
  const key=await scrypt(password,salt,KEY_LENGTH,{N:COST,r:BLOCK_SIZE,p:PARALLEL,maxmem:MAX_MEMORY});
  return `scrypt$${COST}$${BLOCK_SIZE}$${PARALLEL}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(password,encoded){
  if(typeof password!=='string'||typeof encoded!=='string')return false;
  const [scheme,cost,block,parallel,saltText,keyText,...extra]=encoded.split('$');
  if(scheme!=='scrypt'||extra.length||Number(cost)!==COST||Number(block)!==BLOCK_SIZE||Number(parallel)!==PARALLEL||!saltText||!keyText)return false;
  try{
    const salt=Buffer.from(saltText,'base64url'),expected=Buffer.from(keyText,'base64url');
    if(salt.length!==16||expected.length!==KEY_LENGTH)return false;
    const actual=await scrypt(password,salt,expected.length,{N:COST,r:BLOCK_SIZE,p:PARALLEL,maxmem:MAX_MEMORY});
    return timingSafeEqual(expected,actual);
  }catch{return false;}
}
