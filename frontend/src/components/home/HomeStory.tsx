export default function HomeStory() {
  return (
    <section className="home-snow-story shell-width" aria-label="网站与队伍介绍">
        <article className="home-snow-story__chapter">
          <span className="eyebrow">WHY USTC NAVIGATOR · 关于网站</span>
          <h2 aria-label="在科大，找入口不必绕远路">
            <span className="headline-line" data-testid="headline-line">在科大，找入口</span>
            <span className="headline-line" data-testid="headline-line">不必绕远路</span>
          </h2>
          <p>USTC Navigator 将散落在不同单位页面里的校园资源，整理成更容易搜索和确认的入口。你可以直接查找，也可以把想做的事告诉校园助手。</p>
        </article>
        <article className="home-snow-story__chapter home-snow-story__team">
          <span className="eyebrow">ABOUT THE TEAM · 关于我们</span>
          <h2 className="headline-single-line">我们是，啊对对队</h2>
          <p>我们来自中国科学技术大学网络空间安全学院。余伊健、朱荣骐、陈泰然、赵世斌，因为一次对校园信息分散的共同感受走到一起，希望把查找资源这件小事，做得更简单、更可靠。</p>
        </article>
    </section>
  )
}
