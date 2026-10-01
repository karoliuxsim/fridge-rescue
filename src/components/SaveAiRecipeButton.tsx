"use client";
import { diagnosticFetch } from "@/lib/browser-api-diagnostics";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { AiReceipt } from "@/types/saved-ai-recipe";

export default function SaveAiRecipeButton({receipt}: {receipt: AiReceipt}) {
  const [userId,setUserId]=useState<string|null>(null);
  const [checking,setChecking]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [savedId,setSavedId]=useState("");
  const locked=useRef(false);
  const owner=useRef<string|null>(null);
  useEffect(()=>{
    let mounted=true; let sequence=0;
    async function check(){
      const current=++sequence;
      try {
        const response=await diagnosticFetch("listAi", "/api/ai-recipes",{cache:"no-store"});
        const data=await response.json();
        if(!mounted||current!==sequence)return;
        const id=response.ok&&typeof data.userId==="string"?data.userId:null;
        if(owner.current!==id){setSavedId("");owner.current=id;}
        setUserId(id);
        if(!response.ok&&response.status!==401)setError(data.error||"Nepavyko patikrinti išsaugojimo prieigos.");
        else setError("");
      }catch{if(mounted)setError("Nepavyko patikrinti prisijungimo. Bandyk sugrįžęs į šį skirtuką.");}
      finally{if(mounted)setChecking(false);}
    }
    void check();window.addEventListener("focus",check);
    return()=>{mounted=false;window.removeEventListener("focus",check);};
  },[]);
  async function save(){
    if(locked.current||savedId)return;
    locked.current=true;setBusy(true);setError("");
    try{
      const response=await diagnosticFetch("saveAi", "/api/ai-recipes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({receipt})});
      const data=await response.json();
      if(!response.ok){if(response.status===401)setUserId(null);setError(data.error||"Nepavyko išsaugoti AI recepto.");return;}
      setSavedId(data.id);
    }catch{setError("Nepavyko išsaugoti. Atsakymas liko puslapyje; patikrink ryšį ir bandyk dar kartą.");}
    finally{locked.current=false;setBusy(false);}
  }
  return <div className="save-control">
    {checking?<p role="status">Tikrinamas prisijungimas...</p>:userId?<>
      <button type="button" disabled={busy||!!savedId} onClick={save}>{savedId?"Išsaugota":busy?"Saugoma...":"💾 Išsaugoti pritaikytą receptą"}</button>
      {savedId&&<p role="status"><Link href={`/my-ai-recipes/${savedId}`}>Atidaryti išsaugotą AI receptą</Link></p>}
    </>:<p><a className="back-link" href="/login" target="_blank" rel="noopener noreferrer">Prisijunk, kad išsaugotum</a></p>}
    {!savedId&&<p className="hint">Neišsaugotas rezultatas dings perkrovus puslapį. Prisijunk kitame skirtuke ir grįžk čia. Išsaugojimas negeneruoja recepto iš naujo.</p>}
    {error&&<p className="notice error" role="alert">{error}</p>}
  </div>;
}
