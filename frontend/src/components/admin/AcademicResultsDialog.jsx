import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { FaTimes } from "react-icons/fa";
import { Button } from "../ui";
import AcademicUpdateResults from "./AcademicUpdateResults";

export default function AcademicResultsDialog({ onClose, ...props }) {
  const dialog=useRef(null),close=useRef(null),closeHandler=useRef(onClose);
  useEffect(()=>{closeHandler.current=onClose;},[onClose]);
  useEffect(()=>{
    const previous=document.activeElement;
    close.current?.focus();
    const handleKey=event=>{
      if(event.key==="Escape"){event.preventDefault();closeHandler.current();}
      if(event.key!=="Tab")return;
      const elements=dialog.current?.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]');
      const first=elements?.[0],last=elements?.[elements.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    };
    document.addEventListener("keydown",handleKey);
    return()=>{document.removeEventListener("keydown",handleKey);if(previous?.isConnected)previous.focus();};
  },[]);
  return createPortal(<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-5" onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="academic-results-title" className="academic-results-dialog w-full max-w-5xl overflow-y-auto overscroll-contain rounded-[var(--panel-radius)] bg-card shadow-2xl">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-card px-5 py-3"><h2 id="academic-results-title" className="font-semibold text-on">Year update results</h2><Button ref={close} size="icon" variant="ghost" aria-label="Close results" title="Close results" onClick={onClose}><FaTimes aria-hidden="true" /></Button></div>
      <AcademicUpdateResults {...props} />
    </div>
  </div>,document.body);
}
