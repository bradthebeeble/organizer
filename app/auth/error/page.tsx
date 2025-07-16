import Link from "next/link"

const errorMessages = {
  CredentialsSignin: "Invalid email or password. Please try again.",
  AccessDenied: "Access denied. Please check your permissions.",
  Verification: "Email verification required. Please check your email.",
  OAuthSignin: "Error occurred during OAuth sign in. Please try again.",
  OAuthCallback: "Error occurred during OAuth callback. Please try again.",
  OAuthCreateAccount: "Could not create OAuth account. Please try again.",
  EmailCreateAccount: "Could not create email account. Please try again.",
  Callback: "Error occurred during callback. Please try again.",
  Default: "An error occurred during authentication. Please try again."
}

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const error = params.error
  const errorMessage = errorMessages[error as keyof typeof errorMessages] || errorMessages.Default

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50" role="main">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Authentication Error
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600" role="alert">
            {errorMessage}
          </p>
        </div>
        <div className="mt-8">
          <Link
            href="/auth/signin"
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            aria-label="Return to sign in page"
          >
            Try Again
          </Link>
        </div>
      </div>
    </div>
  )
}