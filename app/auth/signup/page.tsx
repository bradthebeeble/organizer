import Link from "next/link"

import { signInWithGoogle } from "@/app/actions/auth"
import { handleSignUp } from "@/app/actions/signup"

import { SignUpForm } from "./SignUpForm"

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Or{" "}
            <Link
              href="/auth/signin"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              sign in to your existing account
            </Link>
          </p>
          {params.error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600 text-center">
                {params.error === "user-exists" && "An account with this email already exists."}
                {params.error === "missing-fields" && "Please fill in all required fields."}
                {params.error === "weak-password" && "Password must contain at least 8 characters, including uppercase, lowercase, numbers and special characters."}
                {params.error === "signup-failed" && "Account creation failed. Please try again."}
              </p>
            </div>
          )}
        </div>
        
        <SignUpForm handleSignUp={handleSignUp} signInWithGoogle={signInWithGoogle} />
      </div>
    </div>
  )
}