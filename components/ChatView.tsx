import React, { useState, useRef, useEffect } from 'react';
import { complexChatQuery, quickChatQuery, streamChatQuery, connectLiveSession } from '../services/gemini';
import { LiveAudioPlayer, LiveAudioRecorder } from '../services/liveAudio';
import { ChatMessage } from '../types';
import { IconMessage, IconBrain, IconMic, IconMicOff, IconSparkles } from './Icons';

export const ChatView = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      content: 'Hello, I am your medical AI consultant. How can I assist you with your diagnostic questions today?',
      timestamp: Date.now()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'fast' | 'deep'>('deep');
  
  // Real-time Gemini Live API state
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [liveStatus, setLiveStatus] = useState<string>('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const liveSessionRef = useRef<ReturnType<typeof connectLiveSession> | null>(null);
  const audioPlayerRef = useRef<LiveAudioPlayer | null>(null);
  const audioRecorderRef = useRef<LiveAudioRecorder | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Clean up Live API audio session on unmount
  useEffect(() => {
    return () => {
      stopLiveSession();
    };
  }, []);

  const stopLiveSession = () => {
    if (audioRecorderRef.current) {
      audioRecorderRef.current.stop();
      audioRecorderRef.current = null;
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.close();
      audioPlayerRef.current = null;
    }
    if (liveSessionRef.current) {
      liveSessionRef.current.close();
      liveSessionRef.current = null;
    }
    setIsLiveActive(false);
    setLiveStatus('');
  };

  const startLiveSession = async () => {
    try {
      setLiveStatus('Connecting to Gemini 3.8 Live...');
      setIsLiveActive(true);

      const player = new LiveAudioPlayer();
      audioPlayerRef.current = player;

      const session = connectLiveSession({
        onAudio: (base64Pcm) => {
          setLiveStatus('Consultant speaking...');
          player.playChunk(base64Pcm);
        },
        onText: (text) => {
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last && last.role === 'model' && (Date.now() - last.timestamp < 10000)) {
              return [
                ...prev.slice(0, -1),
                { ...last, content: last.content + ' ' + text }
              ];
            }
            return [
              ...prev,
              {
                id: Date.now().toString(),
                role: 'model',
                content: text,
                timestamp: Date.now(),
              }
            ];
          });
        },
        onInterrupted: () => {
          player.interrupt();
          setLiveStatus('Listening...');
        },
        onError: (err) => {
          console.error('Live API Error:', err);
          setLiveStatus(`Error: ${err}`);
          setTimeout(() => stopLiveSession(), 3000);
        },
        onClose: () => {
          setIsLiveActive(false);
          setLiveStatus('');
        }
      });

      liveSessionRef.current = session;

      const recorder = new LiveAudioRecorder((base64Pcm) => {
        if (session.isOpen()) {
          session.sendAudio(base64Pcm);
        }
      });

      await recorder.start();
      audioRecorderRef.current = recorder;
      setLiveStatus('Live voice active — speak now (16kHz PCM stream)');
    } catch (err: any) {
      console.error('Failed to start Live Voice session:', err);
      setLiveStatus(`Microphone access error: ${err.message || 'Permission denied'}`);
      stopLiveSession();
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userText,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const botMessageId = (Date.now() + 1).toString();

    try {
      if (mode === 'fast') {
        const responseText = await quickChatQuery(userText);
        setMessages(prev => [
          ...prev,
          {
            id: botMessageId,
            role: 'model',
            content: responseText,
            timestamp: Date.now()
          }
        ]);
      } else {
        // Deep Thinking with streaming response over SSE
        let accumulatedText = '';
        
        // Add placeholder bot message
        setMessages(prev => [
          ...prev,
          {
            id: botMessageId,
            role: 'model',
            content: '',
            timestamp: Date.now()
          }
        ]);

        const history = messages.map(m => ({
          role: m.role,
          parts: [{ text: m.content }]
        }));

        try {
          await streamChatQuery(userText, history, (chunk) => {
            accumulatedText += chunk;
            setMessages(prev =>
              prev.map(m =>
                m.id === botMessageId
                  ? { ...m, content: accumulatedText }
                  : m
              )
            );
          });
        } catch (streamErr) {
          console.warn('Streaming fallback to standard complex chat query', streamErr);
          const responseText = await complexChatQuery(history, userText);
          setMessages(prev =>
            prev.map(m =>
              m.id === botMessageId
                ? { ...m, content: responseText }
                : m
            )
          );
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMsg: ChatMessage = {
        id: botMessageId,
        role: 'model',
        content: "I apologize, but I encountered an error processing your clinical request. Please try again.",
        timestamp: Date.now(),
        isError: true
      };
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== botMessageId);
        return [...filtered, errorMsg];
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      {/* Top Banner for Live Voice Status */}
      {isLiveActive && (
        <div className="bg-gradient-to-r from-cyan-900 to-slate-900 text-white px-4 py-2.5 flex items-center justify-between shadow-md z-20 border-b border-cyan-800">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">Gemini 3.8 Live API Active</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-cyan-950 text-cyan-200 border border-cyan-700">2-Way Voice</span>
              </div>
              <p className="text-xs text-slate-300">{liveStatus || 'Live Voice Consultation in progress'}</p>
            </div>
          </div>
          <button
            onClick={stopLiveSession}
            className="px-3 py-1 bg-red-600/80 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
          >
            <IconMicOff className="w-3.5 h-3.5" />
            End Voice Call
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 lg:p-8 pb-28">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-[85%] lg:max-w-[75%] rounded-2xl p-4 shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-medical-600 text-white rounded-br-none' 
                    : msg.isError 
                      ? 'bg-red-50 text-red-800 border border-red-200 rounded-bl-none'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                }`}
              >
                {msg.role === 'model' && (
                  <div className="flex items-center gap-2 mb-2 opacity-70 border-b border-black/5 pb-1">
                    <IconBrain className="w-4 h-4 text-medical-600" />
                    <span className="text-xs font-semibold uppercase">{mode === 'deep' ? 'Deep Analysis (Streaming)' : 'Fast Response'}</span>
                  </div>
                )}
                <div className="whitespace-pre-wrap leading-relaxed">
                  {msg.content || (
                    <span className="inline-flex items-center gap-1 text-slate-400 italic text-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-medical-500 animate-pulse"></span>
                      Reasoning with medical knowledge...
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
          {isLoading && !messages[messages.length - 1]?.content && (
            <div className="flex justify-start">
              <div className="bg-white p-4 rounded-2xl rounded-bl-none shadow-sm border border-slate-200 flex items-center gap-3">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-medical-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                  <div className="w-2 h-2 bg-medical-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 bg-medical-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
                <span className="text-sm text-slate-500 font-medium">Consulting clinical models...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="bg-white border-t border-slate-200 p-4 absolute bottom-0 w-full z-10">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-slate-100 p-1 rounded-lg flex text-xs font-medium">
              <button 
                onClick={() => setMode('fast')}
                className={`px-3 py-1 rounded-md transition-all ${mode === 'fast' ? 'bg-white text-medical-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Fast (Flash Lite)
              </button>
              <button 
                onClick={() => setMode('deep')}
                className={`px-3 py-1 rounded-md transition-all ${mode === 'deep' ? 'bg-white text-medical-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Deep (Pro + Thinking)
              </button>
            </div>

            {/* Live Voice API Button */}
            <button
              onClick={isLiveActive ? stopLiveSession : startLiveSession}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all border ${
                isLiveActive
                  ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                  : 'bg-cyan-50 text-cyan-800 border-cyan-200 hover:bg-cyan-100'
              }`}
              title="Connect to Gemini 3.8 Live API for real-time voice consultation"
            >
              <IconMic className={`w-3.5 h-3.5 ${isLiveActive ? 'text-red-600 animate-pulse' : 'text-cyan-600'}`} />
              <span>{isLiveActive ? 'Disconnect Live' : 'Live Voice Consultant'}</span>
            </button>
          </div>

          <form onSubmit={handleSend} className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a medical question, diagnosis, or guideline query..."
              className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-medical-500 focus:border-medical-500 outline-none transition-all text-sm"
            />
            <button 
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-medical-600 text-white rounded-lg hover:bg-medical-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <IconMessage className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
