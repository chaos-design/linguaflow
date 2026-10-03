import Link from "next/link"
import { Brand } from "../components/brand"
import { buttonVariants } from "../components/ui/button"

export default function NotFound() {
  return (
    <main className="not-found-page">
      <Brand />
      <div>
        <span>404 / NOT FOUND</span>
        <h1>这里还没有页面。</h1>
        <Link className={buttonVariants()} href="/">
          返回首页
        </Link>
      </div>
    </main>
  )
}
