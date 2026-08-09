const test=require("node:test");
const assert=require("node:assert/strict");
const {calculatePlan,addMonths}=require("../maintenancePlans");
const {buildPlanReminderCandidates}=require("../pushReminders");

function plan(overrides={}){return {id:1,vehicle_id:10,name:"Cambio de aceite",is_active:true,interval_km:5000,notify_km_before:500,interval_months:null,notify_days_before:null,initial_service_km:10000,initial_service_date:null,last_service_km:10000,last_service_date:null,...overrides};}

test("service 5000 km queda atrasado por 4 y el odometro no mueve el vencimiento",()=>{const first=calculatePlan(plan(),{currentKm:15004,today:"2026-08-09"});const second=calculatePlan(plan(),{currentKm:15005,today:"2026-08-09"});assert.equal(first.next_service_km,15000);assert.equal(first.km_remaining,-4);assert.equal(first.status,"overdue");assert.equal(second.next_service_km,15000);assert.equal(second.km_remaining,-5);});
test("registrar el service cambia solo la base de ese plan",()=>{const result=calculatePlan(plan({last_service_km:15005}),{currentKm:15005});assert.equal(result.next_service_km,20005);assert.equal(result.status,"scheduled");});
test("plan solo tiempo suma meses calendario",()=>{const result=calculatePlan(plan({interval_km:null,notify_km_before:null,initial_service_km:null,last_service_km:null,interval_months:6,notify_days_before:30,initial_service_date:"2026-01-31",last_service_date:"2026-01-31"}),{today:"2026-07-01"});assert.equal(result.next_service_date,"2026-07-31");assert.equal(result.status,"upcoming");});
test("plan por ambos vence cuando alcanza cualquiera",()=>{const result=calculatePlan(plan({interval_months:12,notify_days_before:30,initial_service_date:"2026-01-01",last_service_date:"2026-01-01"}),{currentKm:15000,today:"2026-02-01"});assert.equal(result.status,"overdue");});
test("fin de mes se conserva sin desbordar",()=>assert.equal(addMonths("2026-01-31",1),"2026-02-28"));
test("dedupe cambia al avanzar el ciclo",()=>{const old=calculatePlan(plan(),{currentKm:15004});const next=calculatePlan(plan({last_service_km:15005}),{currentKm:20006});const a=buildPlanReminderCandidates(old)[0];const b=buildPlanReminderCandidates(next)[0];assert.notEqual(a.dedupeKey,b.dedupeKey);});
