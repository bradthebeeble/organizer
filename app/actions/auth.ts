import { signIn } from "@/auth"
import { redirect } from "next/navigation"
import { AuthError } from "next-auth"

export async function authenticate(formData: FormData) {
  try {
    await signIn("credentials", {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      redirectTo: "/dashboard",
    })
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          redirect("/auth/error?error=CredentialsSignin")
        default:
          redirect("/auth/error?error=Default")
      }
    }
    throw error
  }
}