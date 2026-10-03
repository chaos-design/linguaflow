import type { Metadata } from "next"
import { LegalDocument } from "../../components/legal-document"

export const metadata: Metadata = {
  title: "隐私政策",
  description: "LinguaFlow 隐私政策模板。",
}

const sections = [
  {
    title: "1. 我们处理的信息",
    items: [
      "账户信息：邮箱地址、账户标识和邮箱验证状态。",
      "认证信息：由认证服务处理的密码凭据、验证码及会话信息。",
      "技术信息：为保障安全和排查故障所需的访问时间、设备、浏览器及必要日志。",
      "业务信息：你主动提交或在产品功能中产生的数据。",
    ],
  },
  {
    title: "2. 信息使用目的",
    items: [
      "创建和管理账户，完成登录、验证、找回密码与会话保护。",
      "提供、维护和改进产品功能。",
      "识别异常访问、欺诈、滥用与安全风险。",
      "履行适用法律要求并处理用户请求。",
    ],
  },
  {
    title: "3. 第三方服务",
    paragraphs: [
      "LinguaFlow 使用 Supabase 提供认证与学习数据存储。本地视频文件保留在用户设备中，不上传到 Supabase；生产运营方应在上线前列明实际使用的服务商、处理地点、共享范围和对应隐私政策。",
    ],
  },
  {
    title: "4. Cookie 与本地存储",
    paragraphs: [
      "服务会使用必要的 Cookie 或同类技术维持登录会话、刷新身份状态并保护私有路由。除非生产版本另有说明，这些技术不应用于无关的广告追踪。",
      "用户授权的本地视频文件句柄保存在当前浏览器的 IndexedDB，仅用于再次读取原文件。清除浏览器站点数据会移除此访问记录。",
    ],
  },
  {
    title: "5. 保存与保护",
    paragraphs: [
      "信息仅在实现上述目的和满足法律要求所需的期限内保存。运营方应采用访问控制、传输保护、密钥隔离和日志治理等合理措施降低未经授权访问风险。",
    ],
  },
  {
    title: "6. 你的权利",
    paragraphs: [
      "根据适用法律，你可以请求访问、更正、删除或导出个人信息，也可以撤回同意或注销账户。具体渠道、处理期限和例外情形应由生产运营方补充。",
    ],
  },
  {
    title: "7. 政策更新与联系",
    paragraphs: [
      "政策发生重要变化时，将通过页面或其他合理方式说明。如对个人信息处理有疑问，请通过运营主体公开的隐私联系渠道反馈。",
    ],
  },
] as const

export default function PrivacyPage() {
  return (
    <LegalDocument
      index="LEGAL / PRIVACY"
      title="隐私政策"
      summary="这里说明账户与产品数据会被如何收集、使用、保存和保护。"
      effectiveDate="2026年"
      sections={sections}
      alternateHref="/terms"
      alternateLabel="查看服务条款"
    />
  )
}
