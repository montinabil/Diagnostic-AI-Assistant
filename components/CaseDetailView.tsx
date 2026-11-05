
import React, { useState } from 'react';
import { CaseRecord, XRayROI } from '../types';
import { 
  IconCheck, 
  IconActivity, 
  IconImage, 
  IconVideo, 
  IconDownload, 
  IconAlert, 
  IconTarget,
  IconSquare,
  IconCircleShape,
  IconArrowShape
} from './Icons';
import { exportCaseReportToPDF } from '../services/pdfExport';

interface CaseDetailViewProps {
  caseRecord: CaseRecord;
  onBack: () => void;
}

export const CaseDetailView: React.FC<CaseDetailViewProps> = ({ caseRecord, onBack }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const targets: XRayROI[] = (caseRecord.rois && caseRecord.rois.length > 0)
    ? caseRecord.rois
    : (caseRecord.roi && caseRecord.roi.label ? [caseRecord.roi] : []);

  const handleExportPDF = async () => {
    try {
      setIsExporting(true);
      setErrorMessage(null);
      await exportCaseReportToPDF(caseRecord);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3500);
    } catch (err) {
      console.error('Failed to export PDF:', err);
      setErrorMessage('Failed to generate PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 p-6 overflow-y-auto">
      <div className="max-w-7xl mx-auto w-full space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <button 
              onClick={onBack}
              className="text-medical-600 hover:text-medical-800 font-medium text-sm flex items-center gap-1 mb-2 transition-colors"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-3xl font-bold text-slate-800">Case Review</h1>
            <p className="text-slate-500">Case ID: {caseRecord.id} • {caseRecord.date}</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className={`px-4 py-2.5 rounded-lg font-medium shadow-sm transition-all flex items-center gap-2 text-sm ${
                exportSuccess
                  ? 'bg-green-600 text-white'
                  : 'bg-medical-700 hover:bg-medical-800 text-white'
              } ${isExporting ? 'opacity-80 cursor-wait' : ''}`}
              title="Export current case analysis report as a PDF file"
            >
              {isExporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Generating PDF...</span>
                </>
              ) : exportSuccess ? (
                <>
                  <IconCheck className="w-4 h-4 text-white" />
                  <span>Report Downloaded!</span>
                </>
              ) : (
                <>
                  <IconDownload className="w-4 h-4" />
                  <span>Export Report (PDF)</span>
                </>
              )}
            </button>
            
            <div className="bg-white px-4 py-2.5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2">
              <IconCheck className="w-5 h-5 text-green-500" />
              <span className="font-semibold text-slate-700 text-sm">Analysis Completed</span>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
            <IconAlert className="w-5 h-5 text-red-500 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
          
          {/* Left Column: Media & Info */}
          <div className="flex flex-col gap-6">
            
            {/* Media Gallery */}
            <div className={`grid gap-4 ${caseRecord.media.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
               {caseRecord.media.map((item, idx) => (
                   <div key={idx} className="bg-black rounded-xl overflow-hidden flex items-center justify-center relative shadow-md aspect-square border border-slate-200">
                      {item.type === 'video' ? (
                        <video src={item.preview} controls className="max-h-full max-w-full" />
                      ) : (
                        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                          <img src={item.preview} alt={`Case Media ${idx}`} className="max-h-full max-w-full object-contain" />
                          
                          {/* Multi-Target Shapes Overlay on primary image (NO TEXT OVERLAY) */}
                          {idx === 0 && targets.length > 0 && (
                            <>
                              <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
                                <defs>
                                  {targets.filter(t => t.shape === 'arrow').map(t => (
                                    <marker
                                      key={`case-marker-${t.id}`}
                                      id={`case-marker-${t.id}`}
                                      markerWidth="6"
                                      markerHeight="6"
                                      refX="5"
                                      refY="3"
                                      orient="auto"
                                    >
                                      <polygon points="0 0, 6 3, 0 6" fill={t.color || '#ef4444'} />
                                    </marker>
                                  ))}
                                </defs>
                                {targets.filter(t => t.shape === 'arrow').map(t => (
                                  <line
                                    key={t.id}
                                    x1={t.x}
                                    y1={t.y}
                                    x2={t.endX ?? t.x + 12}
                                    y2={t.endY ?? t.y + 12}
                                    stroke={t.color || '#ef4444'}
                                    strokeWidth="1.2"
                                    markerEnd={`url(#case-marker-${t.id})`}
                                    filter="drop-shadow(0px 0px 2px rgba(0,0,0,0.8))"
                                  />
                                ))}
                              </svg>

                              {targets.map((roi, tIdx) => {
                                const color = roi.color || '#06b6d4';
                                if (roi.shape === 'arrow') {
                                  return (
                                    <div
                                      key={roi.id}
                                      className="absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-lg z-20 pointer-events-none ring-1 ring-black/40"
                                      style={{
                                        left: `${roi.x}%`,
                                        top: `${roi.y}%`,
                                        backgroundColor: color,
                                      }}
                                    >
                                      {tIdx + 1}
                                    </div>
                                  );
                                }

                                return (
                                  <div
                                    key={roi.id}
                                    className={`absolute border-2 pointer-events-none z-10 ${
                                      roi.shape === 'circle' ? 'rounded-full' : 'rounded'
                                    }`}
                                    style={{
                                      left: `${roi.x}%`,
                                      top: `${roi.y}%`,
                                      width: `${roi.width || 20}%`,
                                      height: `${roi.height || 20}%`,
                                      borderColor: color,
                                      backgroundColor: `${color}20`,
                                      boxShadow: `0 0 10px ${color}50`,
                                      transform: roi.rotation ? `rotate(${roi.rotation}deg)` : undefined,
                                    }}
                                  >
                                    <div
                                      className="absolute -top-2.5 -left-2.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-md z-20 pointer-events-none ring-1 ring-black/50"
                                      style={{ backgroundColor: color }}
                                    >
                                      {tIdx + 1}
                                    </div>
                                  </div>
                                );
                              })}
                            </>
                          )}
                        </div>
                      )}
                      <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1 z-30">
                        {item.type === 'video' ? <IconVideo className="w-3 h-3" /> : <IconImage className="w-3 h-3" />}
                        {item.type}
                      </div>
                   </div>
               ))}
            </div>

            {/* Targeted Regions of Interest (ROIs) Card if present */}
            {targets.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm text-white space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider">
                    <IconTarget className="w-4 h-4 text-cyan-400" />
                    <span>Targeted Regions of Interest ({targets.length} Focal Sites)</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Prioritized in Analysis
                  </span>
                </div>

                <div className="space-y-2">
                  {targets.map((t, idx) => (
                    <div
                      key={t.id || idx}
                      className="p-3 bg-slate-800/80 border border-slate-700 rounded-lg flex items-start gap-2.5 text-xs"
                    >
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0 mt-0.5 shadow-xs"
                        style={{ backgroundColor: t.color || '#06b6d4' }}
                      >
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-white leading-snug">
                          "{t.label}"
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
                          <span className="uppercase text-[10px] font-bold tracking-wider text-cyan-300">
                            {t.shape || 'rectangle'}
                          </span>
                          {t.anatomicalLocation && (
                            <span>• {t.anatomicalLocation}</span>
                          )}
                          <span className="text-slate-500 font-mono text-[10px]">
                            (X: {Math.round(t.x)}%, Y: {Math.round(t.y)}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Patient Context / Description</h3>
              <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">
                {caseRecord.description || "No description provided."}
              </p>
            </div>
          </div>

          {/* Right Column: Analysis Results */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 overflow-y-auto h-auto relative">
              {targets.length > 0 && (
                <div className="mb-5 p-3.5 bg-gradient-to-r from-cyan-50 to-medical-50 border border-cyan-200 rounded-xl flex items-center justify-between text-xs text-cyan-950">
                  <div className="flex items-center gap-2">
                    <IconTarget className="w-4 h-4 text-cyan-600 flex-shrink-0" />
                    <span>
                      Radiology AI evaluated {targets.length} clinician-designated target site{targets.length > 1 ? 's' : ''}.
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-cyan-700 bg-white/80 px-2 py-0.5 rounded border border-cyan-200">
                    TARGETED STUDY
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between border-b pb-4 mb-6">
                <h3 className="text-xl font-bold text-medical-800 flex items-center gap-2">
                  <IconActivity className="w-6 h-6" />
                  Diagnostic Report
                </h3>
                <button
                  onClick={handleExportPDF}
                  disabled={isExporting}
                  className="text-medical-700 hover:text-medical-900 bg-medical-50 hover:bg-medical-100 border border-medical-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  title="Export this report as a PDF"
                >
                  <IconDownload className="w-3.5 h-3.5" />
                  <span>{isExporting ? 'Exporting...' : 'Export PDF'}</span>
                </button>
              </div>
              
              <div className="prose prose-slate max-w-none">
                {caseRecord.result.text.split('\n').map((line, i) => {
                  if (line.startsWith('**') && line.endsWith('**')) { 
                        return <p key={i} className="font-bold text-slate-800 mt-4 mb-2">{line.replace(/\*\*/g, '')}</p>
                  }
                  if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-bold text-medical-800 mt-6 mb-3 border-b pb-2">{line.replace('## ', '')}</h2>;
                  if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-semibold text-slate-800 mt-4 mb-2">{line.replace('### ', '')}</h3>;
                  if (line.startsWith('* ') || line.startsWith('- ')) return <li key={i} className="ml-4 list-disc text-slate-700">{line.substring(2)}</li>;
                  if (line.match(/^\d+\./)) return <li key={i} className="ml-4 list-decimal text-slate-700">{line}</li>;
                  return <p key={i} className="text-slate-700 leading-relaxed mb-2">{line.replace(/\*\*/g, '')}</p>;
                })}
              </div>

              {caseRecord.result.groundingChunks && caseRecord.result.groundingChunks.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-slate-200">
                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Supporting Evidence & References</h4>
                    <ul className="space-y-2">
                      {caseRecord.result.groundingChunks.map((chunk, idx) => (
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

        </div>
      </div>
    </div>
  );
};
