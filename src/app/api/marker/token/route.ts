import { NextRequest, NextResponse } from 'next/server'
import { createModalToken, getClientIp, getModalTokenSecret } from '@/lib/server/modalToken'

/**
 * Issue a short-lived token for uploading a large PDF straight to the free Modal
 * converter (see src/lib/server/modalToken.ts). Small PDFs go through
 * /api/marker/local, which adds the token itself.
 */
export async function POST(request: NextRequest) {
  const secret = getModalTokenSecret()
  if (!secret) {
    // Protection not configured (e.g. local development): Modal doesn't require a token either
    return NextResponse.json({ success: true, token: null })
  }
  return NextResponse.json(
    { success: true, token: createModalToken(secret, getClientIp(request.headers)) },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
