import {
  ArrowDownIcon,
  ArrowRightIcon,
  BookOpenCheckIcon,
  CaptionsIcon,
  CheckIcon,
  Clock3Icon,
  LibraryBigIcon,
  ListVideoIcon,
  NotebookPenIcon,
  PlayIcon,
  SparklesIcon,
  Volume2Icon,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"

const capabilities = [
  {
    icon: LibraryBigIcon,
    title: "学习视频集中归档",
    description: "把不同平台的课程收进个人资源库，按状态与播放列表持续整理。",
  },
  {
    icon: Clock3Icon,
    title: "自动续播，不丢进度",
    description: "每次观看都会保存播放位置，下次打开直接回到真正停下的那一秒。",
  },
  {
    icon: NotebookPenIcon,
    title: "笔记与时间戳绑定",
    description: "在理解发生的时刻记录，回看时一键跳回原始片段。",
  },
  {
    icon: CaptionsIcon,
    title: "双语字幕同步理解",
    description: "原文、译文与播放位置同步，遇到陌生表达可直接查词收藏。",
  },
  {
    icon: BookOpenCheckIcon,
    title: "生词进入复习闭环",
    description: "字幕中收藏的词汇自动进入生词本，通过闪卡持续巩固。",
  },
  {
    icon: ListVideoIcon,
    title: "批量导入与播放列表",
    description: "一次添加多条视频，按课程、主题或目标组织自己的学习路径。",
  },
] as const

const workflow = [
  [
    "01",
    "IMPORT SOURCE",
    "添加想学的视频",
    "粘贴链接或批量导入资源，建立个人学习条目。",
  ],
  [
    "02",
    "FOCUSED LEARNING",
    "边看、边记、边收藏",
    "播放进度、双语字幕、时间戳笔记围绕当前片段组织。",
  ],
  [
    "03",
    "REVIEW LOOP",
    "继续观看，也持续复习",
    "从上次位置继续课程，用闪卡回顾收藏过的表达。",
  ],
] as const

export function LandingPage({ entryHref }: { entryHref: string }) {
  const entryLabel = entryHref === "/workspace" ? "进入学习空间" : "登录并开始"

  return (
    <main className="home-shell">
      <div className="home-grid" aria-hidden="true" />

      <nav className="home-nav" aria-label="首页导航">
        <Link className="home-brand" href="/" aria-label="LinguaFlow 首页">
          <span aria-hidden="true">LF</span>
          <strong>LinguaFlow</strong>
        </Link>
        <div className="home-nav-links">
          <a href="#capabilities">学习闭环</a>
          <a href="#workspace">工作台</a>
          <a href="#workflow">使用方式</a>
        </div>
        <Link className="home-entry" href={entryHref}>
          {entryLabel}
          <ArrowRightIcon aria-hidden="true" />
        </Link>
      </nav>

      <section className="home-hero">
        <Image
          src="/images/linguaflow-course-cover.jpg"
          alt="人工智能课程学习现场"
          fill
          priority
          sizes="100vw"
          className="home-hero-image"
        />
        <div className="home-hero-shade" aria-hidden="true" />
        <div className="home-hero-content">
          <div className="home-stage-label" aria-hidden="true">
            <span>01</span>
            <i />
            VIDEO LEARNING WORKBENCH
          </div>
          <span className="home-badge">
            <SparklesIcon aria-hidden="true" />
            视频 · 字幕 · 笔记 · 复习
          </span>
          <h1>
            视频不只看完，
            <em>还要真正学会。</em>
          </h1>
          <p>
            把分散的视频、播放进度、双语字幕、时间戳笔记和生词复习收进一个工作台，
            每次回来都从真正停下的地方继续。
          </p>
          <div className="home-actions">
            <Link className="home-button" href={entryHref}>
              开始学习
              <ArrowRightIcon aria-hidden="true" />
            </Link>
            <a className="home-button home-button-outline" href="#workspace">
              查看工作台
              <ArrowDownIcon aria-hidden="true" />
            </a>
          </div>
          <div className="home-proof">
            <span>
              <CheckIcon aria-hidden="true" />
              自动保存播放进度
            </span>
            <span>
              <CheckIcon aria-hidden="true" />
              笔记绑定视频时间
            </span>
            <span>
              <CheckIcon aria-hidden="true" />
              生词进入复习队列
            </span>
          </div>
        </div>
        <div className="home-hero-status" aria-hidden="true">
          <span>
            <i />
            SESSION READY
          </span>
          <span>PROGRESS / SYNCED</span>
        </div>
      </section>

      <section className="home-metrics" aria-label="产品能力概览">
        <div className="home-metrics-source">
          <span>ONE SESSION</span>
          <i />
          <small>LEARNING LOOP</small>
        </div>
        <article>
          <small>READY</small>
          <strong>
            1<span>处</span>
          </strong>
          <p>集中管理视频与学习进度</p>
        </article>
        <article>
          <small>READY</small>
          <strong>
            4<span>类</span>
          </strong>
          <p>字幕、笔记、生词与播放列表</p>
        </article>
        <article>
          <small>READY</small>
          <strong>
            0<span>断点</span>
          </strong>
          <p>自动记录进度，随时继续</p>
        </article>
      </section>

      <section className="home-section" id="capabilities">
        <SectionHeading
          index="02"
          eyebrow="BUILT FOR RETENTION"
          title="从播放到复习，关键动作都在同一条学习链路。"
          description="视频是入口，不是终点。进度、字幕、笔记和生词围绕同一个上下文持续连接。"
          status="6 MODULES ONLINE"
        />
        <div className="home-capability-grid">
          {capabilities.map(({ icon: Icon, title, description }, index) => (
            <article key={title}>
              <span className="home-capability-index">
                {String(index + 1).padStart(2, "0")}
              </span>
              <Icon aria-hidden="true" />
              <div>
                <small>CORE MODULE / {String(index + 1).padStart(2, "0")}</small>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
              <span className="home-connected">
                <i />
                CONNECTED
              </span>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section" id="workspace">
        <SectionHeading
          index="03"
          eyebrow="LEARNING WORKSPACE"
          title="视频在中间，理解发生在周围。"
          description="播放器不会孤立存在。双语字幕、时间戳笔记和学习状态始终围绕当前片段组织。"
          status="SESSION ACTIVE"
        />
        <div className="home-workspace">
          <aside className="home-demo-sidebar">
            <div className="home-demo-brand">
              <span>LF</span>
              <strong>学习空间</strong>
            </div>
            <nav aria-label="工作台预览导航">
              <span data-active="true">
                <PlayIcon aria-hidden="true" />
                正在学习
              </span>
              <span>
                <LibraryBigIcon aria-hidden="true" />
                资源库
              </span>
              <span>
                <ListVideoIcon aria-hidden="true" />
                播放列表
              </span>
              <span>
                <BookOpenCheckIcon aria-hidden="true" />
                生词复习
              </span>
            </nav>
            <small>WEEKLY PROGRESS</small>
            <strong>3h 42m</strong>
            <div className="home-demo-meter">
              <i />
            </div>
          </aside>

          <div className="home-demo-main">
            <header>
              <div>
                <span>PLAYLIST / AI FOUNDATIONS</span>
                <h3>Self-Improving AI Agents</h3>
              </div>
              <small>48% 已完成</small>
            </header>
            <div className="home-demo-player">
              <Image
                src="/images/linguaflow-course-cover.jpg"
                alt="学习工作台中的人工智能课程"
                fill
                sizes="(max-width: 900px) 100vw, 60vw"
                className="object-cover"
              />
              <div>
                <Volume2Icon aria-hidden="true" />
                <span>
                  <i />
                </span>
                <small>18:42 / 38:24</small>
              </div>
            </div>
          </div>

          <section className="home-demo-transcript" aria-label="字幕与笔记预览">
            <header>
              <span>双语字幕</span>
              <CaptionsIcon aria-hidden="true" />
            </header>
            <article>
              <small>18:38</small>
              <p>We improve the policy through repeated feedback.</p>
              <span>我们通过持续反馈来改进策略。</span>
            </article>
            <article data-active="true">
              <small>18:42</small>
              <p>Iteration turns isolated outcomes into a learning signal.</p>
              <span>迭代把孤立结果转化为学习信号。</span>
            </article>
            <article>
              <small>18:49</small>
              <p>The system then evaluates its own next action.</p>
              <span>系统随后评估自己的下一步行动。</span>
            </article>
            <footer>
              <NotebookPenIcon aria-hidden="true" />
              <div>
                <small>NOTE / 18:42</small>
                <p>反馈不是结果，而是下一轮学习的输入。</p>
              </div>
            </footer>
          </section>
        </div>
      </section>

      <section className="home-section" id="workflow">
        <SectionHeading
          index="04"
          eyebrow="HOW IT WORKS"
          title="添加视频，进入专注学习，再把关键内容带回复习。"
          description="选择一条真正想学的视频，LinguaFlow 会把后续步骤接起来。"
          status="PATH VERIFIED"
        />
        <div className="home-workflow">
          {workflow.map(([index, eyebrow, title, description]) => (
            <article key={index}>
              <header>
                <span>{index}</span>
                <small>{eyebrow}</small>
              </header>
              <div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
              <footer>
                <span>
                  <i />
                  READY
                </span>
                {index === "03" ? (
                  <CheckIcon aria-hidden="true" />
                ) : (
                  <ArrowRightIcon aria-hidden="true" />
                )}
              </footer>
            </article>
          ))}
        </div>
      </section>

      <section className="home-final">
        <div>
          <span className="home-badge">YOUR NEXT SESSION, READY</span>
          <h2>让每次观看，都接得上下一次学习。</h2>
          <p>不再重新寻找进度，不再让笔记脱离上下文。</p>
        </div>
        <Link className="home-button" href={entryHref}>
          {entryLabel}
          <ArrowRightIcon aria-hidden="true" />
        </Link>
      </section>

      <footer className="home-footer">
        <Link className="home-brand" href="/">
          <span aria-hidden="true">LF</span>
          <strong>LinguaFlow</strong>
        </Link>
        <p>让内容被理解，让学习能继续。</p>
        <span>
          <i />
          READY TO REVIEW
        </span>
      </footer>
    </main>
  )
}

function SectionHeading({
  index,
  eyebrow,
  title,
  description,
  status,
}: {
  index: string
  eyebrow: string
  title: string
  description: string
  status: string
}) {
  return (
    <header className="home-section-heading">
      <div className="home-section-index" aria-hidden="true">
        <span>{index}</span>
        <i />
      </div>
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <small>
        <i />
        {status}
      </small>
    </header>
  )
}
