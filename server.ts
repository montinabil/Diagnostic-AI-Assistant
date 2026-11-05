import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, ThinkingLevel, Modality } from '@google/genai';
import type { LiveServerMessage } from '@google/genai';
import { ULTRASOUND_KNOWLEDGE_BASE } from './services/ultrasoundKnowledge.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env and .env.local if present
['.env', '.env.local'].forEach((file) => {
  const filePath = path.resolve(__dirname, file);
  if (fs.existsSync(filePath)) {
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key] && val) {
          process.env[key] = val;
        }
      }
    }
  }
});

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Support large payloads for multi-image medical scans and cine-loops
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Shared server-side Google GenAI client
const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
if (!apiKey) {
  console.warn('GEMINI_API_KEY is not defined in environment variables.');
}

const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const COMPLEX_MODEL = 'gemini-3.8-flash';
const FAST_MODEL = 'gemini-3.1-flash-lite';
const LIVE_MODEL = 'gemini-3.8-live';

// Graceful retry helper for transient network spikes / 503 errors
async function generateWithRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 1200): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    const errMsg = String(err?.message || err?.status || '');
    const isTransient = errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('UNAVAILABLE') || err?.status === 503;
    if (retries > 0 && isTransient) {
      console.warn(`Transient upstream service error, retrying in ${delayMs}ms... (${retries} attempts left)`);
      await new Promise((r) => setTimeout(r, delayMs));
      return generateWithRetry(fn, retries - 1, delayMs * 2);
    }
    throw err;
  }
}

// ==========================================
// 1. Ultrasound & Multimodal Media Analysis
// ==========================================
app.post('/api/gemini/analyze-media', async (req, res) => {
  try {
    const { mediaItems, promptText, useDeepThinking = true } = req.body;

    if (!Array.isArray(mediaItems) || mediaItems.length === 0) {
      return res.status(400).json({ error: 'At least one media item is required.' });
    }

    const parts: any[] = mediaItems.map((item: { data: string; mimeType: string }) => ({
      inlineData: {
        mimeType: item.mimeType,
        data: item.data,
      },
    }));

    parts.push({
      text: promptText || 'Analyze the provided media items for diagnostic assessment.',
    });

    const tools = [{ googleSearch: {} }];

    const response = await generateWithRetry(() =>
      ai.models.generateContent({
        model: COMPLEX_MODEL,
        contents: { parts },
        config: {
          tools,
          thinkingConfig: useDeepThinking ? { thinkingLevel: ThinkingLevel.HIGH } : undefined,
          systemInstruction: `You are an expert medical AI assistant specialized in ultrasound and medical imaging analysis. 
Analyze the provided image(s) or video(s) with extreme precision. 
If multiple images are provided, compare them and synthesize the findings.

${ULTRASOUND_KNOWLEDGE_BASE}

Use the above reference knowledge as your primary diagnostic framework for abdominal ultrasound.

Structure your response with the following sections:
1. **Technical Findings**: Detailed observation of the visual features.
2. **Diagnostic Impression**: Potential diagnoses based on features.
3. **Differential Diagnosis**: Other possibilities.
4. **Recommendations**: Suggested next steps.

Use the Google Search tool to validate your findings against recent medical literature and cite sources.`,
        },
      })
    );

    return res.json({
      text: response.text || '',
      groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [],
    });
  } catch (error: any) {
    console.error('Server analyze-media error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to analyze medical media.',
    });
  }
});

// ==========================================
// 2. Quick Chat Query
// ==========================================
app.post('/api/gemini/quick-chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    const response = await generateWithRetry(() =>
      ai.models.generateContent({
        model: FAST_MODEL,
        contents: message,
        config: {
          systemInstruction: `You are a helpful medical assistant. Provide concise, fast responses. 
Reference this knowledge if relevant: ${ULTRASOUND_KNOWLEDGE_BASE.substring(0, 1000)}...`,
        },
      })
    );

    return res.json({
      text: response.text || '',
    });
  } catch (error: any) {
    console.error('Server quick-chat error:', error);
    return res.status(500).json({
      error: error.message || 'Quick chat query failed.',
    });
  }
});

// Helper to sanitize chat history for Gemini API
function sanitizeHistory(history: any[]): any[] {
  if (!Array.isArray(history) || history.length === 0) return [];
  const firstUserIdx = history.findIndex((h) => h && h.role === 'user');
  if (firstUserIdx === -1) return [];

  return history.slice(firstUserIdx).map((h) => ({
    role: h.role === 'model' ? 'model' : 'user',
    parts: Array.isArray(h.parts)
      ? h.parts.map((p: any) => (typeof p === 'string' ? { text: p } : p))
      : [{ text: typeof h.content === 'string' ? h.content : '' }],
  }));
}

// ==========================================
// 3. Complex Clinical Chat Query
// ==========================================
app.post('/api/gemini/complex-chat', async (req, res) => {
  try {
    const { history = [], message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    const sanitized = sanitizeHistory(history);
    const contents: any[] = [];
    for (const h of sanitized) {
      contents.push({ role: h.role, parts: h.parts });
    }
    contents.push({ role: 'user', parts: [{ text: message }] });

    const response = await generateWithRetry(() =>
      ai.models.generateContent({
        model: COMPLEX_MODEL,
        contents,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          systemInstruction: `You are a senior medical consultant. Use deep reasoning to answer complex clinical questions.

${ULTRASOUND_KNOWLEDGE_BASE}

Use the above reference knowledge to guide your clinical reasoning for ultrasound-related queries.`,
        },
      })
    );

    return res.json({
      text: response.text || '',
    });
  } catch (error: any) {
    console.error('Server complex-chat error:', error);
    return res.status(500).json({
      error: error.message || 'Complex chat query failed.',
    });
  }
});

// ==========================================
// 4. Medical Document Analysis
// ==========================================
app.post('/api/gemini/analyze-document', async (req, res) => {
  try {
    const { base64Data, mimeType } = req.body;
    if (!base64Data || !mimeType) {
      return res.status(400).json({ error: 'base64Data and mimeType are required.' });
    }

    const response = await ai.models.generateContent({
      model: COMPLEX_MODEL,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
          {
            text: 'Analyze this medical document. Provide a comprehensive summary, key clinical findings, and any relevant action items. If it is a research paper, summarize the methodology and conclusions.',
          },
        ],
      },
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
        systemInstruction: 'You are a medical research assistant. Analyze documents with precision.',
      },
    });

    return res.json({
      text: response.text || '',
    });
  } catch (error: any) {
    console.error('Server analyze-document error:', error);
    return res.status(500).json({
      error: error.message || 'Document analysis failed.',
    });
  }
});

// ==========================================
// 5. Plain Film X-Ray Radiography Analysis
// ==========================================
app.post('/api/gemini/analyze-xray', async (req, res) => {
  try {
    const {
      imageData,
      mimeType = 'image/jpeg',
      examType = 'Chest',
      viewProjection = 'Standard',
      clinicalHistory = '',
      useDeepThinking = true,
      roi,
      rois,
    } = req.body;

    if (!imageData) {
      return res.status(400).json({ error: 'imageData is required.' });
    }

    const cleanData = imageData.includes(',') ? imageData.split(',')[1] : imageData;

    const targets: any[] = Array.isArray(rois) && rois.length > 0
      ? rois
      : roi && roi.label
      ? [roi]
      : [];

    let roiPromptSection = '';
    if (targets.length > 0) {
      roiPromptSection = `
🎯 CLINICIAN TARGETED REGIONS OF INTEREST (ROI) - MULTIPLE FOCAL SITES (${targets.length} Area${targets.length > 1 ? 's' : ''} Identified):
The referring clinician/radiologist has explicitly annotated and targeted ${targets.length} distinct area${targets.length > 1 ? 's' : ''} on this image using clinical annotation markers (rectangles, circles, and directional arrows in designated colors) to guide your diagnostic evaluation:

${targets.map((t, idx) => {
  const shape = t.shape || 'rectangle';
  const color = t.color || 'cyan';
  const loc = t.anatomicalLocation || 'Designated Region';
  const coords = shape === 'arrow' && t.endX !== undefined
    ? `Origin [X: ${Math.round(t.x)}%, Y: ${Math.round(t.y)}%] pointing to Target [X: ${Math.round(t.endX)}%, Y: ${Math.round(t.endY)}%]`
    : `Normalized Origin [X: ${Math.round(t.x)}%, Y: ${Math.round(t.y)}%] (W: ${Math.round(t.width || 20)}%, H: ${Math.round(t.height || 20)}%)`;
  return `### TARGET SITE #${idx + 1}:
- Clinical Suspicion / Label: "${t.label}"
- Marker Tool & Color: ${shape.toUpperCase()} (${color})
- Anatomical Location: ${loc}
- Target Coordinates: ${coords}`;
}).join('\n\n')}

MANDATORY INSTRUCTIONS FOR MULTI-TARGET SCRUTINY:
1. In "## 3. SYSTEMATIC RADIOLOGICAL FINDINGS", systematically evaluate EACH of the ${targets.length} designated target sites under explicit numbered sub-headings:
${targets.map((t, idx) => `   - "### TARGET #${idx + 1} (${(t.shape || 'RECTANGLE').toUpperCase()}): ${t.label.toUpperCase()}"`).join('\n')}
   Detail the exact morphological findings (cortical breach, bone trabeculation, parenchymal consolidation, ground-glass opacity, air-fluid level, soft tissue swelling, or normal variant) at each marked site.
2. In "## 4. DIAGNOSTIC IMPRESSION", directly synthesize your conclusions regarding each targeted area (e.g. state whether each suspected lesion is confirmed, excluded, or indeterminate).
3. In "## 6. CLINICAL RECOMMENDATIONS", provide specific next steps addressing the findings at these marked targets.
`;
    }

    const promptText = `Perform an authoritative, board-certified diagnostic radiology analysis of this ${examType} Radiograph / X-Ray (Projection: ${viewProjection}).
${clinicalHistory ? `Patient Clinical Indication / Presentation: "${clinicalHistory}"` : 'Clinical Indication: Routine clinical evaluation.'}
${roiPromptSection}

Generate a formal, structured clinical radiology report following standard American College of Radiology (ACR) and RSNA formats. Structure the response strictly with the following sections:

## 1. EXAMINATION & TECHNIQUE
- Examination: ${examType} Plain Film Radiography
- Projection/View: ${viewProjection}
- Technical Quality: Comment on patient position, penetration, exposure, rotation, inspiratory effort (for CXR), and presence of motion or foreign artifacts.

## 2. CLINICAL INDICATION
- Clinical history and reason for radiographic study as provided.

## 3. SYSTEMATIC RADIOLOGICAL FINDINGS
Provide a comprehensive anatomical assessment:
- For Chest (CXR): Lungs & Tracheobronchial tree (consolidation, infiltrate, ground-glass opacity, air bronchograms, interstitial markings, atelectasis, nodules/masses), Pleural spaces & Costophrenic sulci (pleural effusion, pneumothorax, thickening), Cardiomediastinal silhouette (cardiothoracic ratio, cardiac size, aortic arch, mediastinal widening, hilar adenopathy), Osseous thorax & Soft tissues (ribs, clavicles, thoracic spine, subcutaneous emphysema), Diaphragms & Subdiaphragmatic space (free peritoneal air, contour).
- For Musculoskeletal / Extremity: Cortical bone continuity, presence/absence of fracture lines (transverse, oblique, spiral, comminuted), displacement, angulation, shortening, articular surface congruity, joint space narrowing/effusion, soft tissue swelling, periosteal reaction.
- For Abdomen (AXR / KUB): Bowel gas pattern, small vs large bowel caliber, air-fluid levels (distinguishing mechanical obstruction vs adynamic ileus), pneumoperitoneum (free subdiaphragmatic air, Rigler's sign), radiopaque urinary/gallbladder calculi, vascular calcifications, psoas lines.
- For Spine / Pelvis: Spinal alignment, curvature, vertebral body heights, disc space preservation, pedicle integrity, sacroiliac joints, femoral heads.

## 4. DIAGNOSTIC IMPRESSION
- Numbered definitive radiological diagnoses in order of clinical importance and acuity.
- If any critical finding is detected (e.g., tension pneumothorax, displaced unstable fracture, bowel perforation with free air), prefix with **[CRITICAL ACUTE FINDING]**.

## 5. DIFFERENTIAL DIAGNOSIS
- Rank-ordered list of plausible differential diagnoses with radiological rationale.

## 6. CLINICAL RECOMMENDATIONS & NEXT STEPS
- Actionable clinical steps (e.g. urgent surgical consult, orthogonal/cross-sectional imaging such as CT/MRI, immobilization/splinting, antibiotic regimen, follow-up radiographic interval).

Use the Google Search tool to validate findings against current radiology literature, ACR appropriateness criteria, and radiopaedia standards, citing authoritative sources.`;

    const parts = [
      {
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: cleanData,
        },
      },
      {
        text: promptText,
      },
    ];

    const tools = [{ googleSearch: {} }];

    const response = await generateWithRetry(() =>
      ai.models.generateContent({
        model: COMPLEX_MODEL,
        contents: { parts },
        config: {
          tools,
          thinkingConfig: useDeepThinking ? { thinkingLevel: ThinkingLevel.HIGH } : undefined,
          systemInstruction: `You are a Senior Consultant Diagnostic Radiologist specialized in digital radiography and plain film X-ray interpretation. 
Analyze radiographs with precise clinical terminology, standard anatomical descriptors, and adherence to ACR (American College of Radiology) reporting protocols. 
Provide a clear, authoritative, professional radiology report that a clinician can rely on for patient management.`,
        },
      })
    );

    return res.json({
      text: response.text || '',
      groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [],
    });
  } catch (error: any) {
    console.error('Server analyze-xray error:', error);
    return res.status(500).json({
      error: error.message || 'X-Ray analysis failed.',
    });
  }
});

// ==========================================
// 6. Streaming SSE Endpoint
// ==========================================
app.post('/api/gemini/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const { message, history, model = COMPLEX_MODEL, systemInstruction } = req.body;
    const sanitized = sanitizeHistory(history);
    const contents: any[] = [];
    for (const h of sanitized) {
      contents.push({ role: h.role, parts: h.parts });
    }
    contents.push({ role: 'user', parts: [{ text: message }] });

    const stream = await ai.models.generateContentStream({
      model,
      contents,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        systemInstruction: systemInstruction || 'You are an expert medical AI assistant.',
      },
    });

    for await (const chunk of stream) {
      const text = chunk.text || '';
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('Server streaming error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message || 'Streaming failed.' })}\n\n`);
    res.end();
  }
});

// ==========================================
// 7. Gemini Live API WebSocket Bridge
// ==========================================
const wss = new WebSocketServer({ server, path: '/live' });

wss.on('connection', async (clientWs: WebSocket) => {
  console.log('Gemini Live client connected to /live');

  try {
    const session = await ai.live.connect({
      model: LIVE_MODEL,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
        },
        systemInstruction: `You are an expert real-time medical voice consultant specializing in diagnostic ultrasound, X-ray radiography, and clinical imaging. Provide succinct, accurate, spoken clinical guidance.`,
      },
      callbacks: {
        onmessage: (message: LiveServerMessage) => {
          if (clientWs.readyState !== WebSocket.OPEN) return;

          for (const part of message.serverContent?.modelTurn?.parts ?? []) {
            if (part.inlineData?.data) {
              clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
            }
            if (part.text) {
              clientWs.send(JSON.stringify({ text: part.text }));
            }
          }
          if (message.serverContent?.interrupted) {
            clientWs.send(JSON.stringify({ interrupted: true }));
          }
        },
        onclose: () => {
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.close();
          }
        },
        onerror: (err: any) => {
          console.error('Gemini Live session callback error:', err);
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ error: err.message || 'Live session error' }));
          }
        },
      },
    });

    clientWs.on('message', (data) => {
      try {
        const payload = JSON.parse(data.toString());
        if (payload.audio) {
          session.sendRealtimeInput({
            audio: { data: payload.audio, mimeType: 'audio/pcm;rate=16000' },
          });
        }
        if (payload.video) {
          session.sendRealtimeInput({
            video: { data: payload.video, mimeType: payload.mimeType || 'image/jpeg' },
          });
        }
        if (payload.text) {
          session.sendRealtimeInput({
            text: payload.text,
          });
        }
      } catch (err: any) {
        console.error('Error forwarding client data to Gemini Live:', err);
      }
    });

    clientWs.on('close', () => {
      try {
        session.close();
      } catch (e) {
        // ignore
      }
    });

    clientWs.on('error', (err) => {
      console.error('Client WS connection error:', err);
      try {
        session.close();
      } catch (e) {
        // ignore
      }
    });
  } catch (error: any) {
    console.error('Failed to establish Gemini Live connection:', error);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(
        JSON.stringify({
          error: error.message || 'Failed to initialize Gemini Live API session',
        })
      );
      clientWs.close();
    }
  }
});

// ==========================================
// 8. Vite Dev Middleware / Static Production
// ==========================================
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.use((req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`UltraVision AI Server running on http://0.0.0.0:${PORT} [${isProduction ? 'production' : 'development'}]`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
