import { auth } from "@/auth"
import { redirect } from "next/navigation"

export async function getCurrentUser() {
  const session = await auth()
  return session?.user
}

export async function requireAuth() {
  const session = await auth()
  
  if (!session?.user) {
    redirect("/auth/signin")
  }
  
  return session.user
}

export async function getServerSession() {
  return await auth()
}

export { auth, signIn, signOut } from "@/auth"