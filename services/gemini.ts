// Client-side API Service
// All Gemini API calls run securely through the backend proxy (/api/gemini/*) and WebSocket (/live)

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

import { XRayROI } from '../types';

export interface AnalysisResponse {
  text: string;
  groundingChunks?: GroundingChunk[];
}

export interface XRayAnalysisParams {
  imageData: string;
  mimeType: string;
  examType: string;
  viewProjection?: string;
  clinicalHistory?: string;
  useDeepThinking?: boolean;
  roi?: XRayROI;
  rois?: XRayROI[];
}

/**
 * Multi-frame ultrasound and medical media analysis via server route
 */
export const analyzeMedicalMedia = async (
  mediaItems: Array<{ data: string; mimeType: string }>,
  promptText: string,
  useDeepThinking: boolean = true
): Promise<AnalysisResponse> => {
  try {
    const res = await fetch('/api/gemini/analyze-media', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mediaItems,
        promptText,
        useDeepThinking,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Server responded with status ${res.status}`);
    }

    const data = await res.json();
    return {
      text: data.text || '',
      groundingChunks: data.groundingChunks || [],
    };
  } catch (error: any) {
    console.error('Client analyzeMedicalMedia error:', error);
    throw error;
  }
};

/**
 * Fast chat query using lightweight flash model via server route
 */
export const quickChatQuery = async (message: string): Promise<string> => {
  try {
    const res = await fetch('/api/gemini/quick-chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Server responded with status ${res.status}`);
    }

    const data = await res.json();
    return data.text || '';
  } catch (error: any) {
    console.error('Client quickChatQuery error:', error);
    throw error;
  }
};

/**
 * Deep thinking complex medical consultant query via server route
 */
export const complexChatQuery = async (
  history: Array<{ role: string; parts: any[] }>,
  message: string
): Promise<string> => {
  try {
    const res = await fetch('/api/gemini/complex-chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ history, message }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Server responded with status ${res.status}`);
    }

    const data = await res.json();
    return data.text || '';
  } catch (error: any) {
    console.error('Client complexChatQuery error:', error);
    throw error;
  }
};

/**
 * Medical research paper and document analysis via server route
 */
export const analyzeDocument = async (base64Data: string, mimeType: string): Promise<string> => {
  try {
    const res = await fetch('/api/gemini/analyze-document', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ base64Data, mimeType }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Server responded with status ${res.status}`);
    }

    const data = await res.json();
    return data.text || '';
  } catch (error: any) {
    console.error('Client analyzeDocument error:', error);
    throw error;
  }
};

/**
 * Plain film X-Ray radiograph analysis with ACR structured report via server route
 */
export const analyzeXRayImage = async (params: XRayAnalysisParams): Promise<AnalysisResponse> => {
  try {
    const res = await fetch('/api/gemini/analyze-xray', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Server responded with status ${res.status}`);
    }

    const data = await res.json();
    return {
      text: data.text || '',
      groundingChunks: data.groundingChunks || [],
    };
  } catch (error: any) {
    console.error('Client analyzeXRayImage error:', error);
    throw error;
  }
};

/**
 * Stream chat content chunk-by-chunk via Server-Sent Events
 */
export const streamChatQuery = async (
  message: string,
  history: Array<{ role: string; parts: any[] }> = [],
  onChunk: (chunk: string) => void
): Promise<string> => {
  const res = await fetch('/api/gemini/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Streaming failed with status ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const payload = line.replace('data: ', '').trim();
        if (payload === '[DONE]') break;
        try {
          const parsed = JSON.parse(payload);
          if (parsed.text) {
            fullText += parsed.text;
            onChunk(parsed.text);
          } else if (parsed.error) {
            throw new Error(parsed.error);
          }
        } catch (e) {
          // ignore parse errors for partial chunks
        }
      }
    }
  }

  return fullText;
};

/**
 * Connect to real-time Gemini Live API session over WebSocket
 */
export interface LiveSessionCallbacks {
  onAudio?: (base64Pcm: string) => void;
  onText?: (text: string) => void;
  onInterrupted?: () => void;
  onError?: (err: string) => void;
  onClose?: () => void;
}

export const connectLiveSession = (callbacks: LiveSessionCallbacks) => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/live`;
  const ws = new WebSocket(wsUrl);

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.audio && callbacks.onAudio) {
        callbacks.onAudio(msg.audio);
      }
      if (msg.text && callbacks.onText) {
        callbacks.onText(msg.text);
      }
      if (msg.interrupted && callbacks.onInterrupted) {
        callbacks.onInterrupted();
      }
      if (msg.error && callbacks.onError) {
        callbacks.onError(msg.error);
      }
    } catch (e) {
      console.error('Error handling Live WS message:', e);
    }
  };

  ws.onerror = (e) => {
    console.error('Live WS error:', e);
    callbacks.onError?.('WebSocket connection error');
  };

  ws.onclose = () => {
    callbacks.onClose?.();
  };

  return {
    sendAudio: (base64Pcm: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ audio: base64Pcm }));
      }
    },
    sendVideo: (base64Jpeg: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ video: base64Jpeg, mimeType: 'image/jpeg' }));
      }
    },
    sendText: (text: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ text }));
      }
    },
    close: () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    },
    isOpen: () => ws.readyState === WebSocket.OPEN,
  };
};
