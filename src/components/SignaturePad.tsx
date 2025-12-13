import { useState, useEffect, useRef } from 'react';
import { X, Eraser, CheckCircle2 } from 'lucide-react';

interface Props {
  title: string;
  onSave: (data: string) => void;
  onClose: () => void;
}

export default function SignaturePad({ title, onSave, onClose }: Props) {
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    const resizeCanvas = () => {
      if (containerRef.current && canvasRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        canvasRef.current.width = rect.width;
        canvasRef.current.height = rect.height;
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = '#1e3a8a';
          ctxRef.current = ctx;
        }
      }
    };
    const observer = new ResizeObserver(resizeCanvas);
    if (containerRef.current) observer.observe(containerRef.current);
    setTimeout(resizeCanvas, 100);
    document.body.style.overflow = 'hidden';
    return () => { observer.disconnect(); document.body.style.overflow = 'unset'; };
  }, []);

  const getPos = (e: any) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: cx - rect.left, y: cy - rect.top };
  };

  const start = (e: any) => { setIsDrawing(true); const {x,y} = getPos(e); ctxRef.current?.beginPath(); ctxRef.current?.moveTo(x,y); };
  const move = (e: any) => { if(!isDrawing) return; const {x,y} = getPos(e); ctxRef.current?.lineTo(x,y); ctxRef.current?.stroke(); };
  const end = () => { setIsDrawing(false); ctxRef.current?.closePath(); };

  const save = () => {
    if(!canvasRef.current) return;
    const temp = document.createElement('canvas');
    temp.width = canvasRef.current.width;
    temp.height = canvasRef.current.height;
    const tCtx = temp.getContext('2d');
    if(tCtx) {
      tCtx.fillStyle = '#ffffff';
      tCtx.fillRect(0,0,temp.width,temp.height);
      tCtx.drawImage(canvasRef.current,0,0);
      onSave(temp.toDataURL('image/jpeg', 0.5));
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900 z-[80] flex flex-col justify-end sm:justify-center animate-in fade-in">
      {/* 2. 修正簽名板版面，確保按鈕區域可見且可點擊 */}
      <div className="bg-white w-full max-w-lg mx-auto sm:rounded-3xl flex flex-col shadow-2xl h-full sm:h-[600px]">
        <div className="p-4 bg-slate-50 border-b flex justify-between items-center shrink-0">
          <h3 className="font-bold text-lg text-slate-800">請簽名：{title}</h3>
          <button onClick={onClose}><X size={24} className="text-slate-500"/></button>
        </div>
        <div ref={containerRef} className="flex-1 bg-white relative touch-none select-none">
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full"
            onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
            onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
          <div className="absolute bottom-2 left-0 right-0 text-center text-slate-200 pointer-events-none text-4xl font-bold opacity-20">簽署區域</div>
        </div>
        <div className="p-4 border-t bg-slate-50 flex gap-3 safe-area-bottom shrink-0 z-10">
          <button onClick={() => ctxRef.current?.clearRect(0,0,canvasRef.current!.width,canvasRef.current!.height)} className="flex-1 py-3 bg-white border rounded-xl font-bold flex justify-center gap-2 shadow-sm active:bg-gray-100 transition-colors"><Eraser size={20}/> 重寫</button>
          <button onClick={save} className="flex-[2] py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg flex justify-center gap-2 active:bg-blue-700 transition-colors"><CheckCircle2 size={20}/> 確認</button>
        </div>
      </div>
    </div>
  );
}