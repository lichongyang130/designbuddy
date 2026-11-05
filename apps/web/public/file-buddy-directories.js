// Traverse only handles explicitly selected by the user. File System Access is
// available in some secure-context browsers; no server-side filesystem access.
export async function collectDirectory(handle, accepts, {maxFiles=1000,maxDirectories=2000, shouldStop=()=>false}={}) {
 const records=[], stack=[{handle,path:handle.name}], errors=[]
 let directories=0, truncated=false
 while(stack.length){
  if(shouldStop())throw new Error('扫描已取消')
  const current=stack.pop()
  if(++directories>maxDirectories){truncated=true;break}
  try {
   for await(const [name,entry] of current.handle.entries()){
    if(shouldStop())throw new Error('扫描已取消')
    const path=`${current.path}/${name}`
    if(entry.kind==='directory')stack.push({handle:entry,path})
    else if(entry.kind==='file' && accepts(name)) {
     if(records.length>=maxFiles){truncated=true;break}
     try { records.push({file:await entry.getFile(),path}) }
     catch { errors.push(path) }
    }
   }
  } catch(error) { if(shouldStop())throw error;errors.push(current.path) }
  if(truncated)break
 }
 return {records,errors,truncated}
}
