"use client"

import { LogOutIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { Button } from "../../components/ui/button"
import { Spinner } from "../../components/ui/spinner"
import { createClient } from "../../lib/supabase/client"

export function SignOutButton() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [isSigningOut, setIsSigningOut] = useState(false)

  async function handleSignOut() {
    setIsSigningOut(true)
    await supabase.auth.signOut()
    router.replace("/")
    router.refresh()
  }

  return (
    <Button
      variant="outline"
      size="xs"
      type="button"
      disabled={isSigningOut}
      onClick={handleSignOut}
    >
      {isSigningOut ? (
        <Spinner data-icon="inline-start" />
      ) : (
        <LogOutIcon data-icon="inline-start" aria-hidden="true" />
      )}
      退出登录
    </Button>
  )
}
