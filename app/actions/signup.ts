"use server"

import bcrypt from "bcryptjs"
import { redirect } from "next/navigation"

import { signIn } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function handleSignUp(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const name = formData.get("name") as string
  
  if (!email || !password || !name) {
    redirect("/auth/signup?error=missing-fields")
  }
  
  // Validate password strength
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
  if (!passwordRegex.test(password)) {
    redirect("/auth/signup?error=weak-password")
  }
  
  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })
    
    if (existingUser) {
      redirect("/auth/signup?error=user-exists")
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)
    
    // Create user
    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      }
    })
    
    // Sign in the user after creation
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/dashboard",
    })
  } catch (error) {
    console.error("Signup error:", error)
    redirect("/auth/signup?error=signup-failed")
  }
}