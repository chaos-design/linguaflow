import { CircleAlertIcon, CircleCheckIcon } from "lucide-react"
import { Alert, AlertDescription } from "../../components/ui/alert"

export function AuthFeedback({ error, message }: { error: string; message: string }) {
  if (error) {
    return (
      <Alert variant="destructive">
        <CircleAlertIcon aria-hidden="true" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (message) {
    return (
      <Alert role="status">
        <CircleCheckIcon aria-hidden="true" />
        <AlertDescription>
          <output>{message}</output>
        </AlertDescription>
      </Alert>
    )
  }

  return null
}
