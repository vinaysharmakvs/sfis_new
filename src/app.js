const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
function closeMenu() {
  if (!menuButton || !navigation) return;
  menuButton.setAttribute('aria-expanded', 'false');
  navigation.classList.remove('is-open');
}
menuButton?.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  navigation.classList.toggle('is-open', open);
});
navigation?.addEventListener('click', event => {
  if (event.target.closest('a')) closeMenu();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuButton?.getAttribute('aria-expanded') === 'true') {
    closeMenu();
    menuButton.focus();
  }
});
window.matchMedia('(min-width: 901px)').addEventListener('change', closeMenu);
const video = document.querySelector('#campus-film');
const playButton = document.querySelector('.video-play');
const videoError = document.querySelector('.video-error');
if (video && playButton) {
  playButton.hidden = false;
  video.controls = false;
  playButton.addEventListener('click', async () => {
    playButton.hidden = true;
    video.controls = true;
    videoError.hidden = true;
    try {
      await video.play();
      video.focus();
    } catch {
      videoError.hidden = false;
      playButton.hidden = false;
    }
  });
  video.addEventListener('play', () => { playButton.hidden = true; });
  video.addEventListener('ended', () => { playButton.hidden = false; video.controls = false; });
  video.addEventListener('error', () => { videoError.hidden = false; playButton.hidden = true; });
}

const interestForm=document.querySelector('#interest-form');
if(interestForm){
 const upcomingGrade=interestForm.elements.upcomingGrade,currentGrade=interestForm.elements.currentGrade,currentSchool=interestForm.elements.currentSchool;
 const updateCurrentSchool=()=>{
 const skipSchool=currentGrade.value==='Not yet in school'||['Playway','Nursery'].includes(upcomingGrade.value);
 currentSchool.closest('label').hidden=skipSchool;
 currentSchool.required=!skipSchool;
 currentSchool.disabled=skipSchool;
 };
 currentGrade.addEventListener('change',updateCurrentSchool);
 upcomingGrade.addEventListener('change',updateCurrentSchool);
 window.addEventListener('pageshow',updateCurrentSchool);
 updateCurrentSchool();
 let requestId=crypto.randomUUID();
 interestForm.addEventListener('submit',async event=>{
 event.preventDefault();if(!interestForm.reportValidity())return;
 const button=interestForm.querySelector('button[type=submit]'),status=document.querySelector('#form-status');
 button.disabled=true;button.textContent='Saving your interest…';status.textContent='';
 const values=Object.fromEntries(new FormData(interestForm));values.consent=interestForm.elements.consent.checked;values.requestId=requestId;
 try{const response=await fetch('/api/interest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(values)});const result=await response.json();
 if(!response.ok||result.saved!==true)throw new Error(result.error||'Your interest could not be saved. Please try again.');
 interestForm.hidden=true;const success=document.querySelector('#interest-success');success.hidden=false;success.focus({preventScroll:true});interestForm.dispatchEvent(new CustomEvent('interest:saved',{detail:{childName:values.childName}}));interestForm.reset();
 }catch(error){status.textContent=error.message==='Failed to fetch'?'Connection interrupted. Please try again.':error.message;status.focus();}
 finally{button.disabled=false;button.textContent='Register interest →';}
 });
}
