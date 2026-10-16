export default function Sidebar(){
 const menus=[
  '专家',
  '技能',
  '连接器',
  '灵感',
  '资料'
 ]

 return <aside className="sidebar">
  <h2>DesignBuddy</h2>
  {menus.map(item=><div key={item}>{item}</div>)}
 </aside>
}
