(()=>{
const form=document.querySelector('#interest-form'),root=document.querySelector('.registration-journey');if(!form||!root)return;
const child=document.querySelector('#child-step'),family=document.querySelector('#family-step'),title=document.querySelector('#step-title');let step=1,done=false;
const media=matchMedia('(prefers-reduced-motion: reduce)');
function motion(value){root.classList.toggle('motion-reduced',value);}
motion(media.matches);media.addEventListener('change',e=>motion(e.matches));
function show(next,focus=true){step=next;root.dataset.step=String(next);child.hidden=next!==1;family.hidden=next!==2;title.textContent=next===1?'Meet your child':'Meet your family';document.querySelector('#form-step-label').textContent=`Step ${next} of 3`;document.querySelector('#step-kicker').textContent=next===1?'TELL US A LITTLE ABOUT THEM':'WE’D LOVE TO GET TO KNOW YOU';document.querySelector('#scene-title').innerHTML=next===1?'Their next chapter<br>starts here.':'A little closer<br>to their future.';document.querySelector('#scene-subtitle').innerHTML=next===1?'A brighter tomorrow begins<br>with curious minds.':'Same values. A brighter<br>tomorrow in Rehan.';root.querySelectorAll('.journey-progress span').forEach((el,i)=>{if(i===next-1)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});if(focus){title.focus({preventScroll:true});title.scrollIntoView({block:'nearest',behavior:'auto'});}}
function continueStep(){const fields=[...child.querySelectorAll('input,select')];const invalid=fields.find(el=>!el.disabled&&!el.checkValidity());if(invalid){invalid.reportValidity();return;}show(2);}
form.noValidate=true;
document.querySelector('#next-step').addEventListener('click',continueStep);
document.querySelector('#back-step').addEventListener('click',()=>show(1));
form.addEventListener('submit',event=>{if(done){event.preventDefault();event.stopImmediatePropagation();return;}if(step===1){event.preventDefault();event.stopImmediatePropagation();continueStep();}},true);
form.addEventListener('invalid',event=>{if(child.contains(event.target)&&step!==1)show(1,false);},true);
form.addEventListener('input',()=>{const fields=[...form.querySelectorAll('#child-step input,#child-step select,#family-step input:not([name="website"])')].filter(el=>!el.disabled);const filled=fields.filter(el=>el.checkValidity()).length;root.style.setProperty('--approach',String(fields.length?filled/fields.length:0));});
form.addEventListener('interest:saved',event=>{done=true;root.dataset.step='3';root.classList.add('journey-complete');document.querySelector('.journey-form-panel').hidden=true;const success=document.querySelector('#interest-success');success.hidden=false;document.querySelector('.welcome-name').textContent=`A world of possibility awaits ${event.detail.childName.trim().split(/\s+/)[0]}.`;root.querySelectorAll('.journey-progress span').forEach((el,i)=>{if(i===2)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});success.focus({preventScroll:true});root.scrollIntoView({behavior:'auto',block:'start'});});
})();
