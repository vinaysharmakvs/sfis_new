const defaults = Object.freeze({
  students: 100,
  monthlyFee: 3000,
  transportFee: 1000,
  annualCharge: 10000,
  admissionFee: 12000,
  miscFee: 2000,
  teacherRatio: 30,
  teacherSalary: 15000,
  supportStaffRatio: 60,
  supportStaffSalary: 5000,
  driverRatio: 50,
  driverSalary: 12000,
  conductorRatio: 50,
  conductorSalary: 5000,
  fuelPerStudent: 600,
  cleaningStaffRatio: 60,
  cleaningStaffSalary: 5000,
  guardCost: 16000,
  adminCost: 15000,
  principalCost: 50000,
  electricityCost: 8000,
  gardenerCost: 8000,
  otherCost: 10000,
  busTaxInsurance: 3333.33,
  auditCost: 3000,
  investmentAmount: 5000000,
  equityPercent: 4,
});

const labels = Object.freeze({
  students: 'Projected students', monthlyFee: 'Monthly tuition per student',
  transportFee: 'Monthly transport per student', annualCharge: 'Annual charge per student · once yearly',
  admissionFee: 'Admission fee per student', miscFee: 'Miscellaneous fee per student',
  teacherRatio: 'Students per teacher', teacherSalary: 'Monthly cost per teacher',
  supportStaffRatio: 'Students per support staff member', supportStaffSalary: 'Monthly cost per support staff member',
  driverRatio: 'Students per driver', driverSalary: 'Monthly cost per driver',
  conductorRatio: 'Students per conductor', conductorSalary: 'Monthly cost per conductor',
  fuelPerStudent: 'Monthly fuel cost per student', cleaningStaffRatio: 'Students per cleaning staff member',
  cleaningStaffSalary: 'Monthly cost per cleaning staff member', guardCost: 'Monthly security / guard cost',
  adminCost: 'Monthly administration cost', principalCost: 'Monthly school leadership cost',
  electricityCost: 'Monthly electricity cost', gardenerCost: 'Monthly groundskeeping cost',
  otherCost: 'Other monthly operating costs', busTaxInsurance: 'Monthly bus taxes and insurance per bus',
  auditCost: 'Monthly audit cost', investmentAmount: 'Illustrative investment amount',
  equityPercent: 'Share of modeled earnings (%)',
});

export function investorDefaults() {
  return { ...defaults };
}

export function calculateInvestorModel(input = {}) {
  const values = { ...defaults };
  for (const key of Object.keys(defaults)) {
    if (input[key] === undefined) continue;
    const value = Number(input[key]);
    if (!Number.isFinite(value) || value < 0 || value > 100000000) {
      throw new Error(`Enter a valid non-negative value for ${labels[key]}.`);
    }
    values[key] = value;
  }
  for (const key of ['students', 'teacherRatio', 'supportStaffRatio', 'driverRatio', 'conductorRatio', 'cleaningStaffRatio']) {
    if (!Number.isInteger(values[key]) || values[key] < 1) throw new Error(`${labels[key]} must be a whole number greater than zero.`);
  }
  if (values.investmentAmount < 1) throw new Error('Investment amount must be greater than zero.');
  if (values.equityPercent <= 0 || values.equityPercent > 100) throw new Error('Ownership percentage must be between 0 and 100.');

  const count = ratio => Math.ceil(values.students / ratio);
  const staff = {
    teachers: count(values.teacherRatio), support: count(values.supportStaffRatio),
    drivers: count(values.driverRatio), buses: count(values.driverRatio), conductors: count(values.conductorRatio), cleaning: count(values.cleaningStaffRatio),
  };
  const revenue = {
    tuitionMonthly: values.students * values.monthlyFee,
    transportMonthly: values.students * values.transportFee,
    annualCharges: values.students * values.annualCharge,
    admissionFees: values.students * values.admissionFee,
    miscellaneous: values.students * values.miscFee,
  };
  revenue.recurringMonthly = revenue.tuitionMonthly + revenue.transportMonthly;
  revenue.annual = revenue.recurringMonthly * 12 + revenue.annualCharges + revenue.admissionFees + revenue.miscellaneous;

  const costs = {
    teachers: staff.teachers * values.teacherSalary,
    support: staff.support * values.supportStaffSalary,
    drivers: staff.drivers * values.driverSalary,
    conductors: staff.conductors * values.conductorSalary,
    fuel: values.students * values.fuelPerStudent,
    cleaning: staff.cleaning * values.cleaningStaffSalary,
    security: values.guardCost, administration: values.adminCost, leadership: values.principalCost,
    electricity: values.electricityCost, groundskeeping: values.gardenerCost,
    other: values.otherCost, busTaxesInsurance: staff.buses * values.busTaxInsurance, audit: values.auditCost,
  };
  costs.monthly = Object.values(costs).reduce((sum, value) => sum + value, 0);
  costs.annual = costs.monthly * 12;

  const operatingSurplus = revenue.annual - costs.annual;
  const growthPlan = Array.from({length:10},(_,index)=>{
    const year=index+1;
    const yearStudents=150+150*index;
    const newStudents=150;
    const feeGrowth=1.05**index;
    const expenseGrowth=1.02**index;
    const annualRevenue=(yearStudents*(values.monthlyFee+values.transportFee)*12+yearStudents*values.annualCharge+newStudents*(values.admissionFee+values.miscFee))*feeGrowth;
    const teachers=Math.ceil(yearStudents/values.teacherRatio);
    const support=Math.ceil(yearStudents/values.supportStaffRatio);
    const drivers=Math.ceil(yearStudents/values.driverRatio);
    const conductors=Math.ceil(yearStudents/values.conductorRatio);
    const cleaning=Math.ceil(yearStudents/values.cleaningStaffRatio);
    const buses=drivers;
    const monthlyExpenses=(teachers*values.teacherSalary+support*values.supportStaffSalary+drivers*values.driverSalary+conductors*values.conductorSalary+cleaning*values.cleaningStaffSalary+yearStudents*values.fuelPerStudent+values.guardCost+values.adminCost+values.principalCost+values.electricityCost+values.gardenerCost+values.otherCost+buses*values.busTaxInsurance+values.auditCost)*expenseGrowth;
    const annualExpenses=monthlyExpenses*12;
    const surplus=annualRevenue-annualExpenses;
    const additionalStudentBlocks=Math.ceil(Math.max(0,yearStudents-300)/150);
    const constructionBusReserve=additionalStudentBlocks*3_000_000*1.02**Math.max(0,year-3);
    return {year,students:yearStudents,annualRevenue,annualExpenses,constructionBusReserve,surplus};
  });
  const growthInvestorScenarios = [{amount:5000000,equityPercent:4},{amount:10000000,equityPercent:8.5}].map(option=>{
    let cumulativeReserveContributions=0;
    let cumulativeDistributions=0;
    let recoveryYear=null;
    const years=growthPlan.map(row=>{
      const reserveContribution=row.constructionBusReserve*option.equityPercent/100;
      const companyReserveFunding=row.constructionBusReserve-reserveContribution;
      const earningsAvailable=Math.max(0,row.surplus-companyReserveFunding);
      const annualDistribution=earningsAvailable*option.equityPercent/100;
      cumulativeReserveContributions+=reserveContribution;
      cumulativeDistributions+=annualDistribution;
      const cumulativeCapital=option.amount+cumulativeReserveContributions;
      const recovered=cumulativeDistributions>=cumulativeCapital;
      if(recoveryYear===null&&recovered)recoveryYear=row.year;
      return {year:row.year,reserveContribution,companyReserveFunding,earningsAvailable,annualDistribution,netCashFlow:annualDistribution-reserveContribution,cumulativeReserveContributions,cumulativeCapital,cumulativeDistributions,annualRoiPercent:cumulativeCapital?annualDistribution/cumulativeCapital*100:0,recovered};
    });
    return {...option,years,recoveryYear,totalCapital:option.amount+cumulativeReserveContributions,cumulativeReturns:cumulativeDistributions};
  });
  const investorAnnualShare = operatingSurplus * values.equityPercent / 100;
  const investorOptions = [{amount:5000000,equityPercent:4},{amount:10000000,equityPercent:8.5}].map(option=>{
    const annualShare=operatingSurplus*option.equityPercent/100;
    return {...option,annualShare,roiPercent:option.amount?annualShare/option.amount*100:0,paybackYears:annualShare>0?option.amount/annualShare:null};
  });
  return {
    values,
    fields: labels,
    staff,
    revenue,
    costs,
    operatingSurplus,
    marginPercent: revenue.annual ? operatingSurplus / revenue.annual * 100 : 0,
    investorAnnualShare,
    investorMonthlyEquivalent: investorAnnualShare / 12,
    growthPlan,
    growthInvestorScenarios,
    roiPercent: investorAnnualShare / values.investmentAmount * 100,
    paybackYears: investorAnnualShare > 0 ? values.investmentAmount / investorAnnualShare : null,
    investorOptions,
    caveat: 'Illustrative operating-surplus scenario only. It excludes capital expenditure, debt service, taxes, depreciation, working capital and any agreed distribution policy. No return or payback is assured. Annual/admission/miscellaneous charges are counted once for the modeled student cohort; confirm the full workbook assumptions before relying on this draft.',
  };
}
