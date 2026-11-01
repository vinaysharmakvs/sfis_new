const $=selector=>document.querySelector(selector);
const loginPanel=$('#investor-login'),modelPanel=$('#investor-model'),loginForm=$('#investor-login-form'),loginStatus=$('#investor-login-status');
const currency=value=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(value)||0);
const decimal=value=>new Intl.NumberFormat('en-IN',{maximumFractionDigits:1}).format(Number(value)||0);
const groups={
  'Enrollment & collections':['students','monthlyFee','transportFee','annualCharge','admissionFee','miscFee'],
  'Staffing plan':['teacherRatio','teacherSalary','supportStaffRatio','supportStaffSalary','driverRatio','driverSalary','conductorRatio','conductorSalary','cleaningStaffRatio','cleaningStaffSalary'],
  'Other operating costs':['fuelPerStudent','guardCost','adminCost','principalCost','electricityCost','gardenerCost','otherCost','busTaxInsurance','auditCost'],
  'Investor scenario':['investmentAmount','equityPercent'],
};
const integerFields=new Set(['students','teacherRatio','supportStaffRatio','driverRatio','conductorRatio','cleaningStaffRatio']);
let defaults={};
function setOutput(path,value){const node=document.querySelector(`[data-output="${path}"]`);if(node)node.textContent=value;}
function rows(target,entries,format=currency){target.innerHTML=entries.map(([label,value])=>`<dt>${label}</dt><dd>${format(value)}</dd>`).join('');}
const compactCurrency=value=>`₹${new Intl.NumberFormat('en-IN',{notation:'compact',maximumFractionDigits:1}).format(value)}`;
function renderCharts(plan,scenarios){
  const width=760,height=300,left=58,right=16,top=22,bottom=40,plotWidth=width-left-right,plotHeight=height-top-bottom;
  const max=Math.max(...scenarios.flatMap(scenario=>scenario.years.flatMap(row=>[row.cumulativeDistributions,row.cumulativeCapital])),1)*1.08;
  const y=value=>top+plotHeight-(value/max)*plotHeight;
  const x=index=>left+(index/(plan.length-1))*plotWidth;
  const grid=Array.from({length:5},(_,index)=>{const value=max*(index/4),position=y(value);return `<line class="chart-gridline" x1="${left}" y1="${position}" x2="${width-right}" y2="${position}"/><text class="chart-axis-label" x="${left-8}" y="${position+4}" text-anchor="end">${compactCurrency(value)}</text>`;}).join('');
  const labels=plan.map((row,index)=>`<text class="chart-axis-label" x="${x(index)}" y="${height-10}" text-anchor="middle">Y${row.year}</text>`).join('');
  const scenarioLine=(scenario,key,className)=>`<polyline class="chart-line ${className}" points="${scenario.years.map((row,index)=>`${x(index)},${y(row[key])}`).join(' ')}"/>`;
  const scenarioPoints=(scenario,key,className,label)=>scenario.years.map((row,index)=>`<circle class="chart-point ${className}" cx="${x(index)}" cy="${y(row[key])}" r="4"><title>Year ${row.year}: ${label} ${currency(row[key])}</title></circle>`).join('');
  const [four,eight]=scenarios;
  $('#investor-share-chart').innerHTML=`<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${grid}${labels}${scenarioLine(four,'cumulativeDistributions','chart-four')}${scenarioLine(four,'cumulativeCapital','chart-capital-four')}${scenarioLine(eight,'cumulativeDistributions','chart-eight')}${scenarioLine(eight,'cumulativeCapital','chart-capital-eight')}${scenarioPoints(four,'cumulativeDistributions','chart-four','₹50 lakh cumulative returns')}${scenarioPoints(four,'cumulativeCapital','chart-capital-four','₹50 lakh committed capital')}${scenarioPoints(eight,'cumulativeDistributions','chart-eight','₹1 crore cumulative returns')}${scenarioPoints(eight,'cumulativeCapital','chart-capital-eight','₹1 crore committed capital')}</svg>`;
  const financialMax=Math.max(...plan.flatMap(row=>[row.annualRevenue,row.annualExpenses+row.constructionBusReserve]),1)*1.08;
  const fy=value=>top+plotHeight-(value/financialMax)*plotHeight;
  const fgrid=Array.from({length:5},(_,index)=>{const value=financialMax*(index/4),position=fy(value);return `<line class="chart-gridline" x1="${left}" y1="${position}" x2="${width-right}" y2="${position}"/><text class="chart-axis-label" x="${left-8}" y="${position+4}" text-anchor="end">${compactCurrency(value)}</text>`;}).join('');
  const fline=(key,className,valueForRow=row=>row[key])=>`<polyline class="chart-line ${className}" points="${plan.map((row,index)=>`${x(index)},${fy(valueForRow(row))}`).join(' ')}"/>`;
  const fpoints=(key,className,label,valueForRow=row=>row[key])=>plan.map((row,index)=>`<circle class="chart-point ${className}" cx="${x(index)}" cy="${fy(valueForRow(row))}" r="4"><title>Year ${row.year}: ${label} ${currency(valueForRow(row))}</title></circle>`).join('');
  const totalOutflow=row=>row.annualExpenses+row.constructionBusReserve;
  $('#investor-finance-chart').innerHTML=`<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${fgrid}${labels}${fline('annualRevenue','chart-collections')}${fline('totalOutflow','chart-expenses',totalOutflow)}${fpoints('annualRevenue','chart-collections','Collections')}${fpoints('totalOutflow','chart-expenses','Total planned outflow',totalOutflow)}</svg>`;
}
function renderModel(model){
  if(!Array.isArray(model.growthPlan)||model.growthPlan.length!==10||!Array.isArray(model.growthInvestorScenarios)||model.growthInvestorScenarios.length!==2)throw new Error('The investor page and calculator API are out of date with each other. Restart the local SFIS server or deploy the latest API and refresh this page.');
  for(const key of ['operatingSurplus','revenue.annual','costs.annual'])setOutput(key,currency(key.split('.').reduce((value,part)=>value?.[part],model)));
  setOutput('marginPercent',`${decimal(model.marginPercent)}%`);setOutput('investorAnnualShare',currency(model.investorAnnualShare));setOutput('investorMonthlyEquivalent',currency(model.investorMonthlyEquivalent));setOutput('roiPercent',`${decimal(model.roiPercent)}%`);setOutput('paybackYears',model.paybackYears?`${decimal(model.paybackYears)} years`:'Not reached in this scenario');
  document.querySelectorAll('#investor-results [data-output]').forEach(node=>{node.classList.remove('updated');void node.offsetWidth;node.classList.add('updated');setTimeout(()=>node.classList.remove('updated'),650);});
  $('#hero-students').textContent=Number(model.values.students).toLocaleString('en-IN');$('#investor-caveat-text').textContent=model.caveat;
  rows($('#investor-revenue-breakdown'),[['Tuition · 12 months',model.revenue.tuitionMonthly*12],['Transport · 12 months',model.revenue.transportMonthly*12],['Annual charges',model.revenue.annualCharges],['Admission fees',model.revenue.admissionFees],['Miscellaneous fees',model.revenue.miscellaneous],['Total annual collections',model.revenue.annual]]);
  rows($('#investor-cost-breakdown'),[['Teaching team',model.costs.teachers*12],['Support staff',model.costs.support*12],['Drivers and conductors', (model.costs.drivers+model.costs.conductors)*12],['Fuel',model.costs.fuel*12],['Cleaning team',model.costs.cleaning*12],['Other listed costs',Object.entries(model.costs).filter(([key])=>!['teachers','support','drivers','conductors','fuel','cleaning','monthly','annual'].includes(key)).reduce((sum,[,value])=>sum+value,0)*12],['Total annual operating costs',model.costs.annual]]);
  rows($('#investor-staff-breakdown'),[['Teachers · whole-person estimate',model.staff.teachers],['Support staff',model.staff.support],['Drivers',model.staff.drivers],['Buses · one per modeled driver',model.staff.buses],['Conductors',model.staff.conductors],['Cleaning staff',model.staff.cleaning],['Projected students',model.values.students]],value=>Number(value).toLocaleString('en-IN'));
  const [four,eight]=model.growthInvestorScenarios;
  const renderRecovery=(scenario,cardId,yearId,detailId)=>{
    const card=$(cardId),yearNode=$(yearId),detail=$(detailId);
    const recovery=scenario.recoveryYear;
    yearNode.textContent=recovery?`Year ${recovery}`:'Beyond Year 10';
    card.classList.toggle('is-recovered',Boolean(recovery));
    detail.textContent=`Year 10: ${currency(scenario.cumulativeReturns)} in modeled distributions against ${currency(scenario.totalCapital)} total committed capital, including ${currency(scenario.totalCapital-scenario.amount)} in reserve contributions.`;
  };
  renderRecovery(four,'#investor-payback-four','#payback-year-four','#payback-detail-four');
  renderRecovery(eight,'#investor-payback-eight','#payback-year-eight','#payback-detail-eight');
  $('#investor-growth-table-body').innerHTML=model.growthPlan.map((row,index)=>{
    const a=four.years[index],b=eight.years[index];
    const highlight=(four.recoveryYear===row.year||eight.recoveryYear===row.year)?' class="payback-year"':'';
    const cells=values=>values.map(value=>`<td>${value}</td>`).join('');
    return `<tr${highlight}><th scope="row">Year ${row.year}</th><td>${Number(row.students).toLocaleString('en-IN')}</td><td>${currency(row.annualRevenue)}</td><td>${currency(row.annualExpenses)}</td><td>${currency(row.surplus)}</td><td>${currency(row.constructionBusReserve)}</td>${cells([currency(a.reserveContribution),currency(a.annualDistribution),currency(a.netCashFlow),currency(a.cumulativeDistributions),currency(a.cumulativeCapital),`${decimal(a.annualRoiPercent)}%`,currency(b.reserveContribution),currency(b.annualDistribution),currency(b.netCashFlow),currency(b.cumulativeDistributions),currency(b.cumulativeCapital),`${decimal(b.annualRoiPercent)}%`])}</tr>`;
  }).join('');
  renderCharts(model.growthPlan,model.growthInvestorScenarios);
}
function renderFields(values){
  defaults={...values};
  $('#investor-fields').innerHTML=Object.entries(groups).map(([title,keys])=>`<section class="investor-field-group"><h3>${title}</h3><div class="investor-fields-grid">${keys.map(key=>`<div class="investor-field"><label for="assumption-${key}">${values.fields[key]}</label><input id="assumption-${key}" name="${key}" type="number" min="${integerFields.has(key)?1:0}" step="${key==='equityPercent'?0.1:key==='busTaxInsurance'?0.01:1}" value="${values.values[key]}" required></div>`).join('')}</div></section>`).join('');
}
async function request(method,body){
  const response=await fetch('/api/investor',{method,credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,cache:'no-store'});
  const data=await response.json().catch(()=>({error:'The investor service returned an unreadable response.'}));
  if(!response.ok){if(response.status===401&&method==='GET')lockModel();throw new Error(data.error||'Please try again.');}
  return data;
}
function lockModel(){modelPanel.hidden=true;loginPanel.hidden=false;$('#investor-passcode').value='';}
async function openModel(){const data=await request('GET');renderFields(data.model);renderModel(data.model);loginPanel.hidden=true;modelPanel.hidden=false;}
loginForm.addEventListener('submit',async event=>{event.preventDefault();const button=loginForm.querySelector('button');button.disabled=true;loginStatus.textContent='Checking your passcode…';try{await request('POST',{action:'login',passcode:$('#investor-passcode').value});$('#investor-passcode').value='';await openModel();loginStatus.textContent='';}catch(error){loginStatus.textContent=error.message;}finally{button.disabled=false;}});
let inputTimer,statusTimer,calculationRequest=0;
async function calculateCurrentScenario({quiet=false}={}){
  const form=$('#investor-assumptions-form');
  if(!form.reportValidity())return;
  const inputs=Object.fromEntries(new FormData(form));
  const requestNumber=++calculationRequest;
  const message=$('#investor-message');
  if(!quiet)message.textContent='Updating the numbers…';
  try{
    const data=await request('POST',{action:'calculate',inputs});
    if(requestNumber!==calculationRequest)return;
    renderModel(data.model);
    message.textContent='Calculation updated';
    message.classList.add('is-updated');
    clearTimeout(statusTimer);
    statusTimer=setTimeout(()=>{message.textContent='';message.classList.remove('is-updated');},1400);
    if(!quiet)$('#investor-results').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(error){if(requestNumber===calculationRequest){message.textContent=error.message;message.classList.remove('is-updated');}}
}
$('#investor-assumptions-form').addEventListener('submit',event=>{event.preventDefault();clearTimeout(inputTimer);calculateCurrentScenario();});
$('#investor-assumptions-form').addEventListener('input',()=>{clearTimeout(inputTimer);$('#investor-message').textContent='Editing scenario…';inputTimer=setTimeout(()=>calculateCurrentScenario({quiet:true}),500);});
$('#investor-reset').addEventListener('click',async()=>{try{clearTimeout(inputTimer);calculationRequest++;const data=await request('GET');renderFields(data.model);await calculateCurrentScenario();}catch(error){$('#investor-message').textContent=error.message;}});
$('#investor-signout').addEventListener('click',async()=>{await request('DELETE').catch(()=>{});lockModel();});
openModel().catch(error=>{if(!/Enter the investor passcode/.test(error.message))loginStatus.textContent=error.message;});
