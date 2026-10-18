import { createWorker, OEM, PSM } from "tesseract.js";
import { copyFileSync, mkdirSync, renameSync, statSync, readFileSync } from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";

/** Reusable local OCR session; never downloads models or sends images to a provider. */
export async function openLocalOCR() {
  // Use bundled compact LSTM models through local paths. Passing large model buffers
  // through Tesseract's message protocol can exhaust the worker heap.
  const langPath=resolve(process.env.DESIGNBUDDY_OCR_MODEL_DIR || "./data/skill-models/ocr-v1");
  mkdirSync(langPath,{recursive:true});
  const modelHashes: Record<string,string> = {};
  const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
  for(const code of ["chi_sim","eng"]){
    const model=require(`@tesseract.js-data/${code}`) as {langPath:string};
    const source=join(dirname(model.langPath),"4.0.0_best_int",`${code}.traineddata.gz`),target=join(langPath,`${code}.traineddata.gz`);
    let valid=false;try{valid=statSync(target).size===statSync(source).size && sha(target)===sha(source);}catch{}
    if(!valid){const staging=target+"."+randomUUID()+".tmp";copyFileSync(source,staging);renameSync(staging,target);}
    modelHashes[code]=sha(target);
  }
  const worker=await createWorker("chi_sim+eng",OEM.LSTM_ONLY,{langPath,cacheMethod:"none",gzip:true,errorHandler:()=>{}});
  try { await worker.setParameters({tessedit_pageseg_mode:PSM.AUTO}); }
  catch (error) { await worker.terminate(); throw error; }
  return { worker, modelHashes };
}
