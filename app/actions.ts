'use server'

import { z } from 'zod'
import { ModelId } from '@/components/model-selector'

const messageSchema = z.object({
  message: z.string().min(1, 'Message is required'),
})

export async function sendMessage(formData: FormData, model: ModelId) {
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
      url: 'http://127.0.0.1:11434/v1/chat/completions',
      payload: {
        model,
        messages: [
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