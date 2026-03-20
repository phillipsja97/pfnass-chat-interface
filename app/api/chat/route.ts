import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const body = await request.json()

  const langGraphUrl = process.env.LANGGRAPH_API_URL || 'http://localhost:8000/chat'

  const response = await fetch(langGraphUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    return new Response(
      JSON.stringify({ error: 'Failed to connect to LangGraph backend' }),
      { status: response.status, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Stream the response back to the client
  if (body.stream && response.body) {
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  }

  // Non-streaming response
  const data = await response.json()
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  })
}
