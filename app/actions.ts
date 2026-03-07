'use server'

import { z } from 'zod'
import { ModelId } from '@/components/model-selector'
import { Chat } from '@/types/chat'
import fs from 'fs'
import path from 'path'

const messageSchema = z.object({
  message: z.string().min(1, 'Message is required'),
})

// Read the system prompt from the file
const systemPrompt = fs.readFileSync(path.join(process.cwd(), 'lib/prompt.txt'), 'utf-8')

export async function sendMessage(chat: Chat, formData: FormData, model: ModelId) {
  const validatedFields = messageSchema.safeParse({
    message: formData.get('message'),
  })

  if (!validatedFields.success) {
    return {
      error: 'Invalid message'
    }
  }

  try {
    // Return the URL and the message for the client to make the request
    return {
      success: true,
      url: 'http://windows-machine:8080/v1/chat/completions',
      payload: {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...chat.messages,
          { role: 'user', content: validatedFields.data.message }
        ],
        stream: true,
      }
    }
  } catch (error) {
    console.error('Error:', error)
    return {
      error: 'Failed to get response'
    }
  }
} 