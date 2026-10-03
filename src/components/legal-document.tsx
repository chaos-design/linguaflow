import { ArrowLeftIcon, FileTextIcon, InfoIcon } from "lucide-react"
import Link from "next/link"
import { Brand } from "./brand"
import { Alert, AlertDescription, AlertTitle } from "./ui/alert"

interface LegalSection {
  title: string
  paragraphs?: readonly string[]
  items?: readonly string[]
}

export function LegalDocument({
  index,
  title,
  summary,
  effectiveDate,
  sections,
  alternateHref,
  alternateLabel,
}: {
  index: string
  title: string
  summary: string
  effectiveDate: string
  sections: readonly LegalSection[]
  alternateHref: string
  alternateLabel: string
}) {
  return (
    <main className="page-shell legal-page">
      <header className="site-header">
        <Brand />
        <Link className="text-link" href="/login">
          <ArrowLeftIcon aria-hidden="true" />
          返回登录
        </Link>
      </header>

      <article className="legal-document">
        <header className="legal-document-header">
          <p className="eyebrow">
            <FileTextIcon aria-hidden="true" />
            {index}
          </p>
          <h1>{title}</h1>
          <p>{summary}</p>
          <small>生效日期：{effectiveDate}</small>
        </header>

        <Alert className="legal-template-notice">
          <InfoIcon aria-hidden="true" />
          <AlertTitle>模板说明</AlertTitle>
          <AlertDescription>
            本文为项目初始化时提供的基础模板，不构成法律意见。生产上线前，必须由实际运营主体根据业务、地区和适用法律完成审核与替换。
          </AlertDescription>
        </Alert>

        <div className="legal-sections">
          {sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.items ? (
                <ul>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        <footer className="legal-document-footer">
          <Link className="text-link" href={alternateHref}>
            {alternateLabel}
          </Link>
          <Link className="text-link" href="/">
            返回首页
          </Link>
        </footer>
      </article>
    </main>
  )
}
