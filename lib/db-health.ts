import { prisma } from './prisma'

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy'
  timestamp: Date
  error?: string
}

export async function checkDatabaseHealth(): Promise<HealthCheckResult> {
  try {
    await prisma.$queryRaw`SELECT 1`
    return { status: 'healthy', timestamp: new Date() }
  } catch (error) {
    return { 
      status: 'unhealthy', 
      error: error instanceof Error ? error.message : 'Unknown error', 
      timestamp: new Date() 
    }
  }
}