import { useCallback, useEffect, useState } from "react";
import api from "../api/axios";
import { useAutoRefresh } from "./useAutoRefresh";
export function useAcademicPeriods() {
  const [calendar,setCalendar]=useState(null),[schoolYear,setSchoolYear]=useState("all"),[semester,setSemester]=useState("all"),[error,setError]=useState(false);
  const refresh=useCallback(()=>api.get("/academic-periods").then(({data})=>{setCalendar(data);setError(false);}).catch(()=>setError(true)),[]);
  useEffect(()=>{refresh();},[refresh]);
  useAutoRefresh(refresh,{interval:60000});
  const period=schoolYear==="unassigned"?{unassigned:true}:calendar?.years?.find(year=>String(year.startYear)===schoolYear);
  return {calendar,schoolYear,semester,period,error,refresh,setSchoolYear:value=>{setSchoolYear(value);setSemester("all");},setSemester};
}
