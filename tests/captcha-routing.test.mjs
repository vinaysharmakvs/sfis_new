import test from 'node:test';
import assert from 'node:assert/strict';
import {createBookingHandler} from '../api/bookings.js';

function handlerForCaptchas(){
 const purposes=[];
 const pool={async query(sql,values=[]){
  if(sql.includes('booking_rate_limits'))return {rows:[{attempts:1}]};
  if(sql.includes('INSERT INTO sfis.booking_captchas'))purposes.push(values[2]);
  return {rows:[],rowCount:0};
 }};
 const handler=createBookingHandler(()=>pool);
 return {purposes,async get(purpose){let payload;const res={setHeader(){},end(value){payload=JSON.parse(value);}};await handler({method:'GET',url:`/api/bookings?action=captcha&purpose=${encodeURIComponent(purpose)}`,headers:{host:'localhost',origin:'http://localhost'},socket:{remoteAddress:'127.0.0.1'}},res);return {status:res.statusCode,body:payload};}};
}

test('legacy bookings CAPTCHA endpoint accepts career challenges during deploy/cache transitions',async()=>{
 const testHandler=handlerForCaptchas();
 for(const purpose of ['career-application','career-status']){
  const result=await testHandler.get(purpose);
  assert.equal(result.status,200);
  assert.match(result.body.image,/^data:image\/png;base64,/);
  assert.match(result.body.audio,/^data:audio\/wav;base64,/);
 }
 assert.deepEqual(testHandler.purposes,['career-application','career-status']);
});

test('legacy bookings CAPTCHA endpoint continues to reject unknown challenge purposes',async()=>{
 const result=await handlerForCaptchas().get('unrecognized');
 assert.equal(result.status,400);
 assert.equal(result.body.error,'Choose a valid verification type.');
});
