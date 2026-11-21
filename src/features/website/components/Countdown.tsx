"use client";
import { useEffect,useState } from "react";
import { EVENT_START_AT } from "@/features/events/config/event";
type Time={days:number;hours:number;minutes:number;seconds:number};
function remaining():Time|null{const ms=new Date(EVENT_START_AT).getTime()-Date.now();if(ms<=0)return null;const s=Math.floor(ms/1000);return{days:Math.floor(s/86400),hours:Math.floor(s%86400/3600),minutes:Math.floor(s%3600/60),seconds:s%60};}
export function Countdown(){const[value,setValue]=useState<Time|null>(null);const[started,setStarted]=useState(false);useEffect(()=>{const update=()=>{const next=remaining();setValue(next);setStarted(!next);};update();const timer=window.setInterval(update,1000);return()=>window.clearInterval(timer);},[]);if(started)return <div className="countdown-started">THE PARTY HAS STARTED</div>;return <div className="countdown" aria-label="Countdown to the event">{(["days","hours","minutes","seconds"] as const).map(k=><div className="countdown-unit" key={k}><strong>{value?String(value[k]).padStart(2,"0"):"--"}</strong><span>{k}</span></div>)}</div>;}
