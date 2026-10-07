export function bookingsCsv(rows){
 const columns=[['Booking ID','booking_code'],['Internal record','id'],['Grade','grade'],['Section','section'],['Requested number','slot'],['Status','status'],['Assigned section','assigned_section'],['Assigned number','assigned_slot'],['Rejection reason','rejection_reason'],['Child name','child_name'],['Date of birth','child_dob'],['Father','father_name'],['Mother','mother_name'],['Location','locality'],['Mobile','mobile'],['Booked at','created_at']];
 const cell=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';
 return '\ufeff'+[columns.map(c=>cell(c[0])).join(','),...rows.map(row=>columns.map(([,key])=>cell(row[key])).join(','))].join('\r\n');
}
