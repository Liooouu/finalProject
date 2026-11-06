const Setting = require("../models/Setting");
const KEY = "academic-periods";
const semesters = [{ id: "first", label: "1st Semester" }, { id: "second", label: "2nd Semester" }];
const error = (status, message) => { throw Object.assign(new Error(message), { status }); };
function yearNumber(value) {
  if (!/^\d{4}$/.test(String(value)) || Number(value) < 2026 || Number(value) > 2100) error(400, "Choose a school-year start from 2026 to 2100.");
  return Number(value);
}
function view(document) {
  const data = document?.academicPeriods || {};
  const years = [...new Set(data.years || [])].sort((a,b)=>b-a).map(startYear=>({ startYear, label:`${startYear}–${startYear+1}`, semesters }));
  const current = years.find(year=>year.startYear===data.active?.startYear) || null;
  const currentSemester = current ? semesters.find(term=>term.id===data.active?.semester) || null : null;
  return { mode:"manual", configured:!!(current&&currentSemester), confirmed:false, years, current, currentSemester, version:data.version || 0 };
}
async function read() {
  return view(await Setting.findOne({ key:KEY }).select("academicPeriods").lean());
}
async function addYear(value, actor) {
  const year=yearNumber(value);
  const update={ $addToSet:{"academicPeriods.years":year}, $inc:{"academicPeriods.version":1}, $set:{updatedBy:actor} };
  let result;
  try { result=await Setting.findOneAndUpdate({key:KEY},update,{new:true,upsert:true,runValidators:true}).select("academicPeriods"); }
  catch(e) { if(e.code!==11000)throw e;result=await Setting.findOneAndUpdate({key:KEY},update,{new:true,runValidators:true}).select("academicPeriods"); }
  return view(result);
}
async function setCurrent(body, actor) {
  const startYear=yearNumber(body.startYear);
  if(!semesters.some(term=>term.id===body.semester))error(400,"Choose 1st Semester or 2nd Semester.");
  if(!Number.isInteger(body.version))error(400,"Refresh the school terms before saving.");
  const result=await Setting.findOneAndUpdate({key:KEY,"academicPeriods.years":startYear,"academicPeriods.version":body.version},
    {$set:{"academicPeriods.active":{startYear,semester:body.semester},updatedBy:actor},$inc:{"academicPeriods.version":1}},
    {new:true,runValidators:true}).select("academicPeriods");
  if(!result)error(409,"School terms changed. Refresh and choose the current term again.");
  return view(result);
}
async function eventAssignment(body,{existing=null,role}={}) {
  const explicit=Object.hasOwn(body,"academicYearStart")||Object.hasOwn(body,"semester");
  if(existing&&!explicit)return {};
  if(existing){
    const year=body.academicYearStart==null||body.academicYearStart===""?null:Number(body.academicYearStart);
    const semester=body.semester || null;
    if(year===(existing.academicYearStart??null)&&semester===(existing.semester??null))return {};
    if(role!=="admin")error(403,"Only an administrator can change an existing event's academic term.");
    if(year===null&&semester===null)return {academicYearStart:null,semester:null};
  }
  const calendar=await read();
  let academicYearStart,semester;
  if(!explicit){
    if(!calendar.configured)error(409,"An administrator must set the current school year and semester before creating events.");
    academicYearStart=calendar.current.startYear;semester=calendar.currentSemester.id;
  }else{academicYearStart=yearNumber(body.academicYearStart);semester=body.semester;}
  if(!calendar.years.some(year=>year.startYear===academicYearStart)||!semesters.some(term=>term.id===semester))error(400,"Choose a configured school year and semester.");
  return {academicYearStart,semester};
}
function eventFilter(query={}) {
  const year=query.academicYearStart, semester=query.semester;
  if(semester&&semester!=="all"&&!semesters.some(term=>term.id===semester))error(400,"Invalid semester.");
  if(year==="unassigned")return {$or:[{academicYearStart:null},{semester:null}]};
  const filter={};
  if(year&&year!=="all")filter.academicYearStart=yearNumber(year);
  if(semester&&semester!=="all")filter.semester=semester;
  return filter;
}
async function attendanceFilter(query={}) {
  const filter=eventFilter(query);
  if(!Object.keys(filter).length)return {};
  const Event=require("../models/Event");
  const [all,matching]=await Promise.all([Event.find().select("_id").lean(),Event.find(filter).select("_id").lean()]);
  // Only deleted events use attendance snapshots. Existing events always use
  // their current explicit assignment, never a guessed date or a stale copy.
  return {$or:[{event:{$in:matching.map(event=>event._id)}},{event:{$nin:all.map(event=>event._id)},...filter}]};
}
module.exports={read,addYear,setCurrent,eventAssignment,view,yearNumber,eventFilter,attendanceFilter};
