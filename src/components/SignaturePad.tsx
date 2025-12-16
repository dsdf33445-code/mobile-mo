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
      // 在手機橫向模式下，CSS 雖然旋轉了，但我們需要設定 Canvas 的「內部解析度」匹配視覺大小
      // 這裡直接讀取 clientWidth/Height 即可，因為 CSS 已經撐滿了
      const width = container.clientWidth;
      const height = container.clientHeight;

      // 只有當尺寸改變很大時才重設 (避免手機瀏覽器網址列縮放導致重繪清空)
      if (Math.abs(canvas.width - width) > 50 || Math.abs(canvas.height - height) > 50) {
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

    // 稍微延遲以確保 CSS 佈局完成
    const timer = setTimeout(initCanvas, 100);
    
    // 監聽視窗大小改變 (旋轉或縮放)
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
    
    // 建立一個暫存 Canvas 來匯出圖片
    // 這可以確保匯出的圖片背景是正確的，且沒有多餘的空白
    const temp = document.createElement('canvas');
    temp.width = canvasRef.current.width;
    temp.height = canvasRef.current.height;
    const tCtx = temp.getContext('2d');
    
    if(tCtx) {
      // 若需要白色背景請解開下面兩行，目前預設為透明背景 (適合疊加在文件上)
      // tCtx.fillStyle = '#ffffff';
      // tCtx.fillRect(0, 0, temp.width, temp.height);
      
      tCtx.drawImage(canvasRef.current, 0, 0);
      onSave(temp.toDataURL('image/png'));
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-slate-900/90 flex items-center justify-center overflow-hidden">
      {/* 核心修正：
         1. 手機版 (default): 
            - 使用 fixed left-1/2 top-1/2 配合 -translate-x/y-1/2 確保絕對置中。
            - 寬度設為 100vh (螢幕高度)，高度設為 100vw (螢幕寬度)。
            - 旋轉 -90 度。
            - 這樣無論瀏覽器導航列如何變化，它都會死死釘在螢幕中間，按鈕不會跑掉。
         
         2. 平板/桌面版 (sm):
            - 還原旋轉 (rotate-0)。
            - 還原寬高 (w-full max-w-2xl)。
      */}
      <div className="
        fixed left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2
        w-[100vh] h-[100vw] -rotate-90 origin-center
        sm:static sm:translate-x-0 sm:translate-y-0 sm:rotate-0 sm:w-full sm:max-w-2xl sm:h-[600px] sm:rounded-3xl
        bg-white shadow-2xl flex flex-col
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