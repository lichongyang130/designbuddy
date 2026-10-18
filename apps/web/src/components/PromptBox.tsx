import {useState} from 'react'

export default function PromptBox(){
 const [prompt,setPrompt]=useState('')

 return <section className="prompt-box">
  <textarea
   value={prompt}
   onChange={e=>setPrompt(e.target.value)}
   placeholder="描述你的设计需求，例如：生成一个 SaaS 产品首页"
  />
  <button>Generate</button>
 </section>
}
