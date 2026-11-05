import React, { useState, useRef, useEffect } from 'react';
import { analyzeXRayImage } from '../services/gemini';
import { exportCaseReportToPDF } from '../services/pdfExport';
import { CaseRecord, AnalysisResult, XRayROI, AnnotationShape } from '../types';
import { 
  IconXRay, 
  IconUpload, 
  IconBrain, 
  IconCheck, 
  IconAlert, 
  IconDownload, 
  IconCopy, 
  IconPrinter, 
  IconTrash, 
  IconSparkles,
  IconTarget,
  IconCrosshair,
  IconFocus,
  IconSquare,
  IconCircleShape,
  IconArrowShape,
  IconPlus,
  IconMove,
  IconRotateCw,
  IconMaximize2,
} from './Icons';

interface XRayAnalysisSectionProps {
  onCaseSaved?: (newCase: CaseRecord) => void;
  onViewCase?: (caseRecord: CaseRecord) => void;
}

export const COLOR_OPTIONS = [
  { id: 'cyan', name: 'Cyan', hex: '#06b6d4', bg: 'bg-cyan-500' },
  { id: 'amber', name: 'Amber', hex: '#f59e0b', bg: 'bg-amber-500' },
  { id: 'red', name: 'Red', hex: '#ef4444', bg: 'bg-red-500' },
  { id: 'emerald', name: 'Emerald', hex: '#10b981', bg: 'bg-emerald-500' },
  { id: 'purple', name: 'Purple', hex: '#a855f7', bg: 'bg-purple-500' },
];

export const SHAPE_OPTIONS: { id: AnnotationShape; name: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'rectangle', name: 'Rectangle', icon: IconSquare },
  { id: 'circle', name: 'Circle', icon: IconCircleShape },
  { id: 'arrow', name: 'Arrow', icon: IconArrowShape },
];

// Clinical suggestion labels by anatomical area
const ROI_SUGGESTIONS: Record<string, string[]> = {
  Chest: [
    'Right Lower Lobe Consolidation',
    'Left Costophrenic Angle Blunting',
    'Apical Pneumothorax / Lucency',
    'Cardiomediastinal Border',
    'Right Hilar Prominence / Mass',
    'Rib Cortical Fracture',
    'Retrocardiac Opacity',
    'Subdiaphragmatic Free Air',
  ],
  Musculoskeletal: [
    'Distal Radius Cortical Discontinuity',
    'Articular Surface Disruption',
    'Scaphoid Waist Radiolucency',
    'Joint Space Narrowing',
    'Soft Tissue Swelling / Effusion',
    'Avulsion Fragment',
    'Ulnar Styloid Fracture',
  ],
  Abdomen: [
    'Subdiaphragmatic Crescent Free Air',
    'Dilated Small Bowel Loop (>3cm)',
    'Air-Fluid Level Stack',
    'Radiopaque Calculus (Renal/Gallstone)',
    'Psoas Margin Obscuration',
    'Sigmoid Volvulus Coffee-Bean Sign',
  ],
  Spine: [
    'L4-L5 Intervertebral Disc Space',
    'Vertebral Compression / Height Loss',
    'Pedicle Destruction (Winking Owl)',
    'Anterior Longitudinal Alignment',
    'Spondylolisthesis / Step-Off',
  ],
  Pelvis: [
    'Femoral Neck Radiolucency',
    'Pubic Rami Cortical Interruption',
    'Sacroiliac Joint Space',
    'Shenton Line Discontinuity',
    'Acetabular Margin',
  ],
  'Skull & Facial': [
    'Orbital Floor Blowout',
    'Mandibular Angle Fracture',
    'Zygomaticomaxillary Complex',
    'Maxillary Sinus Air-Fluid Level',
  ],
};

function getAnatomicalZone(examType: string, x: number, y: number): string {
  const isRightSide = x < 50; // Patient right is on viewer left
  const lateralSide = isRightSide ? 'Right' : 'Left';

  if (examType === 'Chest') {
    if (x >= 38 && x <= 62 && y >= 25 && y <= 75) {
      return 'Mediastinum & Cardiac Silhouette';
    }
    if (y < 35) return `${lateralSide} Upper Zone / Apical`;
    if (y < 65) return `${lateralSide} Mid Lung Zone / Hilum`;
    return `${lateralSide} Lower Zone / Costophrenic Base`;
  }

  if (examType === 'Abdomen') {
    if (y < 50) {
      return isRightSide ? 'Right Upper Quadrant (RUQ / Hepatic)' : 'Left Upper Quadrant (LUQ / Splenic)';
    } else {
      return isRightSide ? 'Right Lower Quadrant (RLQ / Cecal)' : 'Left Lower Quadrant (LLQ / Pelvic)';
    }
  }

  if (examType === 'Musculoskeletal') {
    if (y < 35) return 'Proximal Shaft / Diaphysis';
    if (y < 65) return 'Midshaft / Metaphyseal Junction';
    return 'Distal Epiphysis / Articular Joint Surface';
  }

  if (examType === 'Spine') {
    if (y < 30) return 'Upper Vertebral Segment';
    if (y < 60) return 'Mid-Vertebral Bodies & Discs';
    return 'Lumbosacral / Lower Transition';
  }

  return `${lateralSide} Regional Zone (${Math.round(x)}%, ${Math.round(y)}%)`;
}

// Arrow geometric calculation helpers
function getArrowMetrics(x: number, y: number, endX: number, endY: number) {
  const dx = endX - x;
  const dy = endY - y;
  const length = Math.round(Math.hypot(dx, dy));
  let deg = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
  if (deg < 0) deg += 360;
  return { length, angle: deg };
}

function rotateArrow(roi: XRayROI, deltaDeg: number): Partial<XRayROI> {
  const startX = roi.x;
  const startY = roi.y;
  const endX = roi.endX ?? roi.x + 12;
  const endY = roi.endY ?? roi.y + 12;

  const centerX = (startX + endX) / 2;
  const centerY = (startY + endY) / 2;
  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.hypot(dx, dy);
  const currentAngle = Math.atan2(dy, dx);
  const newAngle = currentAngle + (deltaDeg * Math.PI) / 180;

  const half = length / 2;
  const newStartX = Math.max(2, Math.min(98, Math.round(centerX - Math.cos(newAngle) * half)));
  const newStartY = Math.max(2, Math.min(98, Math.round(centerY - Math.sin(newAngle) * half)));
  const newEndX = Math.max(2, Math.min(98, Math.round(centerX + Math.cos(newAngle) * half)));
  const newEndY = Math.max(2, Math.min(98, Math.round(centerY + Math.sin(newAngle) * half)));

  return { x: newStartX, y: newStartY, endX: newEndX, endY: newEndY };
}

function setArrowCompassDirection(roi: XRayROI, targetAngleDeg: number): Partial<XRayROI> {
  const startX = roi.x;
  const startY = roi.y;
  const endX = roi.endX ?? roi.x + 12;
  const endY = roi.endY ?? roi.y + 12;

  const centerX = (startX + endX) / 2;
  const centerY = (startY + endY) / 2;
  const length = Math.max(8, Math.hypot(endX - startX, endY - startY));
  const rad = (targetAngleDeg * Math.PI) / 180;
  const half = length / 2;

  return {
    x: Math.max(2, Math.min(98, Math.round(centerX - Math.cos(rad) * half))),
    y: Math.max(2, Math.min(98, Math.round(centerY - Math.sin(rad) * half))),
    endX: Math.max(2, Math.min(98, Math.round(centerX + Math.cos(rad) * half))),
    endY: Math.max(2, Math.min(98, Math.round(centerY + Math.sin(rad) * half))),
  };
}

function scaleArrow(roi: XRayROI, factor: number): Partial<XRayROI> {
  const startX = roi.x;
  const startY = roi.y;
  const endX = roi.endX ?? roi.x + 12;
  const endY = roi.endY ?? roi.y + 12;

  const centerX = (startX + endX) / 2;
  const centerY = (startY + endY) / 2;
  const dx = endX - startX;
  const dy = endY - startY;
  const newDx = dx * factor;
  const newDy = dy * factor;

  return {
    x: Math.max(2, Math.min(98, Math.round(centerX - newDx / 2))),
    y: Math.max(2, Math.min(98, Math.round(centerY - newDy / 2))),
    endX: Math.max(2, Math.min(98, Math.round(centerX + newDx / 2))),
    endY: Math.max(2, Math.min(98, Math.round(centerY + newDy / 2))),
  };
}

function flipArrow(roi: XRayROI): Partial<XRayROI> {
  return {
    x: roi.endX ?? roi.x + 12,
    y: roi.endY ?? roi.y + 12,
    endX: roi.x,
    endY: roi.y,
  };
}

function scaleShape(roi: XRayROI, factor: number): Partial<XRayROI> {
  if (roi.shape === 'arrow') {
    return scaleArrow(roi, factor);
  }
  const curW = roi.width || 20;
  const curH = roi.height || 20;
  const newW = Math.max(6, Math.min(90, Math.round(curW * factor)));
  const newH = Math.max(6, Math.min(90, Math.round(curH * factor)));
  const cx = roi.x + curW / 2;
  const cy = roi.y + curH / 2;
  return {
    width: newW,
    height: newH,
    x: Math.max(0, Math.min(100 - newW, Math.round(cx - newW / 2))),
    y: Math.max(0, Math.min(100 - newH, Math.round(cy - newH / 2))),
  };
}

function nudgeRoi(roi: XRayROI, dx: number, dy: number): Partial<XRayROI> {
  if (roi.shape === 'arrow') {
    return {
      x: Math.max(1, Math.min(99, roi.x + dx)),
      y: Math.max(1, Math.min(99, roi.y + dy)),
      endX: Math.max(1, Math.min(99, (roi.endX ?? roi.x + 12) + dx)),
      endY: Math.max(1, Math.min(99, (roi.endY ?? roi.y + 12) + dy)),
    };
  }
  const w = roi.width || 20;
  const h = roi.height || 20;
  return {
    x: Math.max(0, Math.min(100 - w, roi.x + dx)),
    y: Math.max(0, Math.min(100 - h, roi.y + dy)),
  };
}

// Built-in clinical demonstration X-rays for instant testing
const SAMPLE_XRAYS = [
  {
    id: 'sample-cxr',
    name: 'Chest X-Ray (CXR)',
    subtext: '54F • Productive cough, fever, right-sided pleuritic pain',
    examType: 'Chest',
    projection: 'PA (Posteroanterior)',
    clinicalHistory: '54-year-old female presenting with 4-day history of fever (39°C), productive cough with purulent sputum, and right lower chest pleuritic pain. Auscultation reveals bronchial breath sounds and crackles over right base.',
    preview: "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%2305080f'/%3E%3Cpath d='M200 40 L200 130' stroke='%23334155' stroke-width='10' stroke-linecap='round'/%3E%3Cpath d='M200 130 L160 180 M200 130 L240 180' stroke='%23334155' stroke-width='6' stroke-linecap='round'/%3E%3Cpath d='M100 80 C80 180 80 270 140 310 C180 300 185 240 180 200 C175 160 160 110 130 80 Z' fill='%23111827' stroke='%23475569' stroke-width='2'/%3E%3Cpath d='M300 80 C320 180 320 270 260 310 C220 300 215 240 220 200 C225 160 240 110 270 80 Z' fill='%23111827' stroke='%23475569' stroke-width='2'/%3E%3Cellipse cx='215' cy='250' rx='55' ry='45' fill='%230f172a' stroke='%2364748b' stroke-width='2'/%3E%3Cpath d='M235 240 C270 245 295 270 280 295 C250 305 230 290 235 240 Z' fill='%23e2e8f0' opacity='0.75' filter='blur(2px)'/%3E%3Cpath d='M245 250 L270 280 M250 265 L275 270' stroke='%230f172a' stroke-width='1.5'/%3E%3Cpath d='M100 130 Q200 145 300 130 M95 165 Q200 180 305 165 M90 200 Q200 215 310 200 M95 235 Q200 250 305 235 M105 270 Q200 285 295 270' fill='none' stroke='%23334155' stroke-width='4' opacity='0.5'/%3E%3Crect x='15' y='15' width='140' height='26' rx='4' fill='%230f172a' stroke='%2338bdf8' stroke-width='1'/%3E%3Ctext x='25' y='32' fill='%2338bdf8' font-family='monospace' font-size='11' font-weight='bold'%3ECXR PA ERECT%3C/text%3E%3Ctext x='360' y='35' fill='%2394a3b8' font-family='sans-serif' font-size='16' font-weight='bold'%3ER%3C/text%3E%3C/svg%3E"
  },
  {
    id: 'sample-fracture',
    name: 'Wrist / Bone X-Ray',
    subtext: '32M • Fall on outstretched hand, dorsal deform',
    examType: 'Musculoskeletal',
    projection: 'Lateral & AP Views',
    clinicalHistory: '32-year-old male sustained a fall onto an outstretched right hand while playing sports. Severe wrist pain, dorsal "dinner fork" deformity, marked local swelling, and limited range of motion. Neurovascular status intact.',
    preview: "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%2305080f'/%3E%3Cpath d='M160 370 L160 180 L145 160 L145 80 L180 80 L180 160 L195 180 L195 370 Z' fill='%23334155' stroke='%23cbd5e1' stroke-width='2'/%3E%3Cpath d='M215 370 L215 170 L235 170 L235 370 Z' fill='%231e293b' stroke='%2394a3b8' stroke-width='2'/%3E%3Cellipse cx='165' cy='65' rx='35' ry='20' fill='%23334155' stroke='%2394a3b8' stroke-width='1.5'/%3E%3Cpath d='M140 160 L200 170' stroke='%23ef4444' stroke-width='3' stroke-dasharray='4 2'/%3E%3Cpath d='M145 160 L155 140' stroke='%23ffffff' stroke-width='2'/%3E%3Crect x='15' y='15' width='160' height='26' rx='4' fill='%230f172a' stroke='%23f59e0b' stroke-width='1'/%3E%3Ctext x='25' y='32' fill='%23f59e0b' font-family='monospace' font-size='11' font-weight='bold'%3ERT WRIST 2-VIEW%3C/text%3E%3Ctext x='360' y='35' fill='%2394a3b8' font-family='sans-serif' font-size='16' font-weight='bold'%3ER%3C/text%3E%3C/svg%3E"
  },
  {
    id: 'sample-axr',
    name: 'Abdominal Plain Film (AXR)',
    subtext: '68M • Nausea, vomiting, obstipation, distention',
    examType: 'Abdomen',
    projection: 'AP Supine',
    clinicalHistory: '68-year-old male with history of prior appendectomy presenting with 48 hours of progressive abdominal distention, colicky pain, recurrent bilious emesis, and obstipation. Metallic high-pitched bowel sounds on auscultation.',
    preview: "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%2305080f'/%3E%3Cpath d='M120 70 Q200 60 280 70 L285 340 Q200 350 115 340 Z' fill='%230f172a' stroke='%23334155' stroke-width='2'/%3E%3Cpath d='M135 120 C180 110 220 110 260 120 C270 135 250 160 200 155 C150 150 130 135 135 120 Z' fill='%231e293b' stroke='%2394a3b8' stroke-width='2.5'/%3E%3Cpath d='M140 170 C190 160 230 160 270 170 C280 185 260 210 210 205 C160 200 135 185 140 170 Z' fill='%231e293b' stroke='%2394a3b8' stroke-width='2.5'/%3E%3Cpath d='M130 220 C180 210 220 210 265 220 C275 235 255 260 205 255 C155 250 125 235 130 220 Z' fill='%231e293b' stroke='%2394a3b8' stroke-width='2.5'/%3E%3Cpath d='M145 125 L145 150 M170 120 L170 153 M195 120 L195 155 M225 120 L225 153 M250 125 L250 148' stroke='%2364748b' stroke-width='1.5'/%3E%3Cpath d='M150 175 L150 200 M180 170 L180 203 M210 170 L210 205 M240 170 L240 203' stroke='%2364748b' stroke-width='1.5'/%3E%3Crect x='15' y='15' width='140' height='26' rx='4' fill='%230f172a' stroke='%2310b981' stroke-width='1'/%3E%3Ctext x='25' y='32' fill='%2310b981' font-family='monospace' font-size='11' font-weight='bold'%3EAXR AP SUPINE%3C/text%3E%3Ctext x='360' y='35' fill='%2394a3b8' font-family='sans-serif' font-size='16' font-weight='bold'%3ER%3C/text%3E%3C/svg%3E"
  }
];

type ActiveDrag = 
  | { type: 'draw'; startX: number; startY: number }
  | { type: 'move'; roiId: string; initialX: number; initialY: number; initialEndX?: number; initialEndY?: number; startRelX: number; startRelY: number }
  | { type: 'resize'; roiId: string; corner: 'tl' | 'tr' | 'br' | 'bl'; initialX: number; initialY: number; initialW: number; initialH: number; startRelX: number; startRelY: number }
  | { type: 'arrow-head'; roiId: string; startRelX: number; startRelY: number }
  | { type: 'arrow-tail'; roiId: string; startRelX: number; startRelY: number }
  | { type: 'rotate'; roiId: string; centerX: number; centerY: number; initialRot: number; startAngle: number };

export const XRayAnalysisSection: React.FC<XRayAnalysisSectionProps> = ({ 
  onCaseSaved, 
  onViewCase 
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('image/jpeg');
  const [imageFileName, setImageFileName] = useState<string>('');
  
  const [examType, setExamType] = useState<string>('Chest');
  const [projection, setProjection] = useState<string>('PA (Posteroanterior)');
  const [clinicalHistory, setClinicalHistory] = useState<string>('');
  const [useDeepThinking, setUseDeepThinking] = useState<boolean>(true);
  
  // Interactive Multi-Area Region of Interest (ROI) State
  const [rois, setRois] = useState<XRayROI[]>([]);
  const [selectedShape, setSelectedShape] = useState<AnnotationShape>('rectangle');
  const [selectedColor, setSelectedColor] = useState<string>('#06b6d4');
  const [isLabelingMode, setIsLabelingMode] = useState<boolean>(false);
  const [activeTargetId, setActiveTargetId] = useState<string | null>(null);

  // Direct canvas manipulation drag state
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const [drawPreview, setDrawPreview] = useState<{ x: number; y: number; width?: number; height?: number; endX?: number; endY?: number } | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [reportResult, setReportResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [invertContrast, setInvertContrast] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [isExportingPDF, setIsExportingPDF] = useState<boolean>(false);
  const [savedCaseId, setSavedCaseId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const activeRoi = rois.find(r => r.id === activeTargetId) || null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFileName(file.name);
      setMimeType(file.type || 'image/jpeg');
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
        setReportResult(null);
        setError(null);
        setSavedCaseId(null);
        setRois([]);
        setActiveTargetId(null);
        setIsLabelingMode(false);
        setActiveDrag(null);
        setDrawPreview(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setImageFileName(file.name);
      setMimeType(file.type || 'image/jpeg');
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
        setReportResult(null);
        setError(null);
        setSavedCaseId(null);
        setRois([]);
        setActiveTargetId(null);
        setIsLabelingMode(false);
        setActiveDrag(null);
        setDrawPreview(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const loadSample = (sample: typeof SAMPLE_XRAYS[0]) => {
    setSelectedImage(sample.preview);
    setImageFileName(`${sample.name}.dcm`);
    setMimeType('image/png');
    setExamType(sample.examType);
    setProjection(sample.projection);
    setClinicalHistory(sample.clinicalHistory);
    setReportResult(null);
    setError(null);
    setSavedCaseId(null);
    setIsLabelingMode(false);
    setActiveDrag(null);
    setDrawPreview(null);

    // Preloaded multi-target clinical demonstrations
    if (sample.id === 'sample-cxr') {
      const sampleTargets: XRayROI[] = [
        {
          id: `roi-${Date.now()}-1`,
          shape: 'rectangle',
          color: '#06b6d4',
          x: 54,
          y: 56,
          width: 24,
          height: 24,
          rotation: 0,
          label: 'Right lower lobe dense alveolar consolidation',
          anatomicalLocation: 'Right Lower Zone / Costophrenic Base',
        },
        {
          id: `roi-${Date.now()}-2`,
          shape: 'circle',
          color: '#f59e0b',
          x: 68,
          y: 72,
          width: 20,
          height: 18,
          rotation: 0,
          label: 'Left costophrenic angle blunting / reactive pleural effusion',
          anatomicalLocation: 'Left Lower Zone / Costophrenic Base',
        },
      ];
      setRois(sampleTargets);
      setActiveTargetId(sampleTargets[0].id);
    } else if (sample.id === 'sample-fracture') {
      const sampleTargets: XRayROI[] = [
        {
          id: `roi-${Date.now()}-1`,
          shape: 'arrow',
          color: '#ef4444',
          x: 16,
          y: 20,
          endX: 36,
          endY: 38,
          label: 'Distal radius cortical breach / transverse fracture line',
          anatomicalLocation: 'Distal Epiphysis / Articular Joint Surface',
        },
        {
          id: `roi-${Date.now()}-2`,
          shape: 'circle',
          color: '#f59e0b',
          x: 28,
          y: 32,
          width: 22,
          height: 22,
          rotation: 0,
          label: 'Dorsal soft tissue swelling & apex-dorsal step displacement',
          anatomicalLocation: 'Midshaft / Metaphyseal Junction',
        },
      ];
      setRois(sampleTargets);
      setActiveTargetId(sampleTargets[0].id);
    } else if (sample.id === 'sample-axr') {
      const sampleTargets: XRayROI[] = [
        {
          id: `roi-${Date.now()}-1`,
          shape: 'rectangle',
          color: '#10b981',
          x: 26,
          y: 22,
          width: 44,
          height: 32,
          rotation: 0,
          label: 'Centrally dilated small bowel loops (>3cm caliber)',
          anatomicalLocation: 'Central Mesogastric Zone',
        },
        {
          id: `roi-${Date.now()}-2`,
          shape: 'arrow',
          color: '#f59e0b',
          x: 62,
          y: 36,
          endX: 42,
          endY: 52,
          label: 'Air-fluid level step-ladder pattern on plain projection',
          anatomicalLocation: 'Mid-Vertebral Bodies & Discs',
        },
      ];
      setRois(sampleTargets);
      setActiveTargetId(sampleTargets[0].id);
    } else {
      setRois([]);
      setActiveTargetId(null);
    }
  };

  const addPresetTarget = (label: string) => {
    let bounds = { x: 35, y: 35, width: 26, height: 24, endX: 50, endY: 50 };
    const lower = label.toLowerCase();
    
    if (lower.includes('lower') || lower.includes('base') || lower.includes('costophrenic')) {
      bounds = { x: 55, y: 60, width: 26, height: 24, endX: 68, endY: 72 };
    } else if (lower.includes('apex') || lower.includes('apical') || lower.includes('upper')) {
      bounds = { x: 55, y: 15, width: 24, height: 20, endX: 67, endY: 25 };
    } else if (lower.includes('hilar') || lower.includes('mediastin') || lower.includes('cardio')) {
      bounds = { x: 38, y: 36, width: 28, height: 28, endX: 52, endY: 50 };
    } else if (lower.includes('fracture') || lower.includes('distal') || lower.includes('articular')) {
      bounds = { x: 22, y: 22, width: 24, height: 22, endX: 38, endY: 38 };
    } else if (lower.includes('bowel') || lower.includes('air-fluid')) {
      bounds = { x: 28, y: 26, width: 40, height: 32, endX: 48, endY: 42 };
    }

    const zone = getAnatomicalZone(examType, bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    const colorCycle = COLOR_OPTIONS[rois.length % COLOR_OPTIONS.length].hex;

    const newTarget: XRayROI = {
      id: `roi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      shape: selectedShape,
      color: selectedColor || colorCycle,
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      endX: bounds.endX,
      endY: bounds.endY,
      rotation: 0,
      label,
      anatomicalLocation: zone,
    };

    setRois(prev => [...prev, newTarget]);
    setActiveTargetId(newTarget.id);
  };

  const handleUpdateRoi = (id: string, updates: Partial<XRayROI>) => {
    setRois(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, ...updates };
        if (updates.x !== undefined || updates.y !== undefined || updates.endX !== undefined || updates.endY !== undefined) {
          const cx = updated.shape === 'arrow' 
            ? ((updated.x + (updated.endX ?? updated.x)) / 2) 
            : updated.x + (updated.width || 20) / 2;
          const cy = updated.shape === 'arrow' 
            ? ((updated.y + (updated.endY ?? updated.y)) / 2) 
            : updated.y + (updated.height || 20) / 2;
          updated.anatomicalLocation = getAnatomicalZone(examType, cx, cy);
        }
        return updated;
      }
      return item;
    }));
  };

  const handleRemoveRoi = (id: string) => {
    setRois(prev => prev.filter(item => item.id !== id));
    if (activeTargetId === id) {
      setActiveTargetId(null);
    }
  };

  const handleClearAllRois = () => {
    setRois([]);
    setActiveTargetId(null);
    setIsLabelingMode(false);
  };

  // Convert client pointer coordinate to relative percentage (0 - 100)
  const getRelativeCoords = (clientX: number, clientY: number) => {
    if (!imageContainerRef.current) return { x: 0, y: 0 };
    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    return { x, y };
  };

  // Canvas background pointer down (handles either drawing new target or clearing selection)
  const handleCanvasPointerDown = (clientX: number, clientY: number) => {
    const { x, y } = getRelativeCoords(clientX, clientY);

    if (isLabelingMode) {
      setActiveDrag({ type: 'draw', startX: x, startY: y });
      if (selectedShape === 'arrow') {
        setDrawPreview({ x, y, endX: x, endY: y });
      } else {
        setDrawPreview({ x, y, width: 0, height: 0 });
      }
    } else {
      // Clicked empty canvas space
      setActiveTargetId(null);
    }
  };

  // Start Move interaction on an existing target
  const handleStartMove = (e: React.MouseEvent | React.TouchEvent, roi: XRayROI) => {
    e.stopPropagation();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const { x, y } = getRelativeCoords(clientX, clientY);

    setActiveTargetId(roi.id);
    setActiveDrag({
      type: 'move',
      roiId: roi.id,
      initialX: roi.x,
      initialY: roi.y,
      initialEndX: roi.endX,
      initialEndY: roi.endY,
      startRelX: x,
      startRelY: y,
    });
  };

  // Start Corner Resize interaction
  const handleStartResize = (e: React.MouseEvent | React.TouchEvent, roi: XRayROI, corner: 'tl' | 'tr' | 'br' | 'bl') => {
    e.stopPropagation();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const { x, y } = getRelativeCoords(clientX, clientY);

    setActiveTargetId(roi.id);
    setActiveDrag({
      type: 'resize',
      roiId: roi.id,
      corner,
      initialX: roi.x,
      initialY: roi.y,
      initialW: roi.width || 20,
      initialH: roi.height || 20,
      startRelX: x,
      startRelY: y,
    });
  };

  // Start Arrowhead Tip (Head) interaction
  const handleStartArrowHead = (e: React.MouseEvent | React.TouchEvent, roi: XRayROI) => {
    e.stopPropagation();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const { x, y } = getRelativeCoords(clientX, clientY);

    setActiveTargetId(roi.id);
    setActiveDrag({
      type: 'arrow-head',
      roiId: roi.id,
      startRelX: x,
      startRelY: y,
    });
  };

  // Start Arrow Tail (Origin) interaction
  const handleStartArrowTail = (e: React.MouseEvent | React.TouchEvent, roi: XRayROI) => {
    e.stopPropagation();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const { x, y } = getRelativeCoords(clientX, clientY);

    setActiveTargetId(roi.id);
    setActiveDrag({
      type: 'arrow-tail',
      roiId: roi.id,
      startRelX: x,
      startRelY: y,
    });
  };

  // Start Rotation interaction for Rectangles & Circles
  const handleStartRotate = (e: React.MouseEvent | React.TouchEvent, roi: XRayROI) => {
    e.stopPropagation();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const { x, y } = getRelativeCoords(clientX, clientY);

    const centerX = roi.x + (roi.width || 20) / 2;
    const centerY = roi.y + (roi.height || 20) / 2;
    const startAngle = (Math.atan2(y - centerY, x - centerX) * 180) / Math.PI;

    setActiveTargetId(roi.id);
    setActiveDrag({
      type: 'rotate',
      roiId: roi.id,
      centerX,
      centerY,
      initialRot: roi.rotation || 0,
      startAngle,
    });
  };

  // Global Pointer Move & Up listeners while dragging
  const handleContainerPointerMove = (clientX: number, clientY: number) => {
    if (!activeDrag) return;
    const { x: curX, y: curY } = getRelativeCoords(clientX, clientY);

    if (activeDrag.type === 'draw') {
      if (selectedShape === 'arrow') {
        setDrawPreview({ x: activeDrag.startX, y: activeDrag.startY, endX: curX, endY: curY });
      } else {
        const x = Math.min(activeDrag.startX, curX);
        const y = Math.min(activeDrag.startY, curY);
        const width = Math.abs(curX - activeDrag.startX);
        const height = Math.abs(curY - activeDrag.startY);
        setDrawPreview({ x, y, width, height });
      }
    } else if (activeDrag.type === 'move') {
      const dx = curX - activeDrag.startRelX;
      const dy = curY - activeDrag.startRelY;
      const targetRoi = rois.find(r => r.id === activeDrag.roiId);
      if (!targetRoi) return;

      if (targetRoi.shape === 'arrow') {
        const initEndX = activeDrag.initialEndX ?? targetRoi.x + 12;
        const initEndY = activeDrag.initialEndY ?? targetRoi.y + 12;
        handleUpdateRoi(activeDrag.roiId, {
          x: Math.max(1, Math.min(99, Math.round(activeDrag.initialX + dx))),
          y: Math.max(1, Math.min(99, Math.round(activeDrag.initialY + dy))),
          endX: Math.max(1, Math.min(99, Math.round(initEndX + dx))),
          endY: Math.max(1, Math.min(99, Math.round(initEndY + dy))),
        });
      } else {
        const w = targetRoi.width || 20;
        const h = targetRoi.height || 20;
        handleUpdateRoi(activeDrag.roiId, {
          x: Math.max(0, Math.min(100 - w, Math.round(activeDrag.initialX + dx))),
          y: Math.max(0, Math.min(100 - h, Math.round(activeDrag.initialY + dy))),
        });
      }
    } else if (activeDrag.type === 'resize') {
      const dx = curX - activeDrag.startRelX;
      const dy = curY - activeDrag.startRelY;
      const { initialX, initialY, initialW, initialH, corner } = activeDrag;

      let newX = initialX;
      let newY = initialY;
      let newW = initialW;
      let newH = initialH;

      if (corner === 'br') {
        newW = Math.max(5, Math.min(100 - initialX, Math.round(initialW + dx)));
        newH = Math.max(5, Math.min(100 - initialY, Math.round(initialH + dy)));
      } else if (corner === 'tl') {
        newX = Math.max(0, Math.min(initialX + initialW - 5, Math.round(initialX + dx)));
        newY = Math.max(0, Math.min(initialY + initialH - 5, Math.round(initialY + dy)));
        newW = initialW - (newX - initialX);
        newH = initialH - (newY - initialY);
      } else if (corner === 'tr') {
        newY = Math.max(0, Math.min(initialY + initialH - 5, Math.round(initialY + dy)));
        newW = Math.max(5, Math.min(100 - initialX, Math.round(initialW + dx)));
        newH = initialH - (newY - initialY);
      } else if (corner === 'bl') {
        newX = Math.max(0, Math.min(initialX + initialW - 5, Math.round(initialX + dx)));
        newW = initialW - (newX - initialX);
        newH = Math.max(5, Math.min(100 - initialY, Math.round(initialH + dy)));
      }

      handleUpdateRoi(activeDrag.roiId, {
        x: newX,
        y: newY,
        width: newW,
        height: newH,
      });
    } else if (activeDrag.type === 'arrow-head') {
      handleUpdateRoi(activeDrag.roiId, {
        endX: Math.max(1, Math.min(99, Math.round(curX))),
        endY: Math.max(1, Math.min(99, Math.round(curY))),
      });
    } else if (activeDrag.type === 'arrow-tail') {
      handleUpdateRoi(activeDrag.roiId, {
        x: Math.max(1, Math.min(99, Math.round(curX))),
        y: Math.max(1, Math.min(99, Math.round(curY))),
      });
    } else if (activeDrag.type === 'rotate') {
      const angle = (Math.atan2(curY - activeDrag.centerY, curX - activeDrag.centerX) * 180) / Math.PI;
      const deltaAngle = angle - activeDrag.startAngle;
      let newRot = Math.round((activeDrag.initialRot + deltaAngle + 360) % 360);
      handleUpdateRoi(activeDrag.roiId, { rotation: newRot });
    }
  };

  const handleContainerPointerUp = () => {
    if (!activeDrag) return;

    if (activeDrag.type === 'draw') {
      const targetNumber = rois.length + 1;
      let newTarget: XRayROI;

      if (selectedShape === 'arrow') {
        let startX = activeDrag.startX;
        let startY = activeDrag.startY;
        let endX = drawPreview?.endX ?? activeDrag.startX;
        let endY = drawPreview?.endY ?? activeDrag.startY;

        const dist = Math.hypot(endX - startX, endY - startY);
        if (dist < 4) {
          startX = Math.max(5, startX - 16);
          startY = Math.max(5, startY - 16);
        }

        const zone = getAnatomicalZone(examType, endX, endY);
        const defaultLabel = ROI_SUGGESTIONS[examType]?.[(targetNumber - 1) % (ROI_SUGGESTIONS[examType]?.length || 1)] || `Focal Target #${targetNumber}`;

        newTarget = {
          id: `roi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          shape: 'arrow',
          color: selectedColor,
          x: Math.round(startX),
          y: Math.round(startY),
          endX: Math.round(endX),
          endY: Math.round(endY),
          label: defaultLabel,
          anatomicalLocation: zone,
        };
      } else {
        let finalBox = drawPreview;
        if (!finalBox || ((finalBox.width || 0) < 3 && (finalBox.height || 0) < 3)) {
          const size = 20;
          const x = Math.max(0, Math.min(100 - size, activeDrag.startX - size / 2));
          const y = Math.max(0, Math.min(100 - size, activeDrag.startY - size / 2));
          finalBox = { x, y, width: size, height: size };
        } else {
          if ((finalBox.width || 0) < 5) finalBox.width = 15;
          if ((finalBox.height || 0) < 5) finalBox.height = 15;
        }

        const centerX = (finalBox.x || 0) + (finalBox.width || 20) / 2;
        const centerY = (finalBox.y || 0) + (finalBox.height || 20) / 2;
        const zone = getAnatomicalZone(examType, centerX, centerY);
        const defaultLabel = ROI_SUGGESTIONS[examType]?.[(targetNumber - 1) % (ROI_SUGGESTIONS[examType]?.length || 1)] || `Focal Target #${targetNumber}`;

        newTarget = {
          id: `roi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          shape: selectedShape,
          color: selectedColor,
          x: Math.round(finalBox.x || 0),
          y: Math.round(finalBox.y || 0),
          width: Math.round(finalBox.width || 20),
          height: Math.round(finalBox.height || 20),
          rotation: 0,
          label: defaultLabel,
          anatomicalLocation: zone,
        };
      }

      setRois(prev => [...prev, newTarget]);
      setActiveTargetId(newTarget.id);
      setIsLabelingMode(false);
      setDrawPreview(null);
    }

    setActiveDrag(null);
  };

  const handleAnalyze = async () => {
    if (!selectedImage) return;

    setIsAnalyzing(true);
    setError(null);
    setCopied(false);

    try {
      const activeTargets = rois.length > 0 ? rois : undefined;

      const response = await analyzeXRayImage({
        imageData: selectedImage,
        mimeType: mimeType,
        examType: examType,
        viewProjection: projection,
        clinicalHistory: clinicalHistory.trim(),
        useDeepThinking: useDeepThinking,
        rois: activeTargets,
        roi: activeTargets ? activeTargets[0] : undefined,
      });

      const result: AnalysisResult = {
        text: response.text,
        groundingChunks: response.groundingChunks,
        timestamp: Date.now(),
      };

      setReportResult(result);

      // Save case record
      const newCaseRecord: CaseRecord = {
        id: `XR-${Date.now().toString().slice(-6)}`,
        type: 'xray',
        modality: 'xray',
        preview: selectedImage,
        media: [{ type: 'image', preview: selectedImage }],
        description: `[${examType} Radiograph - ${projection}] ${
          activeTargets && activeTargets.length > 0 
            ? `[Targeted Sites (${activeTargets.length}): ${activeTargets.map(t => t.label).join('; ')}] ` 
            : ''
        }${clinicalHistory || 'Routine radiography review.'}`,
        date: new Date().toLocaleDateString(),
        timestamp: Date.now(),
        result: result,
        roi: activeTargets ? activeTargets[0] : undefined,
        rois: activeTargets,
      };

      setSavedCaseId(newCaseRecord.id);
      if (onCaseSaved) {
        onCaseSaved(newCaseRecord);
      }
    } catch (err: any) {
      console.error('X-Ray Analysis failed:', err);
      setError(err?.message || 'Failed to complete X-Ray analysis. Please verify your connection or try another image.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExportPDF = async () => {
    if (!reportResult || !selectedImage) return;

    try {
      setIsExportingPDF(true);
      const activeTargets = rois.length > 0 ? rois : undefined;

      const caseRecord: CaseRecord = {
        id: savedCaseId || `XR-${Date.now().toString().slice(-6)}`,
        type: 'xray',
        modality: 'xray',
        preview: selectedImage,
        media: [{ type: 'image', preview: selectedImage }],
        description: `[${examType} Radiograph - ${projection}] ${
          activeTargets && activeTargets.length > 0 
            ? `[Targeted Sites (${activeTargets.length}): ${activeTargets.map(t => t.label).join('; ')}] ` 
            : ''
        }${clinicalHistory || 'Clinical Radiography Examination'}`,
        date: new Date().toLocaleDateString(),
        timestamp: Date.now(),
        result: reportResult,
        roi: activeTargets ? activeTargets[0] : undefined,
        rois: activeTargets,
      };

      await exportCaseReportToPDF(caseRecord);
    } catch (err) {
      console.error('PDF export error:', err);
      setError('Failed to export PDF report.');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleCopyReport = () => {
    if (!reportResult) return;
    navigator.clipboard.writeText(reportResult.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handlePrint = () => {
    window.print();
  };

  const resetSelection = () => {
    setSelectedImage(null);
    setReportResult(null);
    setImageFileName('');
    setClinicalHistory('');
    setError(null);
    setSavedCaseId(null);
    setRois([]);
    setActiveTargetId(null);
    setIsLabelingMode(false);
    setActiveDrag(null);
    setDrawPreview(null);
  };

  return (
    <section className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden mb-12">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-medical-900 p-6 sm:p-8 text-white relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center text-medical-300 shadow-inner flex-shrink-0">
              <IconXRay className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-medical-500/20 text-medical-300 border border-medical-400/30 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider">
                  Radiology Suite
                </span>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <IconSparkles className="w-3.5 h-3.5 text-amber-400" /> Multi-Target Annotation & Direction Controls
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold mt-1 text-white">X-Ray Diagnostic Analysis & Reporting</h2>
              <p className="text-slate-300 text-sm mt-1 max-w-2xl">
                Upload radiographs, target multiple anatomical areas with shapes & directional arrows, interactively resize, relocate, rotate, and generate ACR-compliant reports.
              </p>
            </div>
          </div>

          {/* Deep Thinking Mode Toggle */}
          <div className="flex items-center gap-3 bg-white/10 backdrop-blur border border-white/10 px-4 py-2.5 rounded-xl self-start md:self-auto">
            <div className="text-right">
              <div className="text-xs font-semibold text-white flex items-center gap-1.5 justify-end">
                <IconBrain className="w-3.5 h-3.5 text-medical-400" />
                Deep Clinical Reasoning
              </div>
              <div className="text-[10px] text-slate-300">Gemini 3.8 Flash Vision</div>
            </div>
            <button
              onClick={() => setUseDeepThinking(!useDeepThinking)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                useDeepThinking ? 'bg-medical-500' : 'bg-slate-700'
              }`}
              title="Toggle deep multi-step thinking budget (32k)"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  useDeepThinking ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Quick Sample Selector Bar */}
        <div className="mt-6 pt-5 border-t border-white/10 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider mr-1">
            Test with clinical cases:
          </span>
          {SAMPLE_XRAYS.map((sample) => (
            <button
              key={sample.id}
              onClick={() => loadSample(sample)}
              className="bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1.5 rounded-lg border border-white/15 transition-all flex items-center gap-1.5"
            >
              <span className="w-2 h-2 rounded-full bg-medical-400"></span>
              <span className="font-medium">{sample.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Workspace Area */}
      <div className="p-6 sm:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Image Input & Multi-Target Direct Manipulation (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Image Preview or Drop Zone */}
            {!selectedImage ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-medical-500 rounded-2xl p-8 text-center cursor-pointer bg-slate-50 hover:bg-medical-50/40 transition-all flex flex-col items-center justify-center min-h-[300px] group"
              >
                <div className="w-16 h-16 rounded-2xl bg-white shadow-sm border border-slate-200 flex items-center justify-center text-medical-600 mb-4 group-hover:scale-110 transition-transform">
                  <IconUpload className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-slate-800">Select or Drag & Drop X-Ray Radiograph</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                  Supports DICOM exports, PNG, JPEG, WEBP. Plain films of chest, spine, pelvis, or extremities.
                </p>
                <div className="mt-5 flex gap-2">
                  <span className="bg-medical-600 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm group-hover:bg-medical-700 transition-colors">
                    Browse File
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-md relative group flex flex-col">
                {/* Top Image Toolbar */}
                <div className="p-3 bg-slate-850 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300">
                  <span className="font-mono truncate max-w-[150px] sm:max-w-[180px]">{imageFileName || 'Radiograph Image'}</span>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <button
                      onClick={() => setInvertContrast(!invertContrast)}
                      className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
                        invertContrast ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                      }`}
                      title="Toggle inverted negative contrast (Bone window)"
                    >
                      {invertContrast ? 'Bone Neg: ON' : 'Invert'}
                    </button>

                    <button
                      onClick={() => setIsLabelingMode(!isLabelingMode)}
                      className={`px-2.5 py-1 rounded text-[11px] font-bold border flex items-center gap-1.5 transition-all ${
                        isLabelingMode
                          ? 'bg-cyan-400 text-slate-950 border-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.8)] font-black'
                          : rois.length > 0
                          ? 'bg-cyan-950/90 text-cyan-300 border-cyan-500/60 hover:bg-cyan-900/90'
                          : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                      }`}
                      title="Click or drag on image to place selected shape/arrow target"
                    >
                      <IconCrosshair className="w-3.5 h-3.5" />
                      <span>{isLabelingMode ? 'Click on image...' : `+ Target Area (${rois.length})`}</span>
                    </button>

                    <button
                      onClick={resetSelection}
                      className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                      title="Remove image"
                    >
                      <IconTrash className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Sub-toolbar: Tool shape and Color selector */}
                <div className="px-3 py-2 bg-slate-800/90 border-b border-slate-700/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                  {/* Tool Shape Selector */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Tool:</span>
                    {SHAPE_OPTIONS.map((shapeOpt) => {
                      const IconComp = shapeOpt.icon;
                      const isSelected = selectedShape === shapeOpt.id;
                      return (
                        <button
                          key={shapeOpt.id}
                          onClick={() => {
                            setSelectedShape(shapeOpt.id);
                            if (activeRoi) {
                              handleUpdateRoi(activeRoi.id, { shape: shapeOpt.id });
                            } else if (!isLabelingMode) {
                              setIsLabelingMode(true);
                            }
                          }}
                          className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-all ${
                            isSelected
                              ? 'bg-medical-600 text-white border-medical-400 shadow-sm'
                              : 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-650 hover:text-white'
                          }`}
                          title={`Select ${shapeOpt.name} Tool`}
                        >
                          <IconComp className="w-3.5 h-3.5" />
                          <span className="text-[11px] font-medium hidden sm:inline">{shapeOpt.name}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Color Selector */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Color:</span>
                    {COLOR_OPTIONS.map((colorOpt) => {
                      const isSelected = (activeRoi ? activeRoi.color : selectedColor) === colorOpt.hex;
                      return (
                        <button
                          key={colorOpt.id}
                          onClick={() => {
                            setSelectedColor(colorOpt.hex);
                            if (activeRoi) {
                              handleUpdateRoi(activeRoi.id, { color: colorOpt.hex });
                            }
                          }}
                          className={`w-5 h-5 rounded-full transition-all border ${
                            isSelected
                              ? 'scale-125 border-white shadow-[0_0_8px_rgba(255,255,255,0.8)]'
                              : 'border-transparent opacity-70 hover:opacity-100 hover:scale-110'
                          }`}
                          style={{ backgroundColor: colorOpt.hex }}
                          title={`Select ${colorOpt.name} Color`}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Direct-manipulation helper tip */}
                {activeRoi && (
                  <div className="px-3 py-1 bg-medical-950/60 border-b border-medical-500/30 text-[10px] text-cyan-200 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: activeRoi.color }}></span>
                      <strong>Target #{rois.findIndex(r => r.id === activeRoi.id) + 1} Active:</strong> Drag body to relocate, handles to resize/steer.
                    </span>
                    <button
                      onClick={() => setActiveTargetId(null)}
                      className="text-slate-400 hover:text-white underline"
                    >
                      Deselect
                    </button>
                  </div>
                )}

                {/* Interactive X-Ray Radiograph Canvas */}
                <div
                  ref={imageContainerRef}
                  onMouseDown={(e) => handleCanvasPointerDown(e.clientX, e.clientY)}
                  onMouseMove={(e) => handleContainerPointerMove(e.clientX, e.clientY)}
                  onMouseUp={handleContainerPointerUp}
                  onMouseLeave={handleContainerPointerUp}
                  onTouchStart={(e) => {
                    if (e.touches[0]) handleCanvasPointerDown(e.touches[0].clientX, e.touches[0].clientY);
                  }}
                  onTouchMove={(e) => {
                    if (e.touches[0]) handleContainerPointerMove(e.touches[0].clientX, e.touches[0].clientY);
                  }}
                  onTouchEnd={handleContainerPointerUp}
                  className={`relative aspect-square max-h-[400px] bg-black flex items-center justify-center overflow-hidden select-none ${
                    isLabelingMode ? 'cursor-crosshair' : 'cursor-default'
                  }`}
                >
                  <img
                    src={selectedImage}
                    alt="X-Ray Radiograph Preview"
                    draggable={false}
                    className={`max-h-full max-w-full object-contain pointer-events-none transition-all duration-200 ${
                      invertContrast ? 'invert contrast-125' : ''
                    }`}
                  />

                  {/* Mode Banner Overlay */}
                  {isLabelingMode && (
                    <div className="absolute top-2 left-2 right-2 bg-slate-900/95 backdrop-blur border border-cyan-400/80 px-3 py-1.5 rounded-lg text-xs text-cyan-200 flex items-center justify-between z-30 shadow-lg animate-pulse">
                      <div className="flex items-center gap-1.5">
                        <IconCrosshair className="w-4 h-4 text-cyan-400" />
                        <span className="font-semibold">
                          Click & drag on image to place {selectedShape.toUpperCase()} (Target #{rois.length + 1})
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsLabelingMode(false);
                        }}
                        className="text-[10px] text-cyan-300 hover:text-white underline font-mono ml-2"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* SVG Overlay for Directional Arrows and Shape Rendering */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <defs>
                      {COLOR_OPTIONS.map((c) => (
                        <marker
                          key={`arrowhead-${c.id}`}
                          id={`arrowhead-${c.id}`}
                          markerWidth="6"
                          markerHeight="6"
                          refX="5"
                          refY="3"
                          orient="auto"
                        >
                          <polygon points="0 0, 6 3, 0 6" fill={c.hex} />
                        </marker>
                      ))}
                      <marker
                        id="arrowhead-dynamic"
                        markerWidth="6"
                        markerHeight="6"
                        refX="5"
                        refY="3"
                        orient="auto"
                      >
                        <polygon points="0 0, 6 3, 0 6" fill={selectedColor} />
                      </marker>
                    </defs>

                    {/* Active Drawing Arrow Preview */}
                    {activeDrag?.type === 'draw' && selectedShape === 'arrow' && drawPreview && (
                      <line
                        x1={activeDrag.startX}
                        y1={activeDrag.startY}
                        x2={drawPreview.endX ?? activeDrag.startX}
                        y2={drawPreview.endY ?? activeDrag.startY}
                        stroke={selectedColor}
                        strokeWidth="1.2"
                        strokeDasharray="2 1"
                        markerEnd="url(#arrowhead-dynamic)"
                      />
                    )}

                    {/* Confirmed Arrow Targets (Line + Arrowhead only - NO TEXT OVERLAY) */}
                    {rois
                      .filter(r => r.shape === 'arrow')
                      .map((arrowRoi) => {
                        const markerColorObj = COLOR_OPTIONS.find(c => c.hex.toLowerCase() === arrowRoi.color.toLowerCase()) || { id: 'cyan' };
                        const isSelected = activeTargetId === arrowRoi.id;
                        return (
                          <g key={arrowRoi.id}>
                            <line
                              x1={arrowRoi.x}
                              y1={arrowRoi.y}
                              x2={arrowRoi.endX ?? arrowRoi.x + 12}
                              y2={arrowRoi.endY ?? arrowRoi.y + 12}
                              stroke={arrowRoi.color}
                              strokeWidth={isSelected ? '1.8' : '1.3'}
                              markerEnd={`url(#arrowhead-${markerColorObj.id})`}
                              filter="drop-shadow(0px 0px 2px rgba(0,0,0,0.8))"
                            />
                          </g>
                        );
                      })}
                  </svg>

                  {/* Active Drawing Rectangle / Circle Preview */}
                  {activeDrag?.type === 'draw' && drawPreview && selectedShape !== 'arrow' && (
                    <div
                      className={`absolute border-2 border-dashed pointer-events-none z-10 ${
                        selectedShape === 'circle' ? 'rounded-full' : 'rounded'
                      }`}
                      style={{
                        left: `${drawPreview.x}%`,
                        top: `${drawPreview.y}%`,
                        width: `${drawPreview.width}%`,
                        height: `${drawPreview.height}%`,
                        borderColor: selectedColor,
                        backgroundColor: `${selectedColor}30`,
                        boxShadow: `0 0 14px ${selectedColor}80`,
                      }}
                    >
                      <span 
                        className="absolute -top-3.5 -left-3.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow"
                        style={{ backgroundColor: selectedColor }}
                      >
                        {rois.length + 1}
                      </span>
                    </div>
                  )}

                  {/* Confirmed Multiple Targeted Areas (NO TEXT OVERLAY - ONLY NUMBERED BADGES & CRISP OUTLINES) */}
                  {rois.map((roi, idx) => {
                    const isSelected = activeTargetId === roi.id;

                    // Arrow Target Handles & Pin
                    if (roi.shape === 'arrow') {
                      const endX = roi.endX ?? roi.x + 12;
                      const endY = roi.endY ?? roi.y + 12;
                      const midX = (roi.x + endX) / 2;
                      const midY = (roi.y + endY) / 2;

                      return (
                        <React.Fragment key={roi.id}>
                          {/* Numbered pin badge at origin of arrow (also draggable tail) */}
                          <div
                            onMouseDown={(e) => handleStartArrowTail(e, roi)}
                            onTouchStart={(e) => handleStartArrowTail(e, roi)}
                            className={`absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black text-white shadow-lg z-20 cursor-grab active:cursor-grabbing transition-transform ${
                              isSelected ? 'scale-125 ring-2 ring-white shadow-[0_0_12px_white]' : 'hover:scale-110 ring-1 ring-black/50'
                            }`}
                            style={{
                              left: `${roi.x}%`,
                              top: `${roi.y}%`,
                              backgroundColor: roi.color,
                            }}
                            title={`Target #${idx + 1}: Drag tail to move arrow base`}
                          >
                            {idx + 1}
                          </div>

                          {/* When selected: Interactive Arrowhead Tip Steering Handle (changes length & direction 360°) */}
                          {isSelected && (
                            <>
                              <div
                                onMouseDown={(e) => handleStartArrowHead(e, roi)}
                                onTouchStart={(e) => handleStartArrowHead(e, roi)}
                                className="absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full border-2 border-white bg-slate-950/80 shadow-[0_0_12px_rgba(255,255,255,0.9)] flex items-center justify-center z-25 cursor-crosshair hover:scale-125 transition-transform"
                                style={{
                                  left: `${endX}%`,
                                  top: `${endY}%`,
                                }}
                                title="Drag to steer direction & adjust arrow length"
                              >
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: roi.color }}></span>
                              </div>

                              {/* Midpoint relocation handle */}
                              <div
                                onMouseDown={(e) => handleStartMove(e, roi)}
                                onTouchStart={(e) => handleStartMove(e, roi)}
                                className="absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-900 border border-white text-white flex items-center justify-center shadow-md z-20 cursor-move hover:scale-115 transition-transform"
                                style={{
                                  left: `${midX}%`,
                                  top: `${midY}%`,
                                }}
                                title="Drag arrow body to relocate"
                              >
                                <IconMove className="w-3 h-3 text-cyan-300" />
                              </div>
                            </>
                          )}
                        </React.Fragment>
                      );
                    }

                    // Rectangle or Circle Shape
                    return (
                      <div
                        key={roi.id}
                        onMouseDown={(e) => handleStartMove(e, roi)}
                        onTouchStart={(e) => handleStartMove(e, roi)}
                        className={`absolute border-2 z-10 transition-shadow ${
                          roi.shape === 'circle' ? 'rounded-full' : 'rounded'
                        } ${isSelected ? 'ring-2 ring-white cursor-move' : 'cursor-pointer hover:border-white'}`}
                        style={{
                          left: `${roi.x}%`,
                          top: `${roi.y}%`,
                          width: `${roi.width || 20}%`,
                          height: `${roi.height || 20}%`,
                          borderColor: roi.color,
                          backgroundColor: `${roi.color}20`,
                          boxShadow: isSelected ? `0 0 16px ${roi.color}` : `0 0 10px ${roi.color}50`,
                          transform: roi.rotation ? `rotate(${roi.rotation}deg)` : undefined,
                        }}
                        title={`Target #${idx + 1} (${roi.shape}) - Click to select & drag to relocate`}
                      >
                        {/* Compact numbered badge at top-left corner without covering anatomy */}
                        <div
                          className="absolute -top-2.5 -left-2.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-md z-20 pointer-events-none ring-1 ring-black/50"
                          style={{ backgroundColor: roi.color }}
                        >
                          {idx + 1}
                        </div>

                        {/* Interactive Resize & Rotation Handles (only when target is selected) */}
                        {isSelected && (
                          <>
                            {/* Rotation Handle (top center stem knob) */}
                            <div
                              onMouseDown={(e) => handleStartRotate(e, roi)}
                              onTouchStart={(e) => handleStartRotate(e, roi)}
                              className="absolute -top-7 left-1/2 -translate-x-1/2 flex flex-col items-center cursor-grab active:cursor-grabbing z-30 group"
                              title="Drag to rotate shape"
                            >
                              <div className="w-4 h-4 rounded-full bg-white border border-slate-700 shadow-md flex items-center justify-center text-slate-800 hover:scale-125 transition-transform">
                                <IconRotateCw className="w-2.5 h-2.5" />
                              </div>
                              <div className="w-0.5 h-3 bg-white/80"></div>
                            </div>

                            {/* Corner Resize Handles */}
                            {/* Top-Left */}
                            <div
                              onMouseDown={(e) => handleStartResize(e, roi, 'tl')}
                              onTouchStart={(e) => handleStartResize(e, roi, 'tl')}
                              className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white border border-black/60 shadow-sm cursor-nwse-resize z-25 hover:scale-125 transition-transform"
                              title="Resize Top-Left"
                            />
                            {/* Top-Right */}
                            <div
                              onMouseDown={(e) => handleStartResize(e, roi, 'tr')}
                              onTouchStart={(e) => handleStartResize(e, roi, 'tr')}
                              className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white border border-black/60 shadow-sm cursor-nesw-resize z-25 hover:scale-125 transition-transform"
                              title="Resize Top-Right"
                            />
                            {/* Bottom-Right */}
                            <div
                              onMouseDown={(e) => handleStartResize(e, roi, 'br')}
                              onTouchStart={(e) => handleStartResize(e, roi, 'br')}
                              className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border border-black/60 shadow-sm cursor-nwse-resize z-25 hover:scale-125 transition-transform"
                              title="Resize Bottom-Right"
                            />
                            {/* Bottom-Left */}
                            <div
                              onMouseDown={(e) => handleStartResize(e, roi, 'bl')}
                              onTouchStart={(e) => handleStartResize(e, roi, 'bl')}
                              className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-white border border-black/60 shadow-sm cursor-nesw-resize z-25 hover:scale-125 transition-transform"
                              title="Resize Bottom-Left"
                            />
                          </>
                        )}
                      </div>
                    );
                  })}

                  {/* Anatomical Tag Bottom Left */}
                  <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur px-2.5 py-1 rounded text-[10px] text-white font-mono uppercase z-0">
                    {examType} • {projection}
                  </div>
                </div>
              </div>
            )}

            {/* Selected Target Fine-Tuning & Steering Controls */}
            {activeRoi && (
              <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 text-white space-y-3 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span 
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white"
                      style={{ backgroundColor: activeRoi.color }}
                    >
                      {rois.findIndex(r => r.id === activeRoi.id) + 1}
                    </span>
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Control Target #{rois.findIndex(r => r.id === activeRoi.id) + 1} ({activeRoi.shape})
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400 font-mono">
                      X: {Math.round(activeRoi.x)}%, Y: {Math.round(activeRoi.y)}%
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
                  {/* 1. Size Controls */}
                  <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/80 space-y-1.5">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <IconMaximize2 className="w-3 h-3 text-cyan-400" /> Size / Scale
                      </span>
                      {activeRoi.shape === 'arrow' ? (
                        <span className="font-mono text-cyan-300 text-[10px]">
                          L: {getArrowMetrics(activeRoi.x, activeRoi.y, activeRoi.endX ?? activeRoi.x + 12, activeRoi.endY ?? activeRoi.y + 12).length}%
                        </span>
                      ) : (
                        <span className="font-mono text-cyan-300 text-[10px]">
                          {activeRoi.width || 20}% × {activeRoi.height || 20}%
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleUpdateRoi(activeRoi.id, scaleShape(activeRoi, 0.85))}
                        className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-650 text-white rounded text-xs font-bold transition-colors"
                        title="Decrease size by 15%"
                      >
                        - Smaller
                      </button>
                      <button
                        onClick={() => handleUpdateRoi(activeRoi.id, scaleShape(activeRoi, 1.15))}
                        className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-650 text-white rounded text-xs font-bold transition-colors"
                        title="Increase size by 15%"
                      >
                        + Bigger
                      </button>
                    </div>
                  </div>

                  {/* 2. Direction & Rotation Controls */}
                  <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/80 space-y-1.5">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <IconRotateCw className="w-3 h-3 text-cyan-400" /> Direction
                      </span>
                      {activeRoi.shape === 'arrow' ? (
                        <span className="font-mono text-cyan-300 text-[10px]">
                          {getArrowMetrics(activeRoi.x, activeRoi.y, activeRoi.endX ?? activeRoi.x + 12, activeRoi.endY ?? activeRoi.y + 12).angle}°
                        </span>
                      ) : (
                        <span className="font-mono text-cyan-300 text-[10px]">
                          {activeRoi.rotation || 0}°
                        </span>
                      )}
                    </div>
                    
                    {activeRoi.shape === 'arrow' ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleUpdateRoi(activeRoi.id, rotateArrow(activeRoi, -45))}
                            className="flex-1 py-1 bg-slate-700 hover:bg-slate-650 text-white rounded text-[11px] font-medium"
                            title="Rotate counter-clockwise 45 degrees"
                          >
                            ↺ -45°
                          </button>
                          <button
                            onClick={() => handleUpdateRoi(activeRoi.id, rotateArrow(activeRoi, 45))}
                            className="flex-1 py-1 bg-slate-700 hover:bg-slate-650 text-white rounded text-[11px] font-medium"
                            title="Rotate clockwise 45 degrees"
                          >
                            ↻ +45°
                          </button>
                          <button
                            onClick={() => handleUpdateRoi(activeRoi.id, flipArrow(activeRoi))}
                            className="px-2 py-1 bg-cyan-900/60 hover:bg-cyan-800 text-cyan-200 border border-cyan-500/40 rounded text-[11px] font-bold"
                            title="Flip arrow direction 180 degrees"
                          >
                            ⇄ Flip
                          </button>
                        </div>
                        {/* 8-point compass quick direction buttons */}
                        <div className="flex items-center justify-between gap-1 pt-0.5">
                          {[
                            { label: '↖', deg: 225, title: 'North-West' },
                            { label: '↑', deg: 270, title: 'North' },
                            { label: '↗', deg: 315, title: 'North-East' },
                            { label: '←', deg: 180, title: 'West' },
                            { label: '→', deg: 0, title: 'East' },
                            { label: '↙', deg: 135, title: 'South-West' },
                            { label: '↓', deg: 90, title: 'South' },
                            { label: '↘', deg: 45, title: 'South-East' },
                          ].map((d) => (
                            <button
                              key={d.label}
                              onClick={() => handleUpdateRoi(activeRoi.id, setArrowCompassDirection(activeRoi, d.deg))}
                              className="flex-1 py-0.5 bg-slate-750 hover:bg-cyan-700 text-[10px] text-white rounded font-mono transition-colors"
                              title={`Point arrow ${d.title}`}
                            >
                              {d.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleUpdateRoi(activeRoi.id, { rotation: ((activeRoi.rotation || 0) + 45) % 360 })}
                          className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-650 text-white rounded text-[11px] font-medium"
                          title="Rotate 45 degrees clockwise"
                        >
                          ↻ Rotate 45°
                        </button>
                        <button
                          onClick={() => handleUpdateRoi(activeRoi.id, { rotation: 0 })}
                          className="px-2 py-1.5 bg-slate-750 hover:bg-slate-700 text-slate-300 rounded text-[11px]"
                          title="Reset rotation angle to 0°"
                        >
                          Reset
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 3. Relocate Nudge Buttons */}
                  <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/80 space-y-1.5">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <IconMove className="w-3 h-3 text-cyan-400" /> Relocate
                      </span>
                      <span className="text-[10px] text-slate-400">Nudge 2%</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <button
                        onClick={() => handleUpdateRoi(activeRoi.id, nudgeRoi(activeRoi, 0, -2))}
                        className="w-12 py-0.5 bg-slate-700 hover:bg-slate-650 text-white rounded text-xs font-bold"
                        title="Nudge Up"
                      >
                        ▲
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleUpdateRoi(activeRoi.id, nudgeRoi(activeRoi, -2, 0))}
                          className="w-10 py-0.5 bg-slate-700 hover:bg-slate-650 text-white rounded text-xs font-bold"
                          title="Nudge Left"
                        >
                          ◀
                        </button>
                        <span className="w-4 h-4 rounded-full bg-cyan-400/30 flex items-center justify-center text-[9px] font-bold text-cyan-300">
                          ✢
                        </span>
                        <button
                          onClick={() => handleUpdateRoi(activeRoi.id, nudgeRoi(activeRoi, 2, 0))}
                          className="w-10 py-0.5 bg-slate-700 hover:bg-slate-650 text-white rounded text-xs font-bold"
                          title="Nudge Right"
                        >
                          ▶
                        </button>
                      </div>
                      <button
                        onClick={() => handleUpdateRoi(activeRoi.id, nudgeRoi(activeRoi, 0, 2))}
                        className="w-12 py-0.5 bg-slate-700 hover:bg-slate-650 text-white rounded text-xs font-bold"
                        title="Nudge Down"
                      >
                        ▼
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Targeted Areas Management Panel */}
            {selectedImage && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center">
                      <IconTarget className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Targeted Areas of Interest ({rois.length})
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        {rois.length === 0
                          ? 'Select shape tool & color above, then click on the radiograph to mark focal lesions.'
                          : 'Click any target on image to drag, resize corners, or change direction; edit labels below.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setIsLabelingMode(true)}
                      className="px-2.5 py-1 bg-medical-600 hover:bg-medical-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
                    >
                      <IconPlus className="w-3.5 h-3.5" />
                      <span>Add Target</span>
                    </button>
                    {rois.length > 0 && (
                      <button
                        onClick={handleClearAllRois}
                        className="px-2 py-1 text-slate-500 hover:text-red-500 text-xs font-medium transition-colors"
                        title="Clear all targeted regions"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                </div>

                {/* Target Items List */}
                {rois.length > 0 && (
                  <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                    {rois.map((roi, idx) => {
                      const isSelected = activeTargetId === roi.id;
                      return (
                        <div
                          key={roi.id}
                          onClick={() => setActiveTargetId(roi.id)}
                          className={`p-3 rounded-xl border transition-all text-xs cursor-pointer ${
                            isSelected
                              ? 'bg-white border-medical-500 shadow-sm ring-1 ring-medical-400'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              {/* Number Badge */}
                              <span
                                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-2xs flex-shrink-0"
                                style={{ backgroundColor: roi.color }}
                              >
                                {idx + 1}
                              </span>

                              {/* Shape Switcher */}
                              <div className="flex items-center bg-slate-100 rounded p-0.5 border border-slate-200">
                                {SHAPE_OPTIONS.map((so) => {
                                  const IconComp = so.icon;
                                  const activeShape = roi.shape === so.id;
                                  return (
                                    <button
                                      key={so.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleUpdateRoi(roi.id, { shape: so.id });
                                      }}
                                      className={`p-1 rounded text-[10px] transition-colors ${
                                        activeShape ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'
                                      }`}
                                      title={so.name}
                                    >
                                      <IconComp className="w-3 h-3" />
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Color Swatch Picker */}
                              <div className="flex items-center gap-1">
                                {COLOR_OPTIONS.map((co) => (
                                  <button
                                    key={co.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleUpdateRoi(roi.id, { color: co.hex });
                                    }}
                                    className={`w-3.5 h-3.5 rounded-full transition-transform ${
                                      roi.color === co.hex ? 'scale-125 ring-1 ring-slate-400 shadow-xs' : 'opacity-60 hover:opacity-100'
                                    }`}
                                    style={{ backgroundColor: co.hex }}
                                    title={co.name}
                                  />
                                ))}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {roi.anatomicalLocation && (
                                <span className="bg-slate-100 text-slate-600 border border-slate-200 text-[10px] px-1.5 py-0.5 rounded font-mono truncate max-w-[130px]">
                                  {roi.anatomicalLocation}
                                </span>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveRoi(roi.id);
                                }}
                                className="text-slate-400 hover:text-red-500 p-1"
                                title="Delete this target"
                              >
                                ✕
                              </button>
                            </div>
                          </div>

                          {/* Editable Target Label Input */}
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={roi.label}
                              onChange={(e) => handleUpdateRoi(roi.id, { label: e.target.value })}
                              placeholder="Clinical label (e.g. consolidation, fracture line, air-fluid level)..."
                              className="w-full bg-slate-50 border border-slate-200 focus:border-medical-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium outline-none focus:ring-1 focus:ring-medical-400"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Preset Suggestions for Quick Annotation */}
                <div className="pt-2 border-t border-slate-200/80">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Clinical Presets ({examType}):</span>
                    <span className="text-[10px] text-medical-600 font-normal">Click to add focal target</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {ROI_SUGGESTIONS[examType]?.slice(0, 5).map((preset, idx) => (
                      <button
                        key={idx}
                        onClick={() => addPresetTarget(preset)}
                        className="text-[10px] font-medium bg-white hover:bg-medical-50 text-slate-700 hover:text-medical-800 border border-slate-200 hover:border-medical-300 px-2 py-0.5 rounded-md transition-all flex items-center gap-1 shadow-2xs"
                      >
                        <span className="text-medical-600 font-bold">+</span>
                        <span>{preset}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleFileSelect}
            />

            {/* Exam Metadata & Clinical Context Inputs */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Anatomical Region
                  </label>
                  <select
                    value={examType}
                    onChange={(e) => setExamType(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-medical-500 outline-none"
                  >
                    <option value="Chest">Chest (CXR)</option>
                    <option value="Musculoskeletal">Musculoskeletal / Extremity</option>
                    <option value="Abdomen">Abdomen (AXR / KUB)</option>
                    <option value="Spine">Cervical / Thoracic / Lumbar Spine</option>
                    <option value="Pelvis">Pelvis & Hip</option>
                    <option value="Skull & Facial">Skull & Facial Bones</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    View / Projection
                  </label>
                  <select
                    value={projection}
                    onChange={(e) => setProjection(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-medical-500 outline-none"
                  >
                    <option value="PA (Posteroanterior)">PA (Posteroanterior)</option>
                    <option value="AP (Anteroposterior)">AP (Anteroposterior)</option>
                    <option value="Lateral View">Lateral View</option>
                    <option value="Oblique View">Oblique View</option>
                    <option value="Multi-view Series">Multi-view Series</option>
                    <option value="Decubitus / Cross-Table">Decubitus / Cross-Table</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Clinical Indication / Patient History
                </label>
                <textarea
                  value={clinicalHistory}
                  onChange={(e) => setClinicalHistory(e.target.value)}
                  placeholder="Enter patient symptoms, trauma history, pain location, or specific clinical questions (e.g., rule out pneumothorax, evaluate for cortical fracture)..."
                  rows={3}
                  className="w-full bg-white border border-slate-300 rounded-lg p-3 text-xs text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-medical-500 outline-none resize-none leading-relaxed"
                />
              </div>

              <button
                onClick={handleAnalyze}
                disabled={!selectedImage || isAnalyzing}
                className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all ${
                  !selectedImage
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : isAnalyzing
                    ? 'bg-medical-800 text-white cursor-wait'
                    : 'bg-medical-600 hover:bg-medical-700 text-white hover:shadow-lg active:scale-[0.99]'
                }`}
              >
                {isAnalyzing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Analyzing Radiograph with AI & Search Grounding...</span>
                  </>
                ) : (
                  <>
                    <IconBrain className="w-5 h-5" />
                    <span>
                      {rois.length > 0
                        ? `Generate Multi-Target Report (${rois.length} Target${rois.length > 1 ? 's' : ''} Scrutinized)`
                        : 'Generate Professional Radiology Report'}
                    </span>
                  </>
                )}
              </button>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-red-700 text-xs">
                  <IconAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

          </div>

          {/* Right Column: Generated Professional Radiology Report (7 cols) */}
          <div className="lg:col-span-7 flex flex-col">
            {!reportResult ? (
              <div className="h-full min-h-[460px] border border-dashed border-slate-200 rounded-2xl bg-slate-50 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-300 mb-4">
                  <IconXRay className="w-8 h-8" />
                </div>
                <h4 className="text-base font-bold text-slate-700">Radiology Report Output Area</h4>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Once you select a radiograph, mark target areas with shapes/arrows, and generate, the ACR report with systematic findings and PDF export will appear here.
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs text-medical-600 font-medium">
                  <span>Pro-tip:</span> Try one of the clinical cases above for an instant preview.
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-full">
                
                {/* Clinical Report Action Toolbar */}
                <div className="bg-slate-50 border-b border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 border border-emerald-200">
                      <IconCheck className="w-3.5 h-3.5" />
                      Report Verified
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      Ref: {savedCaseId || 'XR-REPORT'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyReport}
                      className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                      title="Copy full text to clipboard"
                    >
                      <IconCopy className="w-3.5 h-3.5 text-slate-500" />
                      <span>{copied ? 'Copied!' : 'Copy Text'}</span>
                    </button>

                    <button
                      onClick={handlePrint}
                      className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                      title="Print radiology report"
                    >
                      <IconPrinter className="w-3.5 h-3.5 text-slate-500" />
                      <span>Print</span>
                    </button>

                    <button
                      onClick={handleExportPDF}
                      disabled={isExportingPDF}
                      className="px-4 py-1.5 bg-medical-700 hover:bg-medical-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                      title="Download as official PDF document"
                    >
                      {isExportingPDF ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Exporting...</span>
                        </>
                      ) : (
                        <>
                          <IconDownload className="w-3.5 h-3.5" />
                          <span>Export PDF</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Structured Clinical Report Content */}
                <div className="p-6 overflow-y-auto max-h-[580px] space-y-5">
                  <div className="border-b border-slate-200 pb-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-black tracking-tight text-slate-900 uppercase">
                        Department of Diagnostic Imaging & Radiology
                      </h3>
                      <span className="text-[11px] font-bold text-slate-400 font-mono">
                        ACR-COMPLIANT
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Digital Radiography Plain Film Report • Generated {new Date().toLocaleDateString()}
                    </p>
                  </div>

                  {/* Multi-Target Summary Callout if targets were marked */}
                  {rois.length > 0 && (
                    <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-850 to-medical-950 border border-slate-700 rounded-xl text-white shadow-sm space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <IconTarget className="w-4 h-4 text-cyan-400" />
                          <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                            Clinician Targeted Focal Sites ({rois.length})
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Prioritized Scrutiny
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {rois.map((t, idx) => (
                          <div
                            key={t.id}
                            className="p-2 rounded-lg bg-slate-800/80 border border-slate-700 text-xs flex items-start gap-2"
                          >
                            <span
                              className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black text-white flex-shrink-0 mt-0.5"
                              style={{ backgroundColor: t.color }}
                            >
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <div className="font-semibold text-white truncate">{t.label}</div>
                              <div className="text-[10px] text-slate-400 truncate">
                                {t.shape.toUpperCase()} • {t.anatomicalLocation || 'Designated Region'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Render Parsed Markdown Sections */}
                  <div className="space-y-4 text-xs leading-relaxed text-slate-700">
                    {reportResult.text.split('\n').map((line, idx) => {
                      const trimmed = line.trim();
                      if (!trimmed) return null;

                      // Level 2 Header
                      if (trimmed.startsWith('## ')) {
                        const title = trimmed.replace('## ', '');
                        const isCritical = title.toLowerCase().includes('critical') || title.toLowerCase().includes('acute');
                        return (
                          <div 
                            key={idx} 
                            className={`pt-3 pb-1 border-b ${
                              isCritical ? 'border-red-200 text-red-700' : 'border-slate-200 text-medical-800'
                            }`}
                          >
                            <h4 className="font-bold text-sm tracking-wide uppercase flex items-center gap-2">
                              {isCritical && <IconAlert className="w-4 h-4 text-red-500" />}
                              {title}
                            </h4>
                          </div>
                        );
                      }

                      // Level 3 Header
                      if (trimmed.startsWith('### ')) {
                        return (
                          <h5 key={idx} className="font-bold text-xs text-slate-900 pt-2">
                            {trimmed.replace('### ', '')}
                          </h5>
                        );
                      }

                      // Bold bullet points
                      if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
                        return (
                          <div key={idx} className="flex items-start gap-2 pl-2">
                            <span className="text-medical-600 font-bold">•</span>
                            <span className="text-slate-800">
                              {trimmed.replace(/^[*•\-]\s*/, '').replace(/\*\*(.*?)\*\*/g, '$1')}
                            </span>
                          </div>
                        );
                      }

                      // Numbered items
                      if (/^\d+\.\s+/.test(trimmed)) {
                        return (
                          <div key={idx} className="flex items-start gap-2 pl-2 font-medium text-slate-900">
                            <span className="text-medical-700 font-bold">{trimmed.match(/^\d+\./)?.[0]}</span>
                            <span>{trimmed.replace(/^\d+\.\s+/, '').replace(/\*\*(.*?)\*\*/g, '$1')}</span>
                          </div>
                        );
                      }

                      return (
                        <p key={idx} className="text-slate-700 leading-normal">
                          {trimmed.replace(/\*\*(.*?)\*\*/g, '$1')}
                        </p>
                      );
                    })}
                  </div>

                  {/* Supporting Grounding References */}
                  {reportResult.groundingChunks && reportResult.groundingChunks.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-slate-200">
                      <h5 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Validated Medical Literature & ACR Guidelines:
                      </h5>
                      <div className="space-y-1.5">
                        {reportResult.groundingChunks.map((chunk, i) => (
                          chunk.web ? (
                            <a
                              key={i}
                              href={chunk.web.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block p-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs text-medical-700 truncate font-medium transition-colors"
                            >
                              <span className="font-bold text-slate-500 mr-2">[ACR REF]</span>
                              {chunk.web.title}
                            </a>
                          ) : null
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Clinical Disclaimer & Sign-off Note */}
                  <div className="mt-6 pt-4 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
                    <span>UltraVision AI Plain Film Radiography Decision Support System</span>
                    <span>Physician Correlation Mandatory</span>
                  </div>
                </div>

              </div>
            )}
          </div>

        </div>
      </div>
    </section>
  );
};
