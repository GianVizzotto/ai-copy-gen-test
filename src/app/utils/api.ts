import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-e39b424e`;

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface GenerateResponse {
  response: {
    id: string;
    type: string;
    role: string;
    content: Array<{
      type: string;
      text: string;
    }>;
    model: string;
    stop_reason: string;
    usage: {
      input_tokens: number;
      output_tokens: number;
    };
  };
}

/**
 * Test server connectivity
 */
export async function testServerConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`
      }
    });
    return response.ok;
  } catch (error) {
    console.error('Server health check failed:', error);
    return false;
  }
}

/**
 * Call the Claude API via the backend
 * @param messages Array of message objects with role and content
 * @param systemPrompt Optional system prompt string
 * @returns Response from Claude API
 */
export async function callClaude(
  messages: ClaudeMessage[],
  systemPrompt?: string
): Promise<GenerateResponse> {
  try {
    console.log(`Making request to: ${API_BASE_URL}/generate`);
    
    const response = await fetch(`${API_BASE_URL}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify({
        messages,
        ...(systemPrompt && { system: systemPrompt })
      })
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
      let errorMessage = `API call failed with status ${response.status}`;
      try {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        errorMessage = errorData.error || errorData.details || errorMessage;
      } catch (e) {
        // If response is not JSON, use status text
        const text = await response.text();
        console.error('Error response text:', text);
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error calling Claude API:', error);
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Network error: Unable to connect to the server. Please check your connection and try again.');
    }
    throw error;
  }
}

/**
 * Extract text content from Claude API response
 * @param response Response object from callClaude
 * @returns Extracted text string
 */
export function extractTextFromResponse(response: GenerateResponse): string {
  const textContent = response.response.content.find(c => c.type === 'text');
  return textContent?.text || '';
}