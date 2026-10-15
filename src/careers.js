import {mountCaptcha} from './captcha.js';

const endpoint='/api/careers';
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const statusNames={received:'Received',under_review:'Under review',shortlisted:'Shortlisted',interview:'Interview',not_selected:'Not selected',hired:'Hired'};
const $=(root,selector)=>root.querySelector(selector);

for(const form of document.querySelectorAll('.career-application-form')){
 const captcha=mountCaptcha($(form,'.career-captcha'),'career-application',endpoint);
 const message=$(form,'.career-form-message');let requestId='',signature='';
 captcha.ensure();
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(!form.reportValidity())return;
  const file=form.elements.resume.files[0];
  if(!file){message.textContent='Choose your resume file.';return;}
  if(file.size>2_621_440){message.textContent='Your resume must be 2.5 MB or smaller.';return;}
  const currentSignature=JSON.stringify([form.elements.roleSlug.value,form.elements.name.value.trim(),form.elements.email.value.trim(),form.elements.mobile.value,form.elements.whyJoin?.value.trim()||'',file.name,file.size,file.lastModified]);
  if(signature!==currentSignature){signature=currentSignature;requestId=crypto.randomUUID();}
  const captchaValues=captcha.values();if(!captchaValues.captchaId){message.textContent='Load and complete the verification code first.';await captcha.ensure();return;}
  const button=form.querySelector('[type=submit]'),data=new Uint8Array(await file.arrayBuffer());let binary='';
  for(let i=0;i<data.length;i+=0x8000)binary+=String.fromCharCode(...data.subarray(i,i+0x8000));
  const payload={action:'apply',requestId,roleSlug:form.elements.roleSlug.value,name:form.elements.name.value.trim(),email:form.elements.email.value.trim(),mobile:form.elements.mobile.value,whyJoin:form.elements.whyJoin?.value.trim()||'',resumeName:file.name,resumeType:file.type||({pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}[file.name.split('.').pop().toLowerCase()]||''),resumeData:btoa(binary),consent:form.elements.consent.checked,website:form.elements.website.value,...captchaValues};
  button.disabled=true;message.classList.remove('is-error');message.textContent='Sending your application securely…';
  try{
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),cache:'no-store',signal:AbortSignal.timeout(45000)});const result=await response.json();
   if(!response.ok)throw Object.assign(Error(result.error||'Unable to submit your application.'),{code:result.code});
   if(!result.saved||!result.reference)throw Error('We could not confirm the application. Please try again.');
   form.hidden=true;const success=form.parentElement.querySelector('.career-application-success');success.querySelector('.career-application-reference').textContent=result.reference;success.hidden=false;success.focus();
  }catch(error){message.classList.add('is-error');message.textContent=error.name==='TimeoutError'?'The connection timed out. Your application may have saved; check the status using your WhatsApp number before submitting again.':error.message;await captcha.refresh();}
  finally{button.disabled=false;}
 });
}

const statusForm=document.querySelector('#career-status-form');
if(statusForm){
 const captcha=mountCaptcha(document.querySelector('#career-status-captcha'),'career-status',endpoint);
 const message=document.querySelector('#career-status-message'),results=document.querySelector('#career-status-results');
 captcha.ensure();
 statusForm.addEventListener('submit',async event=>{
  event.preventDefault();if(!statusForm.reportValidity())return;
  const values=captcha.values();if(!values.captchaId){message.textContent='Load and complete the verification code first.';await captcha.ensure();return;}
  const button=statusForm.querySelector('[type=submit]');button.disabled=true;message.classList.remove('is-error');message.textContent='Checking…';results.replaceChildren();
  try{
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'status',mobile:statusForm.elements.mobile.value,...values}),cache:'no-store',signal:AbortSignal.timeout(20000)});const data=await response.json();if(!response.ok)throw Object.assign(Error(data.error||'Unable to check status.'),{code:data.code});
   message.textContent=data.applications.length?'Applications linked to this number:':'No applications were found for this number.';
   results.innerHTML=data.applications.map(item=>`<article class="career-status-result"><strong>${escapeHTML(item.role_title)}</strong><span>Reference ${escapeHTML(item.application_ref)}</span><span>Status: ${escapeHTML(statusNames[item.status]||item.status)}</span><small>Submitted ${escapeHTML(new Date(item.created_at).toLocaleDateString('en-IN',{dateStyle:'medium'}))}</small></article>`).join('');
  }catch(error){message.classList.add('is-error');message.textContent=error.message;await captcha.refresh();}
  finally{button.disabled=false;}
 });
}
