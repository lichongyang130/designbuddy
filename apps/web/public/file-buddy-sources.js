// Local selection labels only: none of these authenticate to a remote account.
export const FILE_SOURCES = [
 {id:'computer',name:'电脑',description:'选择电脑中的文件或文件夹',hint:'仅能访问你主动选择的文件。'},
 {id:'wechat',name:'微信',description:'导入已保存到电脑的微信文件',hint:'不会登录微信或读取聊天记录。'},
 {id:'email',name:'邮箱',description:'Gmail、Outlook、QQ 邮箱的已下载附件',hint:'仅本地导入；不会登录邮箱或读取邮件。'},
 {id:'cloud',name:'网盘',description:'百度网盘、Google Drive、OneDrive 已同步的本地文件',hint:'仅本地导入；不会连接网盘账号或自动同步云端。'},
]
export const filterSource=(entries,id)=>id==='all'?entries:entries.filter(entry=>entry.source===id)
