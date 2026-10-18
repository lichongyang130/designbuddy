import { accessSync, constants, readFileSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import assets from './asr-assets.json';
export { assets as asrAssets };
export const assetRoot = () => resolve(process.env.DESIGNBUDDY_ASSET_ROOT || process.cwd());
export const asrRoot = () => resolve(process.env.DESIGNBUDDY_ASR_ROOT || join(assetRoot(), 'data/skill-models/asr-en-v1'));
let verified = '';
/** Check installed pinned assets, not just a configured path. No network or process at catalog read. */
export function asrConfiguration(): {ready:true; root:string; python:string; helper:string} | {ready:false; reason:string} {
  try {
    if (process.platform !== 'linux' || process.arch !== 'x64') throw Error();
    const root=asrRoot(), markerPath=join(root,'ready.json');
    if (statSync(markerPath).size>4096) throw Error();
    const marker=JSON.parse(readFileSync(markerPath,'utf8'));
    if(marker.wheelSHA256!==assets.wheelSHA256||marker.pythonVersion!=='3.11'||marker.selfTest?.hypothesis!=='go forward ten meters'||typeof marker.python!=='string'||!marker.python.startsWith('/'))throw Error();
    accessSync(marker.python, constants.X_OK);
    const helper=join(assetRoot(),'server/skills/asr_decode.py');accessSync(helper,constants.R_OK);
    const files=Object.entries(assets.files).map(([name,info])=>{const path=join(root,'site',name),s=statSync(path);if(!s.isFile()||s.size!==info.size)throw Error();return {path,info,stamp:`${s.dev}:${s.ino}:${s.size}:${s.mtimeMs}:${s.ctimeMs}`};});
    const stamp=root+'|'+files.map(f=>f.stamp).join('|');
    if(stamp!==verified){for(const f of files)if(createHash('sha256').update(readFileSync(f.path)).digest('hex')!==f.info.sha256)throw Error();verified=stamp;}
    return {ready:true,root,python:marker.python,helper};
  } catch { return {ready:false,reason:'离线英语转写未配置或模型校验失败。需Linux x86_64 / Python 3.11，在服务端运行 python3 scripts/setup-asr.py；不会自动下载模型。'}; }
}
