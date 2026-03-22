'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { ChatMessage } from './chat-message'
import { ChatInput } from './chat-input'
import { ThinkingIndicator } from './thinking-indicator'
import { UserMenu } from '@/components/auth/user-menu'
import { ThemeToggle } from '@/components/auth/theme-toggle'
import type { Message } from '@/types/chat'

export function ChatContainer() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const threadIdRef = useRef<string>(crypto.randomUUID())
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isThinking, scrollToBottom])

  const handleSubmit = async () => {
    const userMessage = input.trim()
    if (!userMessage || isLoading) return

    // Add user message
    const newUserMessage: Message = { role: 'user', content: userMessage }
    const updatedMessages = [...messages, newUserMessage]
    setMessages(updatedMessages)
    setInput('')
    setIsLoading(true)
    setIsThinking(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages,
          thread_id: threadIdRef.current,
          stream: true,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      const responseContentType = response.headers.get('Content-Type') ?? ''

      // Add empty assistant message
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }])
      setIsThinking(false)

      if (!responseContentType.includes('text/event-stream')) {
        // Backend returned plain JSON — just display the text directly
        const text = await response.json()
        const assistantText = typeof text === 'string' ? text : JSON.stringify(text)
        setMessages((prev) => {
          const newMessages = [...prev]
          const lastMessage = newMessages[newMessages.length - 1]
          if (lastMessage?.role === 'assistant') {
            lastMessage.content = assistantText
          }
          return newMessages
        })
      } else {
        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('No reader available')
        }

        const decoder = new TextDecoder()
        let assistantContent = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })

          // Parse SSE data
          const lines = chunk.split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') continue

              try {
                const parsed = JSON.parse(data)
                // Handle different SSE formats - adjust based on your LangGraph backend
                const token = parsed.content || parsed.token || parsed.text || data
                if (typeof token === 'string') {
                  assistantContent += token
                  setMessages((prev) => {
                    const newMessages = [...prev]
                    const lastMessage = newMessages[newMessages.length - 1]
                    if (lastMessage?.role === 'assistant') {
                      lastMessage.content = assistantContent
                    }
                    return newMessages
                  })
                }
              } catch {
                // If not JSON, treat as plain text token
                if (data && data !== '[DONE]') {
                  assistantContent += data
                  setMessages((prev) => {
                    const newMessages = [...prev]
                    const lastMessage = newMessages[newMessages.length - 1]
                    if (lastMessage?.role === 'assistant') {
                      lastMessage.content = assistantContent
                    }
                    return newMessages
                  })
                }
              }
            } else if (line && !line.startsWith(':')) {
              // Handle raw text streaming (non-SSE format)
              assistantContent += line
              setMessages((prev) => {
                const newMessages = [...prev]
                const lastMessage = newMessages[newMessages.length - 1]
                if (lastMessage?.role === 'assistant') {
                  lastMessage.content = assistantContent
                }
                return newMessages
              })
            }
          }
        }
      }
    } catch (error) {
      console.error('[v0] Chat error:', error)
      setIsThinking(false)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, there was an error processing your message. Please try again.',
        },
      ])
    } finally {
      setIsLoading(false)
      setIsThinking(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b-2 border-border px-4 py-3 shrink-0">
        <h2 className="text-sm font-semibold">Agent Chat</h2>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6">
          {messages.length === 0 ? (
            <div className="flex h-full min-h-[50vh] flex-col items-center justify-center text-center">
              <h1 className="mb-2 text-2xl font-semibold">Agent Chat Interface</h1>
              <p className="text-muted-foreground">
                Send a message to start the conversation.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {messages.map((message, index) => (
                <ChatMessage key={index} message={message} />
              ))}
              {isThinking && <ThinkingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Input area */}
      <ChatInput
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        isLoading={isLoading}
      />
    </div>
  )
}
