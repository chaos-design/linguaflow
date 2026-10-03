import { NextResponse } from "next/server"
import { readSupabasePublicConfig } from "../../../lib/supabase/public-config"

export const dynamic = "force-dynamic"

export function GET() {
  const headers = {
    "Cache-Control": "no-store",
  }

  try {
    readSupabasePublicConfig()
    return NextResponse.json(
      {
        service: "linguaflow",
        status: "ok",
      },
      { headers },
    )
  } catch {
    return NextResponse.json(
      {
        service: "linguaflow",
        status: "error",
      },
      { headers, status: 503 },
    )
  }
}
