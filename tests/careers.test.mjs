import test from 'node:test';
import assert from 'node:assert/strict';
import {validateApplication} from '../api/careers.js';

const pdf=Buffer.from('%PDF-1.7\nA minimal sample resume');
const base={action:'apply',requestId:'c59c2927-f12b-42f3-bcfe-c45053e2a912',roleSlug:'head-of-academics',name:'Asha Sharma',email:'asha@example.com',mobile:'9876543210',whyJoin:'I would like to help build a thoughtful learning community.',resumeName:'asha-resume.pdf',resumeType:'application/pdf',resumeData:pdf.toString('base64'),consent:true};

test('valid academic application is accepted with its resume and role',()=>{
 const result=validateApplication(base);assert.ok(result);assert.equal(result.role.title,'Head of Academics');assert.equal(result.name,'Asha Sharma');assert.deepEqual(result.resume,pdf);assert.equal(result.whyJoin,base.whyJoin);
});

test('why-join response is required for non-operations roles',()=>{
 assert.equal(validateApplication({...base,whyJoin:''}),null);
});

test('campus operations applications do not require or store why-join',()=>{
 const result=validateApplication({...base,roleSlug:'school-driver',whyJoin:''});assert.ok(result);assert.equal(result.whyJoin,'');
});

test('application validates email, mobile, explicit consent and role',()=>{
 assert.equal(validateApplication({...base,email:'bad'}),null);
 assert.equal(validateApplication({...base,mobile:'123'}),null);
 assert.equal(validateApplication({...base,consent:false}),null);
 assert.equal(validateApplication({...base,roleSlug:'not-a-role'}),null);
});

test('resume extension, content signature and maximum size are checked',()=>{
 assert.equal(validateApplication({...base,resumeType:'text/plain'}),null);
 assert.equal(validateApplication({...base,resumeData:Buffer.from('not a pdf').toString('base64')}),null);
 const oversized=Buffer.alloc(2_621_441);Buffer.from('%PDF-1.7').copy(oversized);assert.equal(validateApplication({...base,resumeData:oversized.toString('base64')}),null);
});
