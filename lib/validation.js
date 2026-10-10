import {WEDDING} from '../public/config.js';
export class ValidationError extends Error {
  constructor(code,fields={}) { super(code); this.code=code; this.fields=fields; this.status=code==='deadline_closed'?410:400; }
}
export const validId = id => typeof id==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
export function validateRsvp(input,nowMs=Date.now()) {
  if(nowMs>=Date.parse(WEDDING.rsvpClosesAt)) throw new ValidationError('deadline_closed');
  if(!input || typeof input!=='object' || Array.isArray(input)) throw new ValidationError('invalid_input');
  const errors={};
  if(!validId(input.requestId))errors.requestId='invalid';
  if(!Number.isInteger(input.guestCount)||input.guestCount<1||input.guestCount>20)errors.guestCount='invalid';
  const guests=Array.isArray(input.guests)?input.guests.map(n=>typeof n==='string'?n.trim().replace(/\s+/gu,' '):''):[];
  if(guests.length!==input.guestCount || guests.some(n=>n.length<2||n.length>120))errors.guests='invalid';
  if(typeof input.accommodation!=='boolean')errors.accommodation='required';
  const optional={};
  for(const [key,max] of [['allergies',2000],['wish',2000],['song',300]]) {
    const value=input[key]??''; if(typeof value!=='string'||value.length>max)errors[key]='invalid';
    optional[key]=typeof value==='string'?value.trim():'';
  }
  if(input.website!==undefined && input.website!=='')errors.website='invalid';
  if(Object.keys(errors).length)throw new ValidationError('invalid_input',errors);
  return {requestId:input.requestId.toLowerCase(),guestCount:input.guestCount,guests,accommodation:input.accommodation,...optional};
}
