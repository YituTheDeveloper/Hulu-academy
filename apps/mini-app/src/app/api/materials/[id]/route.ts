import { NextRequest, NextResponse } from 'next/server'
import { verifyAccessToken, getTokenFromCookies } from '@/lib/auth'
import { getUserEntitlement } from '@/lib/referral-service'
import { prisma } from '@hulu/db'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'hulu-materials'
const SIGNED_URL_TTL = 300 // 5 minutes

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const token = getTokenFromCookies(req.headers.get('cookie'))
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const session = await verifyAccessToken(token)
    const user = await prisma.user.findUnique({ where: { id: session.sub } })
    if (!user || user.status === 'SUSPENDED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Entitlement check — EVERY time, server-side
    const entitlement = await getUserEntitlement(user.id)
    if (!entitlement) {
      return NextResponse.json({ error: 'Access denied', code: 'NO_ENTITLEMENT' }, { status: 403 })
    }

    const { id } = await params
    const material = await prisma.material.findFirst({
      where: {
        id,
        productId: entitlement.productId,
        status: 'ACTIVE',
      },
    })

    if (!material) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 })
    }

    // Return metadata only if no storage key configured yet
    if (!material.storageKey) {
      return NextResponse.json({
        id: material.id,
        title: material.title,
        description: material.description,
        fileType: material.fileType,
        signedUrl: null,
        message: 'Material content coming soon',
      })
    }

    // Generate short-lived signed URL via Supabase Storage
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return NextResponse.json({ error: 'Storage not configured' }, { status: 503 })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(material.storageKey, SIGNED_URL_TTL)

    if (error || !data?.signedUrl) {
      console.error('Supabase signed URL error:', error)
      return NextResponse.json({ error: 'Could not generate access URL' }, { status: 500 })
    }

    return NextResponse.json({
      id: material.id,
      title: material.title,
      description: material.description,
      fileType: material.fileType,
      signedUrl: data.signedUrl,
      expiresIn: SIGNED_URL_TTL,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
