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

  // 初始化 Canvas
  useEffect(() => {
    const initCanvas = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      // 取得容器目前的顯示尺寸
      const width = container.clientWidth;
      const height = container.clientHeight;

      // 只有當尺寸改變很大時才重設 (避免瀏覽器網址列縮放導致重繪清空)
      if (Math.abs(canvas.width - width) > 10 || Math.abs(canvas.height - height) > 10) {
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = '#000000';
            ctxRef.current = ctx;
          }
      }
    };

    // 延遲偵測以確保 CSS 佈局完成
    const timer = setTimeout(initCanvas, 100);
    
    // 監聽旋轉與調整大小
    window.addEventListener('resize', initCanvas);
    
    // 鎖定背景滾動
    document.body.style.overflow = 'hidden';

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', initCanvas);
      document.body.style.overflow = 'unset';
    };
  }, []);

  const getPos = (e: any) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    return { 
      x: clientX - rect.left, 
      y: clientY - rect.top 
    };
  };

  const start = (e: any) => { 
      setIsDrawing(true); 
      const {x,y} = getPos(e); 
      ctxRef.current?.beginPath(); 
      ctxRef.current?.moveTo(x,y); 
  };

  const move = (e: any) => { 
      if(!isDrawing) return; 
      if(e.cancelable) e.preventDefault(); 
      const {x,y} = getPos(e); 
      ctxRef.current?.lineTo(x,y); 
      ctxRef.current?.stroke(); 
  };

  const end = () => { 
      setIsDrawing(false); 
      ctxRef.current?.closePath(); 
  };

  const save = () => {
    if(!canvasRef.current) return;
    
    const temp = document.createElement('canvas');
    temp.width = canvasRef.current.width;
    temp.height = canvasRef.current.height;
    const tCtx = temp.getContext('2d');
    
    if(tCtx) {
      // 預設透明背景，若需白色背景可自行開啟下兩行
      // tCtx.fillStyle = '#ffffff';
      // tCtx.fillRect(0, 0, temp.width, temp.height);
      tCtx.drawImage(canvasRef.current, 0, 0);
      onSave(temp.toDataURL('image/png'));
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-slate-900/90 flex items-center justify-center overflow-hidden">
      {/* CSS 邏輯說明：
         1. portrait: (手機直拿) -> 強制旋轉 90 度，寬高互換。
         2. landscape: (手機橫拿) -> 不旋轉，正常填滿螢幕，按鈕就不會消失。
         3. sm: (電腦/平板) -> 還原為視窗模式。
      */}
      <div className="
        fixed bg-white shadow-2xl flex flex-col
        
        /* 手機直向 (Portrait): 強制旋轉 */
        portrait:top-1/2 portrait:left-1/2 portrait:-translate-x-1/2 portrait:-translate-y-1/2
        portrait:w-[100vh] portrait:h-[100vw] portrait:-rotate-90 portrait:origin-center
        
        /* 手機橫向 (Landscape): 正常顯示，不旋轉 */
        landscape:inset-0 landscape:w-full landscape:h-full 
        landscape:rotate-0 landscape:translate-0
        
        /* 電腦/平板 (sm): 視窗模式 */
        sm:static sm:translate-x-0 sm:translate-y-0 sm:rotate-0 sm:w-full sm:max-w-2xl sm:h-[600px] sm:rounded-3xl
      ">
        {/* Header */}
        <div className="p-4 bg-slate-50 border-b flex justify-between items-center shrink-0">
          <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
             請橫向簽名：<span className="text-blue-600">{title}</span>
          </h3>
          <button onClick={onClose} className="p-2 bg-slate-200 rounded-full hover:bg-slate-300">
             <X size={24} className="text-slate-600"/>
          </button>
        </div>

        {/* Canvas Area */}
        <div ref={containerRef} className="flex-1 bg-white relative touch-none select-none overflow-hidden cursor-crosshair">
          <canvas 
            ref={canvasRef} 
            className="block w-full h-full"
            onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
            onTouchStart={start} onTouchMove={move} onTouchEnd={end} 
          />
          {!isDrawing && (
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
                <span className="text-6xl font-bold text-slate-400">簽署區域</span>
             </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="p-4 border-t bg-slate-50 flex gap-4 shrink-0 safe-area-bottom">
          <button 
            onClick={() => { 
                const cvs = canvasRef.current;
                if(cvs) ctxRef.current?.clearRect(0, 0, cvs.width, cvs.height); 
            }} 
            className="flex-1 py-4 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl font-bold flex justify-center items-center gap-2 active:bg-slate-100 transition-colors text-lg"
          >
            <Eraser size={24}/> 重寫
          </button>
          <button 
            onClick={save} 
            className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg flex justify-center items-center gap-2 active:bg-blue-700 active:scale-[0.98] transition-all text-lg"
          >
            <CheckCircle2 size={24}/> 確認
          </button>
        </div>
      </div>
    </div>
  );
}