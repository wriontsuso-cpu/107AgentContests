import { ArrowRight, CircleHelp, Compass, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function AssistantInvitation() {
  return (
    <section className="assistant-invite shell-width" aria-labelledby="assistant-invite-title">
      <div className="assistant-invite__visual" aria-hidden="true">
        <span className="assistant-orbit assistant-orbit--outer" />
        <span className="assistant-orbit assistant-orbit--inner" />
        <Compass size={76} strokeWidth={1} />
        <i><Sparkles size={18} /></i>
      </div>
      <div className="assistant-invite__copy">
        <span className="eyebrow">WHEN THE NEED IS STILL VAGUE</span>
        <h2 id="assistant-invite-title">还不知道该搜什么？<br />先把想法说出来。</h2>
        <p>AI 导航不会抛给你一大段泛泛回答。它会用几个简短问题帮你理清需求，再把最相关的资源入口交到你手里。</p>
        <div className="assistant-invite__prompts">
          <span><CircleHelp size={15} />“我想做点课外项目”</span>
          <span><CircleHelp size={15} />“最近有点跟不上课程”</span>
        </div>
        <Link className="button button--light" to="/assistant">
          开始梳理需求
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </div>
    </section>
  )
}
