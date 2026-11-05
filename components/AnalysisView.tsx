
import React, { useState, useRef, useEffect } from 'react';
import { analyzeMedicalMedia } from '../services/gemini';
import { IconUpload, IconImage, IconVideo, IconBrain, IconCheck, IconAlert, IconActivity, IconCamera, IconTrash, IconPlus } from './Icons';
import { AnalysisResult, CaseRecord } from '../types';

interface AnalysisViewProps {
  onAnalysisComplete: (caseRecord: CaseRecord) => void;
}

interface MediaItem {
  id: string;
  file: File;
  preview: string;
  type: 'image' | 'video';
}

export const AnalysisView: React.FC<AnalysisViewProps> = ({ onAnalysisComplete }) => {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [description, setDescription] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useDeepThinking, setUseDeepThinking] = useState(true);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Manage camera stream lifecycle
  useEffect(() => {
    let stream: MediaStream | null = null;

    if (isCameraOpen) {
      const startCamera = async () => {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (err) {
          console.error("Camera Error:", err);
          setError("Could not access camera. Please verify permissions.");
          setIsCameraOpen(false);
        }
      };
      startCamera();
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isCameraOpen]);

  const addFiles = (files: FileList | File[]) => {
    const newItems: MediaItem[] = [];
    const filesArray = Array.from(files);

    filesArray.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setMediaItems(prev => [
          ...prev, 
          {
            id: Math.random().toString(36).substr(2, 9),
            file: file,
            preview: reader.result as string,
            type: file.type.startsWith('video') ? 'video' : 'image'
          }
        ]);
        setResult(null); // Reset result on new upload
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      setError(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
      setError(null);
    }
  };

  const removeMediaItem = (id: string) => {
    setMediaItems(prev => prev.filter(item => item.id !== id));
    if (mediaItems.length <= 1) {
      setResult(null);
    }
  };

  const captureImage = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg');
        
        fetch(dataUrl)
          .then(res => res.blob())
          .then(blob => {
            const file = new File([blob], `camera_capture_${Date.now()}.jpg`, { type: "image/jpeg" });
            
            setMediaItems(prev => [
              ...prev,
              {
                id: Math.random().toString(36).substr(2, 9),
                file: file,
                preview: dataUrl,
                type: 'image'
              }
            ]);
            setResult(null);
            setError(null);
          });
          
        setIsCameraOpen(false);
      }
    }
  };

  const handleAnalyze = async () => {
    if (mediaItems.length === 0) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const mediaData = mediaItems.map(item => ({
        data: item.preview.split(',')[1],
        mimeType: item.file.type
      }));

      const context = description.trim() 
        ? `Context provided by user: "${description}"\n\n` 
        : '';
      
      const prompt = `${context}Analyze the provided ${mediaItems.length} media item(s) for medical diagnostic purposes. If multiple images are provided, compare them. Identify any anomalies, anatomical structures, and potential concerns.`;
      
      const analysis = await analyzeMedicalMedia(
        mediaData,
        prompt, 
        useDeepThinking
      );

      const analysisResult: AnalysisResult = {
        text: analysis.text,
        groundingChunks: analysis.groundingChunks,
        timestamp: Date.now()
      };

      setResult(analysisResult);

      // Determine case type
      let caseType: 'image' | 'video' | 'mixed' = 'image';
      if (mediaItems.length > 1) caseType = 'mixed';
      else if (mediaItems[0].type === 'video') caseType = 'video';

      // Save to history
      const newCase: CaseRecord = {
        id: `CASE-${Date.now()}`,
        type: caseType,
        preview: mediaItems[0].preview, // Use first image as thumbnail
        media: mediaItems.map(m => ({ type: m.type, preview: m.preview })),
        description: description,
        date: new Date().toLocaleDateString(),
        timestamp: Date.now(),
        result: analysisResult
      };
      
      onAnalysisComplete(newCase);

    } catch (err: any) {
      setError("Failed to analyze media. " + (err.message || "Unknown error"));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetAnalysis = () => {
    setMediaItems([]);
    setResult(null);
    setDescription('');
    setError(null);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 p-6 overflow-y-auto">
      <div className="max-w-7xl mx-auto w-full space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Diagnostic Analysis</h1>
            <p className="text-slate-500">Upload multiple images or videos for AI-powered assessment</p>
          </div>
          <div className="flex items-center gap-3 bg-white p-2 rounded-lg shadow-sm border border-slate-200">
             <span className="text-sm font-medium text-slate-700 ml-2">Deep Thinking Mode</span>
            <button 
              onClick={() => setUseDeepThinking(!useDeepThinking)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${useDeepThinking ? 'bg-medical-600' : 'bg-slate-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${useDeepThinking ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full min-h-[500px]">
          
          {/* Left Column: Upload & Preview */}
          <div className="flex flex-col gap-4">
            
            {/* Camera Overlay */}
            {isCameraOpen ? (
               <div className="relative border-2 border-black rounded-xl h-96 flex flex-col items-center justify-center bg-black overflow-hidden">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  <div className="absolute bottom-6 flex gap-4 z-10">
                    <button 
                      onClick={() => setIsCameraOpen(false)}
                      className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-6 py-2 rounded-full font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={captureImage}
                      className="bg-white text-medical-600 px-8 py-2 rounded-full font-bold shadow-lg hover:bg-slate-100 transition-colors flex items-center gap-2"
                    >
                      <div className="w-4 h-4 rounded-full border-4 border-medical-600"></div>
                      Capture
                    </button>
                  </div>
               </div>
            ) : mediaItems.length === 0 ? (
               /* Initial Drop Zone */
              <div 
                className="relative border-2 border-dashed border-slate-300 bg-white hover:border-medical-400 rounded-xl h-96 flex flex-col items-center justify-center transition-colors overflow-hidden"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <div className="text-center p-6 w-full">
                  <div className="bg-medical-100 p-4 rounded-full inline-flex mb-4">
                    <IconUpload className="w-8 h-8 text-medical-600" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900">Drop medical scans here</h3>
                  <p className="text-slate-500 mt-2 mb-6">Support for multiple images comparison</p>
                  
                  <div className="flex flex-col sm:flex-row gap-3 justify-center w-full max-w-sm mx-auto">
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 bg-medical-600 hover:bg-medical-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      Select Files
                    </button>
                    <button 
                      onClick={() => setIsCameraOpen(true)}
                      className="flex-1 bg-white border border-medical-200 text-medical-700 hover:bg-medical-50 hover:border-medical-300 px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                      <IconCamera className="w-5 h-5" />
                      Camera
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Grid View for Multiple Items */
              <div className="bg-white rounded-xl border border-slate-200 p-4 min-h-[384px]">
                 <div className="flex justify-between items-center mb-4">
                     <h3 className="font-semibold text-slate-700">Selected Media ({mediaItems.length})</h3>
                     <button 
                        onClick={resetAnalysis}
                        className="text-xs text-red-500 hover:text-red-700 font-medium"
                     >
                        Clear All
                     </button>
                 </div>
                 
                 <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {mediaItems.map((item) => (
                      <div key={item.id} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-900">
                        {item.type === 'video' ? (
                          <video src={item.preview} className="w-full h-full object-cover opacity-80" />
                        ) : (
                          <img src={item.preview} alt="Upload" className="w-full h-full object-cover" />
                        )}
                        <button 
                          onClick={() => removeMediaItem(item.id)}
                          className="absolute top-1 right-1 bg-black/50 hover:bg-red-600 text-white p-1 rounded-full backdrop-blur-sm transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <IconTrash className="w-4 h-4" />
                        </button>
                        {item.type === 'video' && (
                           <div className="absolute bottom-1 right-1 text-white bg-black/50 px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1">
                               <IconVideo className="w-3 h-3" /> Video
                           </div>
                        )}
                      </div>
                    ))}
                    
                    {/* Add More Button */}
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-lg border-2 border-dashed border-slate-300 hover:border-medical-400 bg-slate-50 hover:bg-slate-100 flex flex-col items-center justify-center text-slate-500 hover:text-medical-600 transition-all"
                    >
                      <IconPlus className="w-8 h-8 mb-1" />
                      <span className="text-xs font-medium">Add More</span>
                    </button>
                    
                    {/* Camera Button Small */}
                    <button 
                      onClick={() => setIsCameraOpen(true)}
                      className="aspect-square rounded-lg border-2 border-dashed border-slate-300 hover:border-medical-400 bg-slate-50 hover:bg-slate-100 flex flex-col items-center justify-center text-slate-500 hover:text-medical-600 transition-all"
                    >
                      <IconCamera className="w-8 h-8 mb-1" />
                      <span className="text-xs font-medium">Camera</span>
                    </button>
                 </div>
              </div>
            )}
            
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*,video/*" 
              multiple
              onChange={handleFileChange} 
            />
            
            {/* User Description Input */}
            {mediaItems.length > 0 && !isCameraOpen && (
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Case Description & Clinical Questions</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe patient symptoms, specific areas to focus on, or questions for the AI (e.g., 'Compare the two scans for changes in lesion size')."
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-medical-500 focus:border-medical-500 outline-none resize-none h-24 transition-all"
                />
              </div>
            )}

            <button
              onClick={handleAnalyze}
              disabled={mediaItems.length === 0 || isAnalyzing || isCameraOpen}
              className={`w-full py-4 rounded-xl text-lg font-semibold flex items-center justify-center gap-2 transition-all ${
                (mediaItems.length === 0 || isCameraOpen) ? 'bg-slate-200 text-slate-400 cursor-not-allowed' :
                isAnalyzing ? 'bg-medical-800 text-white cursor-wait' :
                'bg-medical-600 hover:bg-medical-700 text-white shadow-lg hover:shadow-xl'
              }`}
            >
              {isAnalyzing ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing {mediaItems.length} Item(s)...
                </>
              ) : (
                <>
                  <IconBrain className="w-6 h-6" />
                  Analyze Media
                </>
              )}
            </button>
            {error && (
              <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200 flex items-start gap-2 animate-pulse">
                <IconAlert className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}
          </div>

          {/* Right Column: Results */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 overflow-y-auto h-[600px] lg:h-auto relative">
            {!result ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <IconActivity className="w-16 h-16 mb-4 opacity-50" />
                <p className="text-lg">Analysis results will appear here</p>
                <p className="text-sm">AI will detect anomalies and provide references</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-medical-700 bg-medical-50 px-4 py-2 rounded-lg border border-medical-100">
                   <IconCheck className="w-5 h-5" />
                   <span className="font-semibold">Analysis Complete</span>
                </div>
                
                <div className="prose prose-slate max-w-none">
                  {/* Simple Markdown Rendering */}
                  {result.text.split('\n').map((line, i) => {
                    // Check for headers
                    if (line.startsWith('**') && line.endsWith('**')) { // Bold headers often used by Gemini
                         return <p key={i} className="font-bold text-slate-800 mt-4 mb-2">{line.replace(/\*\*/g, '')}</p>
                    }
                    if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-bold text-medical-800 mt-6 mb-3 border-b pb-2">{line.replace('## ', '')}</h2>;
                    if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-semibold text-slate-800 mt-4 mb-2">{line.replace('### ', '')}</h3>;
                    if (line.startsWith('* ') || line.startsWith('- ')) return <li key={i} className="ml-4 list-disc text-slate-700">{line.substring(2)}</li>;
                    if (line.match(/^\d+\./)) return <li key={i} className="ml-4 list-decimal text-slate-700">{line}</li>;
                    return <p key={i} className="text-slate-700 leading-relaxed mb-2">{line.replace(/\*\*/g, '')}</p>; 
                  })}
                </div>

                {result.groundingChunks && result.groundingChunks.length > 0 && (
                   <div className="mt-8 pt-6 border-t border-slate-200">
                     <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Supporting Evidence & References</h4>
                     <ul className="space-y-2">
                       {result.groundingChunks.map((chunk, idx) => (
                         chunk.web ? (
                           <li key={idx}>
                             <a 
                               href={chunk.web.uri} 
                               target="_blank" 
                               rel="noopener noreferrer"
                               className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors group"
                             >
                               <span className="bg-white p-1 rounded border border-slate-200 text-xs font-bold text-slate-500">WEB</span>
                               <span className="text-medical-700 font-medium group-hover:underline truncate">{chunk.web.title}</span>
                             </a>
                           </li>
                         ) : null
                       ))}
                     </ul>
                   </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
