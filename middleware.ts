import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ALLOWED_COUNTRIES = ['IL']

export function middleware(request: NextRequest) {
  const country = request.geo?.country ?? 'IL'

  if (!ALLOWED_COUNTRIES.includes(country)) {
    return new NextResponse(
      '<html dir="rtl"><body style="font-family:Arial;text-align:center;padding:50px"><h1>שירות זה זמין בישראל בלבד</h1></body></html>',
      { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/((?!api|_next/static|_next/image|favicon.ico).*)',
}
