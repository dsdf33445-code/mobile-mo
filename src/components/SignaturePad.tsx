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

  // 用來保存縮放前的圖像資料，防止 Resize 時清空
  const savedImageData = useRef<ImageData | null>(null);

  useEffect(() => {
    const resizeCanvas = () => {
      if (containerRef.current && canvasRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (ctx) {
           // 1. 在調整大小前保存內容
           if (canvas.width > 0 && canvas.height > 0) {
               try {
                  savedImageData.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
               } catch(e) {
                  // Ignore if canvas is tainted or empty
               }
           }
           
           // 2. 調整大小
           canvas.width = rect.width;
           canvas.height = rect.height;

           // 3. 設定樣式
           ctx.lineWidth = 3;
           ctx.lineCap = 'round';
           ctx.lineJoin = 'round';
           ctx.strokeStyle = '#1e3a8a';
           ctxRef.current = ctx;

           // 4. 還原內容 (如果有)
           if (savedImageData.current) {
               ctx.putImageData(savedImageData.current, 0, 0);
           }
        }
      }
    };
    
    // 初始設定
    resizeCanvas();

    const observer = new ResizeObserver(resizeCanvas);
    if (containerRef.current) observer.observe(containerRef.current);
    
    // 防止滾動
    document.body.style.overflow = 'hidden';
    
    return () => { 
        observer.disconnect(); 
        document.body.style.overflow = 'unset'; 
    };
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
      {/* 修正簽名板版面 */}
      <div className="bg-white w-full max-w-lg mx-auto sm:rounded-3xl flex flex-col shadow-2xl h-full sm:h-[600px]">
        <div className="p-4 bg-slate-50 border-b flex justify-between items-center shrink-0">
          <h3 className="font-bold text-lg text-slate-800">請簽名：{title}</h3>
          <button onClick={onClose}><X size={24} className="text-slate-500"/></button>
        </div>
        <div ref={containerRef} className="flex-1 bg-white relative touch-none select-none overflow-hidden">
          <canvas ref={canvasRef} className="absolute inset-0 block"
            onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
            onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
          <div className="absolute bottom-2 left-0 right-0 text-center text-slate-200 pointer-events-none text-4xl font-bold opacity-20">簽署區域</div>
        </div>
        <div className="p-4 border-t bg-slate-50 flex gap-3 safe-area-bottom shrink-0 z-10">
          <button onClick={() => { ctxRef.current?.clearRect(0,0,canvasRef.current!.width,canvasRef.current!.height); savedImageData.current = null; }} className="flex-1 py-3 bg-white border rounded-xl font-bold flex justify-center gap-2 shadow-sm active:bg-gray-100 transition-colors"><Eraser size={20}/> 重寫</button>
          <button onClick={save} className="flex-[2] py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg flex justify-center gap-2 active:bg-blue-700 transition-colors"><CheckCircle2 size={20}/> 確認</button>
        </div>
      </div>
    </div>
  );
}