import test from 'node:test';import assert from 'node:assert/strict';import {validate} from '../api/interest.js';
const valid={childName:'Test Child',parentName:'Test Parent',currentSchool:'Test School',locality:'Rehan',upcomingGrade:'Grade 1',currentGrade:'UKG',mobile:'9876543210',kidsverse:'no',consent:true,requestId:'c59c2927-f12b-42f3-bcfe-c45053e2a912'};
test('valid interest passes',()=>assert.ok(validate(valid)));
test('consent must be explicit',()=>assert.equal(validate({...valid,consent:false}),null));
test('reject invalid grade and phone',()=>{assert.equal(validate({...valid,upcomingGrade:'Grade 99'}),null);assert.equal(validate({...valid,mobile:'123'}),null)});
test('reject oversized and missing names',()=>{assert.equal(validate({...valid,childName:'x'.repeat(151)}),null);assert.equal(validate({...valid,parentName:''}),null)});

test('Playway interest passes validation',()=>assert.ok(validate({...valid,upcomingGrade:'Playway',currentGrade:'Not yet in school'})));

test('school is unnecessary for children not yet in school',()=>{assert.equal(validate({...valid,currentGrade:'Not yet in school',currentSchool:undefined}).currentSchool,'Not yet in school');assert.equal(validate({...valid,currentSchool:''}),null);assert.equal(validate({...valid,currentSchool:undefined}),null)});

test('Playway and Nursery do not require a school name',()=>{for(const upcomingGrade of ['Playway','Nursery'])assert.equal(validate({...valid,upcomingGrade,currentSchool:undefined}).currentSchool,'Not requested');assert.equal(validate({...valid,upcomingGrade:'LKG',currentSchool:undefined}),null)});
