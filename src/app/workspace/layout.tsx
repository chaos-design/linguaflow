import { redirect } from "next/navigation"
import { WorkspaceShell } from "../../components/workspace-shell"
import { getOptionalAuthUser } from "../../server/auth/auth-user"

export const dynamic = "force-dynamic"

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getOptionalAuthUser()
  if (!user) {
    redirect("/login?next=%2Fworkspace")
  }

  return <WorkspaceShell email={user.email}>{children}</WorkspaceShell>
}
