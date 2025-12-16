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
        // 修正：直接取容器的 clientWidth/Height，移除未使用的 rect 變數
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        // 手機強制橫向時，容器的寬高會互換 (w=100vh, h=100vw)
        // 使用 clientWidth/Height 可以正確取得當前容器的內部像素大小
        const newWidth = containerRef.current.clientWidth;
        const newHeight = containerRef.current.clientHeight;

        if (ctx) {
           // 1. 在調整大小前保存內容
           if (canvas.width > 0 && canvas.height > 0) {
               try {
                  savedImageData.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
               } catch(e) {
                  // Ignore
               }
           }
           
           // 2. 調整大小
           canvas.width = newWidth;
           canvas.height = newHeight;

           // 3. 設定樣式 (線條加粗，因為橫向模式下解析度較高)
           ctx.lineWidth = 4;
           ctx.lineCap = 'round';
           ctx.lineJoin = 'round';
           ctx.strokeStyle = '#000000'; // 黑色簽名
           ctxRef.current = ctx;

           // 4. 還原內容
           if (savedImageData.current) {
               ctx.putImageData(savedImageData.current, 0, 0);
           }
        }
      }
    };
    
    // 延遲執行以確保 CSS transform 動畫完成後再抓取尺寸
    setTimeout(resizeCanvas, 100);

    const observer = new ResizeObserver(resizeCanvas);
    if (containerRef.current) observer.observe(containerRef.current);
    
    // 防止背景滾動
    document.body.style.overflow = 'hidden';
    
    return () => { 
        observer.disconnect(); 
        document.body.style.overflow = 'unset'; 
    };
  }, []);

  // 取得滑鼠/觸控座標
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

  const start = (e: any) => { setIsDrawing(true); const {x,y} = getPos(e); ctxRef.current?.beginPath(); ctxRef.current?.moveTo(x,y); };
  const move = (e: any) => { 
      if(!isDrawing) return; 
      if(e.cancelable) e.preventDefault(); 
      const {x,y} = getPos(e); 
      ctxRef.current?.lineTo(x,y); 
      ctxRef.current?.stroke(); 
  };
  const end = () => { setIsDrawing(false); ctxRef.current?.closePath(); };

  const save = () => {
    if(!canvasRef.current) return;
    const temp = document.createElement('canvas');
    temp.width = canvasRef.current.width;
    temp.height = canvasRef.current.height;
    const tCtx = temp.getContext('2d');
    if(tCtx) {
      tCtx.drawImage(canvasRef.current,0,0);
      onSave(temp.toDataURL('image/png'));
    }
  };

  return (
    // 外層容器：手機版全螢幕，桌面版顯示遮罩
    <div className="fixed inset-0 z-[80] sm:bg-slate-900/80 sm:flex sm:items-center sm:justify-center animate-in fade-in">
      
      {/* 核心樣式說明 (強制橫向)：
         1. w-[100vh] h-[100vw]: 寬度設為螢幕高度，高度設為螢幕寬度。
         2. origin-top-left -rotate-90: 以左上角為軸心逆時針轉 90 度。
         3. translate-y-[100vh]: 旋轉後會跑出螢幕上方，需向下推回一個螢幕高度。
         4. sm:... : 平板/電腦版還原為正常的置中彈出視窗。
      */}
      <div className="
          fixed top-0 left-0 bg-white shadow-2xl flex flex-col
          w-[100vh] h-[100vw] origin-top-left -rotate-90 translate-y-[100vh]
          sm:static sm:w-full sm:max-w-2xl sm:h-[600px] sm:rotate-0 sm:translate-y-0 sm:rounded-3xl
      ">
        {/* 標題列 */}
        <div className="p-4 bg-slate-50 border-b flex justify-between items-center shrink-0">
          <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
             請橫向簽名：<span className="text-blue-600">{title}</span>
          </h3>
          <button onClick={onClose} className="p-2 bg-slate-200 rounded-full hover:bg-slate-300">
             <X size={24} className="text-slate-600"/>
          </button>
        </div>

        {/* 畫布區域 */}
        <div ref={containerRef} className="flex-1 bg-white relative touch-none select-none overflow-hidden cursor-crosshair">
          <canvas ref={canvasRef} className="absolute inset-0 block w-full h-full"
            onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
            onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
          
          {!isDrawing && (
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
                <span className="text-6xl font-bold text-slate-400">簽署區域</span>
             </div>
          )}
        </div>

        {/* 按鈕列 */}
        <div className="p-4 border-t bg-slate-50 flex gap-4 safe-area-bottom shrink-0 z-10">
          <button 
            onClick={() => { 
                ctxRef.current?.clearRect(0,0,canvasRef.current!.width,canvasRef.current!.height); 
                savedImageData.current = null; 
            }} 
            className="flex-1 py-4 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl font-bold flex justify-center items-center gap-2 active:bg-slate-100 transition-colors text-lg"
          >
            <Eraser size={24}/> 清除重寫
          </button>
          <button 
            onClick={save} 
            className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg flex justify-center items-center gap-2 active:bg-blue-700 active:scale-[0.98] transition-all text-lg"
          >
            <CheckCircle2 size={24}/> 確認簽名
          </button>
        </div>
      </div>
    </div>
  );
}