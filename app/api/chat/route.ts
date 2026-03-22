import { NextRequest } from 'next/server'
import { auth } from '@/auth'

export async function POST(request: NextRequest) {
  // Verify session — defence-in-depth in addition to middleware
  const session = await auth()

  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const body = await request.json()
  const langGraphUrl = process.env.LANGGRAPH_API_URL || 'http://localhost:8000/chat'

  // Forward the Keycloak access token so LangGraph can validate it independently
  const upstreamHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    ...(session.accessToken && {
      Authorization: `Bearer ${session.accessToken}`,
    }),
  }

  const response = await fetch(langGraphUrl, {
    method: 'POST',
    headers: upstreamHeaders,
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    return new Response(
      JSON.stringify({ error: 'Failed to connect to LangGraph backend' }),
      { status: response.status, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // If the backend returned a real event-stream, proxy it as-is
  const contentType = response.headers.get('Content-Type') ?? ''
  if (body.stream && response.body && contentType.includes('text/event-stream')) {
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  }

  // Non-streaming (or JSON) response — return only the `response` field
  const data = await response.json()
  return new Response(JSON.stringify(data.response ?? data), {
    headers: { 'Content-Type': 'application/json' },
  })
}
