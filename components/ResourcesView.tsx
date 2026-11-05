import React, { useState, useRef } from 'react';
import { ResourceItem } from '../types';
import { analyzeDocument } from '../services/gemini';
import { ULTRASOUND_KNOWLEDGE_BASE } from '../services/ultrasoundKnowledge';
import { IconFile, IconUpload, IconTrash, IconBrain, IconPlus, IconCheck, IconAlert, IconBook } from './Icons';

export const ResourcesView = () => {
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());
  const [showKnowledge, setShowKnowledge] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      
      setIsUploading(true);

      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        
        const newResource: ResourceItem = {
          id: Date.now().toString(),
          title: file.name,
          type: 'Document',
          date: new Date().toLocaleDateString(),
          description: `Uploaded ${file.type} document`,
          fileData: base64String,
          mimeType: file.type
        };

        setResources(prev => [newResource, ...prev]);
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      };

      reader.readAsDataURL(file);
    }
  };

  const handleDelete = (id: string) => {
    setResources(prev => prev.filter(r => r.id !== id));
  };

  const handleAnalyze = async (resource: ResourceItem) => {
    if (!resource.fileData || !resource.mimeType) return;
    
    setAnalyzingIds(prev => new Set(prev).add(resource.id));
    
    try {
      const summary = await analyzeDocument(resource.fileData, resource.mimeType);
      
      setResources(prev => prev.map(r => 
        r.id === resource.id 
          ? { ...r, summary: summary } 
          : r
      ));
    } catch (error) {
      console.error("Error analyzing document:", error);
      // Optional: Add error state handling here
    } finally {
      setAnalyzingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(resource.id);
        return newSet;
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto w-full space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Medical Resources</h1>
            <p className="text-slate-500">Upload and analyze medical documents, guidelines, and research papers.</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => setShowKnowledge(!showKnowledge)}
              className={`px-6 py-3 rounded-xl font-medium shadow-md transition-colors flex items-center gap-2 ${
                showKnowledge ? 'bg-medical-100 text-medical-700' : 'bg-white text-slate-700 border border-slate-200'
              }`}
            >
              <IconBook className="w-5 h-5" />
              {showKnowledge ? 'Hide Knowledge Base' : 'View Knowledge Base'}
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="bg-medical-600 hover:bg-medical-700 text-white px-6 py-3 rounded-xl font-medium shadow-md transition-colors flex items-center gap-2"
            >
              <IconPlus className="w-5 h-5" />
              Upload Document
            </button>
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".pdf,.txt,.md,image/*" 
            onChange={handleFileUpload} 
          />
        </div>

        {/* Integrated Knowledge Base Section */}
        {showKnowledge && (
          <div className="bg-medical-900 text-white rounded-2xl p-8 shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-white/10 p-3 rounded-xl">
                <IconBook className="w-8 h-8 text-medical-300" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Abdomen Ultrasound Guide</h2>
                <p className="text-medical-200">Integrated diagnostic framework by Mansour Nabil Mahdi</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {ULTRASOUND_KNOWLEDGE_BASE.split('\n\n').filter(s => s.trim()).map((section, idx) => {
                const lines = section.split('\n');
                const title = lines[0].replace(/^\d+\.\s+/, '');
                const content = lines.slice(1).join('\n');
                
                return (
                  <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/10 transition-colors">
                    <h3 className="text-medical-300 font-bold uppercase tracking-wider text-xs mb-3">{title}</h3>
                    <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
                      {content}
                    </pre>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-6 pt-6 border-t border-white/10 flex items-center gap-2 text-medical-300 text-sm italic">
              <IconCheck className="w-4 h-4" />
              This knowledge base is automatically used by the AI for scan analysis and clinical chat.
            </div>
          </div>
        )}

        {/* Upload Area (Empty State) */}
        {resources.length === 0 && (
          <div 
            className="border-2 border-dashed border-slate-300 rounded-2xl p-12 text-center bg-white hover:border-medical-400 transition-colors cursor-pointer group"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="bg-medical-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
              <IconUpload className="w-8 h-8 text-medical-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900">Upload your first document</h3>
            <p className="text-slate-500 mt-2 max-w-md mx-auto">
              Support for PDF, TXT, Markdown, and Medical Images. Uploading allows you to summarize and extract insights using AI.
            </p>
          </div>
        )}

        {/* Resource List */}
        <div className="grid grid-cols-1 gap-6">
          {resources.map((resource) => (
            <div key={resource.id} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="bg-slate-100 p-3 rounded-lg">
                    <IconFile className="w-8 h-8 text-slate-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{resource.title}</h3>
                    <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                      <span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-semibold uppercase">{resource.type}</span>
                      <span>•</span>
                      <span>{resource.date}</span>
                    </div>
                    {resource.summary ? (
                       <div className="mt-4 bg-medical-50 border border-medical-100 rounded-lg p-4 prose prose-sm max-w-none text-slate-700">
                           <div className="flex items-center gap-2 text-medical-700 font-semibold mb-2">
                               <IconBrain className="w-4 h-4" /> AI Summary
                           </div>
                           <p className="whitespace-pre-wrap">{resource.summary}</p>
                       </div>
                    ) : (
                       <p className="text-slate-500 mt-2 text-sm">{resource.description}</p>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-col gap-2">
                    <button 
                        onClick={() => handleDelete(resource.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                    >
                        <IconTrash className="w-5 h-5" />
                    </button>
                </div>
              </div>

              {/* Action Bar */}
              {!resource.summary && (
                  <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                    <button 
                        onClick={() => handleAnalyze(resource)}
                        disabled={analyzingIds.has(resource.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                            analyzingIds.has(resource.id) 
                            ? 'bg-slate-100 text-slate-400 cursor-wait'
                            : 'bg-medical-50 text-medical-700 hover:bg-medical-100'
                        }`}
                    >
                        {analyzingIds.has(resource.id) ? (
                            <>
                                <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                                Analyzing...
                            </>
                        ) : (
                            <>
                                <IconBrain className="w-4 h-4" />
                                Generate Summary
                            </>
                        )}
                    </button>
                  </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};