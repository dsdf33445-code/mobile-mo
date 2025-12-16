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
        // 修正：移除未使用的 rect 變數
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        // 注意：在旋轉模式下，getBoundingClientRect 會返回旋轉後的邊界
        // 但 canvas 的 width/height 屬性是內部的像素尺寸，我們直接取容器的 clientWidth/Height 比較穩
        const newWidth = containerRef.current.clientWidth;
        const newHeight = containerRef.current.clientHeight;

        if (ctx) {
           // 1. 在調整大小前保存內容
           if (canvas.width > 0 && canvas.height > 0) {
               try {
                  // 只保存有效區域
                  savedImageData.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
               } catch(e) {
                  // Ignore
               }
           }
           
           // 2. 調整大小
           canvas.width = newWidth;
           canvas.height = newHeight;

           // 3. 設定樣式 (線條加粗一點，因為手機橫向可能變大)
           ctx.lineWidth = 4;
           ctx.lineCap = 'round';
           ctx.lineJoin = 'round';
           ctx.strokeStyle = '#000000'; // 改為黑色簽名較清楚
           ctxRef.current = ctx;

           // 4. 還原內容 (如果有)
           if (savedImageData.current) {
               ctx.putImageData(savedImageData.current, 0, 0);
           }
        }
      }
    };
    
    // 初始設定 (延遲一下確保 CSS transform 完成)
    setTimeout(resizeCanvas, 100);

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
    
    // 處理 Touch 事件與 Mouse 事件
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
      // 防止在畫布上滑動時觸發捲動
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
      // 背景設為透明或白色 (這裡設透明適合疊加，但為了預覽清楚設白色)
      // 若要透明簽名，可移除 fillRect
      // tCtx.fillStyle = '#ffffff';
      // tCtx.fillRect(0,0,temp.width,temp.height);
      tCtx.drawImage(canvasRef.current,0,0);
      onSave(temp.toDataURL('image/png')); // 改用 PNG 支援透明
    }
  };

  return (
    // 外層容器：在桌面版顯示遮罩，手機版則全螢幕佔滿
    <div className="fixed inset-0 z-[80] sm:bg-slate-900/80 sm:flex sm:items-center sm:justify-center animate-in fade-in">
      
      {/* 核心變更：
         1. w-[100vh] h-[100vw]: 寬度設為視窗高度，高度設為視窗寬度 (因為要旋轉)
         2. origin-top-left -rotate-90 translate-y-[100vh]: 以左上角為軸心逆時針轉90度，並向下推回視窗範圍
         3. sm:... : 在平板/桌面以上還原為正常彈出視窗
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
                <span className="text-6xl font-bold text-slate-400 transform -rotate-0">簽署區域</span>
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