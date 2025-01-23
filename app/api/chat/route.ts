import { NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();

    // Validate input
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Invalid input', details: 'Messages array is required' },
        { status: 400 }
      );
    }

    // Call xAI API
    const response = await axios.post(
      'https://api.x.ai/v1/chat/completions',
      {
        messages: messages,
        model: 'grok-beta',
        temperature: 0.7,
        max_tokens: 2000
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.XAI_API_KEY}`
        }
      }
    );

    // Extract and return the response content
    return NextResponse.json(response.data.choices[0].message);

  } catch (error: any) {
    console.error('xAI API Error:', error.response?.data || error.message);
    
    // Handle specific error cases
    if (error.response?.status === 401) {
      return NextResponse.json(
        { error: 'Authentication error', details: 'Invalid API key' },
        { status: 401 }
      );
    }

    if (error.response?.status === 429) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', details: 'Too many requests' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Failed to process request', 
        details: error.message || 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
} 