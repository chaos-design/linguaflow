import type { Metadata } from "next"
import { LegalDocument } from "../../components/legal-document"

export const metadata: Metadata = {
  title: "服务条款",
  description: "LinguaFlow 服务条款模板。",
}

const sections = [
  {
    title: "1. 服务说明",
    paragraphs: [
      "本服务提供基于 Next.js 与 Supabase 的账户认证及相关产品功能。具体功能、可用范围和服务主体应以正式上线版本的说明为准。",
    ],
  },
  {
    title: "2. 账户与安全",
    items: [
      "你应提供真实、有效且有权使用的邮箱地址。",
      "你应妥善保管密码、验证码和登录设备，不得向他人转让账户。",
      "发现账户被未经授权使用时，应及时联系服务运营方并采取安全措施。",
    ],
  },
  {
    title: "3. 使用规则",
    items: [
      "不得利用本服务从事违法、欺诈、侵权、干扰系统安全或损害他人权益的行为。",
      "不得绕过访问控制、批量滥用接口或以其他方式影响服务稳定性。",
      "你应对通过自己账户实施的操作及提交的内容承担责任。",
    ],
  },
  {
    title: "4. 服务变更与终止",
    paragraphs: [
      "运营方可基于安全、合规、维护或产品调整需要变更、暂停或终止部分服务，并在合理范围内提供通知。违反本条款的账户可能被限制或终止访问。",
    ],
  },
  {
    title: "5. 责任边界",
    paragraphs: [
      "在适用法律允许的范围内，因不可抗力、第三方服务故障、网络环境或用户自身原因造成的中断与损失，将根据实际责任和适用法律处理。",
    ],
  },
  {
    title: "6. 条款更新与联系",
    paragraphs: [
      "条款更新后将通过页面或其他合理方式说明。继续使用服务前，请阅读最新版本。如有疑问，请通过运营主体公开的联系渠道反馈。",
    ],
  },
] as const

export default function TermsPage() {
  return (
    <LegalDocument
      index="LEGAL / TERMS"
      title="服务条款"
      summary="使用账户与产品功能前，请先了解双方的权利、责任和使用边界。"
      effectiveDate="2026年"
      sections={sections}
      alternateHref="/privacy"
      alternateLabel="查看隐私政策"
    />
  )
}
