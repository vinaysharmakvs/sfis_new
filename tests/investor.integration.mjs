import assert from 'node:assert/strict';
import handler from '../api/investor.js';

assert.ok(process.env.INVESTOR_PASSCODE,'Set INVESTOR_PASSCODE for this test.');
assert.ok(process.env.INVESTOR_SESSION_SECRET?.length>=48,'Set INVESTOR_SESSION_SECRET for this test.');
process.env.INVESTOR_LOCAL_BYPASS='0';
const testIp='192.0.2.13';
function response(){return{headers:{},statusCode:200,setHeader(name,value){this.headers[name.toLowerCase()]=value;},end(value=''){this.body=String(value);}};}
async function call({method='GET',headers={},body}={}){
  const res=response();
  await handler({method,url:'/api/investor',headers:{host:'localhost:8766',...headers},body,socket:{remoteAddress:testIp}},res);
  let data={};try{data=JSON.parse(res.body);}catch{}
  return{status:res.statusCode,headers:res.headers,data};
}
assert.equal((await call()).status,401,'Model must stay closed before passcode entry.');
const bad=await call({method:'POST',headers:{'content-type':'application/json',origin:'http://localhost:8766','sec-fetch-site':'same-origin'},body:{action:'login',passcode:'incorrect'}});
assert.equal(bad.status,401);
const login=await call({method:'POST',headers:{'content-type':'application/json',origin:'http://localhost:8766','sec-fetch-site':'same-origin'},body:{action:'login',passcode:process.env.INVESTOR_PASSCODE}});
assert.equal(login.status,200);assert.match(login.headers['set-cookie'],/HttpOnly/);assert.match(login.headers['set-cookie'],/SameSite=Strict/);
const cookie=login.headers['set-cookie'].split(';')[0];
const opened=await call({headers:{cookie}});assert.equal(opened.status,200);assert.equal(opened.data.model.revenue.annual,7_200_000);assert.equal(opened.data.model.growthInvestorScenarios.length,2);assert.equal(opened.data.model.growthInvestorScenarios[0].recoveryYear,8);assert.equal(opened.data.model.growthInvestorScenarios[1].recoveryYear,7);
assert.ok(Math.abs(opened.data.model.costs.annual-3_488_000)<0.1);assert.ok(Math.abs(opened.data.model.operatingSurplus-3_712_000.08)<0.1);
assert.ok(Math.abs(opened.data.model.investorOptions[0].annualShare-148_480.0032)<0.1);assert.ok(Math.abs(opened.data.model.investorOptions[1].annualShare-315_520.0068)<0.1);
const changed=await call({method:'POST',headers:{'content-type':'application/json',origin:'http://localhost:8766','sec-fetch-site':'same-origin',cookie},body:{action:'calculate',inputs:{students:1200}}});
assert.equal(changed.status,200);assert.equal(changed.data.model.revenue.annual,86_400_000);assert.equal(changed.data.model.growthInvestorScenarios.length,2,'Calculator responses keep the year-by-year scenarios needed by the interactive page.');
const logout=await call({method:'DELETE',headers:{cookie}});assert.equal(logout.status,200);assert.match(logout.headers['set-cookie'],/Max-Age=0/);
assert.equal((await call({headers:{cookie:'sfis_investor=expired'}})).status,401,'The private model must close after logout.');
console.log('PASS: investor passcode gate, private model response, calculation endpoint, secure cookie and logout. No database used.');
