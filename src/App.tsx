import { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  signInWithCustomToken,
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  type User 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { 
  Plus, Edit2, Trash2, X, FileSpreadsheet, 
  ArrowRight, AlertTriangle, CheckCircle2, Search, 
  Database, Upload, 
  PenTool, ChevronDown, ChevronUp, Eraser, 
  Maximize, LogOut, Loader2,
  FileText, ClipboardList, User as UserIcon, RefreshCw,
  LayoutList
} from 'lucide-react';

// ------------------------------------------------------------------
// 1. Firebase 設定與初始化
// ------------------------------------------------------------------
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// 防止重複初始化
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// ------------------------------------------------------------------
// 2. 靜態資料與常數
// ------------------------------------------------------------------
const CONTRACTOR_OPTIONS = ['協茂', '正紳', '勝濱', '中宏'];
const SAFETY_CHECK_ITEMS = [
  "1. 每日施工前應先洽中鋼承辦人並向轄區單位申請安全工作許可證，獲核准後始得開始施工。",
  "2. 進入施工工地應配戴安全帽，並扣好帽帶。穿合格安全皮鞋，嚴禁穿拖鞋。衣服要塞入褲內。",
  "3. 二公尺以上之高處作業，應繫好安全帶與做好防墜落措施。",
  "4. 侷限空間內作業應先通風及測定CO與氧氣濃度，工作人員應攜帶可燃性氣體警報器。",
  "5. 動火作業應配置滅火器及監火員，並作好防止火花飛濺裝置。",
  "6. 不可活電作業。停電作業時應由中鋼人員斷電後，驗電掛卡與上鎖。",
  "7. 近電作業先做好防護措施，並經中鋼公司人員確認後，方允施工。",
  "8. 送電前檢送完工測試報告，由中鋼承辦人員辦理送電申請。",
  "9. 天車上、天車旁及其軌道，高溫區與工場活線區施工，會同中鋼承辦人員協調現場。",
  "10. 廠內開關、儀器、閥類、管線等設備不得碰撞，並禁止擅自操作。",
  "11. 非施工區域，不得擅入。",
  "12. 施工用臨時電、氣體、水等須先申請核准。",
  "13. 電焊機使用前須先自行檢查合格，且合格證於有效期限壹個月內。",
  "14. 工作場所隨時整頓清潔，非吸煙區及工作中禁止吸煙。",
  "15. 禁止女工及未滿二十歲或已逾五十歲之男工從事高架作業。",
  "16. 從事起重機、堆高機、焊接及切除人員，必需經訓練合格及取得證書者。",
  "17. 已充氣或空的氣體鋼瓶應分開存放，並置於陰涼處。",
  "18. 孔洞應設置安全措施(圍欄或護蓋)及安全警告標語，以防止墬落。",
  "19. 未經許可勿將他人設置之危險標誌移走。",
  "20. 從事特殊工作須使用防護具 (請於下方備註填寫)",
];

const SIGNATURE_ROLES = [
  { id: 'csc_manager', label: '中鋼公司 承辦股長' },
  { id: 'csc_staff', label: '中鋼公司 承辦人員' },
  { id: 'contractor_boss', label: '承包商 工地負責人' },
  { id: 'contractor_safety', label: '承包商 安衛管理人員' },
  { id: 'contractor_leader', label: '承包商 帶班者' },
];

// ------------------------------------------------------------------
// 3. 元件：簽名板 (SignaturePad)
// ------------------------------------------------------------------
const SignaturePad = ({ title, onSave, onClose }: { title: string, onSave: (data: string) => void, onClose: () => void }) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useMemo(() => ({ current: null as HTMLCanvasElement | null }), []);
  const containerRef = useMemo(() => ({ current: null as HTMLDivElement | null }), []);
  const ctxRef = useMemo(() => ({ current: null as CanvasRenderingContext2D | null }), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        canvas.width = rect.width;
        canvas.height = rect.height;
        
        const context = canvas.getContext('2d');
        if (context) {
          context.lineWidth = 3;
          context.lineCap = 'round';
          context.lineJoin = 'round';
          context.strokeStyle = '#1e3a8a';
          ctxRef.current = context;
        }
      }
    };

    const resizeObserver = new ResizeObserver(() => resizeCanvas());
    resizeObserver.observe(container);
    setTimeout(resizeCanvas, 100);

    document.body.style.overflow = 'hidden';
    return () => {
      resizeObserver.disconnect();
      document.body.style.overflow = 'unset';
    };
  }, [canvasRef, containerRef, ctxRef]);

  const getPos = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDrawing = (e: any) => {
    setIsDrawing(true);
    const { x, y } = getPos(e);
    ctxRef.current?.beginPath();
    ctxRef.current?.moveTo(x, y);
  };

  const draw = (e: any) => {
    if (!isDrawing || !ctxRef.current) return;
    const { x, y } = getPos(e);
    ctxRef.current.lineTo(x, y);
    ctxRef.current.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    ctxRef.current?.closePath();
  };

  const handleSave = () => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        tempCtx.fillStyle = '#ffffff';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.drawImage(canvas, 0, 0);
        onSave(tempCanvas.toDataURL('image/jpeg', 0.5));
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 z-[70] flex flex-col justify-end sm:justify-center animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg mx-auto rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col shadow-2xl h-[70vh] sm:h-[500px] sm:min-h-[400px]">
        <div className="p-4 bg-slate-50 border-b flex justify-between items-center shrink-0">
          <h3 className="font-bold text-lg text-slate-800">請簽名：{title}</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 text-slate-500"><X size={24} /></button>
        </div>
        <div ref={containerRef as any} className="flex-1 bg-white cursor-crosshair relative w-full touch-none select-none">
          <canvas 
            ref={canvasRef as any} 
            className="absolute inset-0 w-full h-full touch-none"
            onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
            onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing}
          />
          <div className="absolute bottom-2 left-0 right-0 text-center text-slate-200 pointer-events-none text-4xl font-bold opacity-20 select-none">簽署區域</div>
        </div>
        <div className="p-4 border-t bg-slate-50 flex gap-3 safe-area-bottom shrink-0">
          <button onClick={() => ctxRef.current?.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height)} className="flex-1 py-3 px-4 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50 active:scale-95 transition-transform shadow-sm"><Eraser size={20} /> 重寫</button>
          <button onClick={handleSave} className="flex-[2] py-3 px-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-700 active:scale-95 transition-transform flex items-center justify-center gap-2"><CheckCircle2 size={20} /> 完成簽名</button>
        </div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------
// 4. 主應用程式 (App)
// ------------------------------------------------------------------

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'agreement' | 'wo' | 'mo'>('agreement');
  const [isSigningMode, setIsSigningMode] = useState(false);
  
  // Data States
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [currentWOId, setCurrentWOId] = useState<string | null>(null);
  const [draftAgreement, setDraftAgreement] = useState<any>({});
  const [dbLoading, setDbLoading] = useState(false);

  // UI States
  const [dialog, setDialog] = useState<any>({ isOpen: false });
  const [woModal, setWoModal] = useState<any>({ isOpen: false, data: null });
  const [itemModal, setItemModal] = useState<any>({ isOpen: false, data: null });
  const [dbModalOpen, setDbModalOpen] = useState(false);
  const [signingRole, setSigningRole] = useState<any>(null);
  const [isSafetyExpanded, setIsSafetyExpanded] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);

  // Computed
  const currentWorkOrder = useMemo(() => workOrders.find(w => w.id === currentWOId), [workOrders, currentWOId]);
  const currentItems = useMemo(() => items.filter(i => i.workOrderId === currentWOId), [items, currentWOId]);

  // Auth Listener
  useEffect(() => {
    const initAuth = async () => {
      setLoading(true);
      try {
        if (typeof (window as any).__initial_auth_token !== 'undefined' && (window as any).__initial_auth_token) {
          await signInWithCustomToken(auth, (window as any).__initial_auth_token);
        }
      } catch (err) {
        console.error("Auth Init Failed:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Data Sync
  useEffect(() => {
    if (!user) {
      setWorkOrders([]);
      setItems([]);
      return;
    }
    const woQuery = query(collection(db, 'artifacts', 'mobile-mo', 'users', user.uid, 'workOrders'), orderBy('createdAt', 'desc'));
    const unsubWO = onSnapshot(woQuery, (snapshot) => {
      setWorkOrders(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const itemQuery = query(collection(db, 'artifacts', 'mobile-mo', 'users', user.uid, 'items'));
    const unsubItems = onSnapshot(itemQuery, (snapshot) => {
      setItems(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    if (currentWOId) {
       const unsubAgreement = onSnapshot(doc(db, 'artifacts', 'mobile-mo', 'users', user.uid, 'agreements', currentWOId), (docSnap) => {
         if (docSnap.exists()) {
           setDraftAgreement(docSnap.data());
         } else {
           const defaultAgreement = {
              woNo: currentWorkOrder?.no || '',
              woName: currentWorkOrder?.name || '',
              contractor: currentWorkOrder?.applicant || '',
              durationOption: '1',
              safetyChecks: [],
              signatures: {}
           };
           setDraftAgreement(defaultAgreement);
         }
       });
       return () => { unsubWO(); unsubItems(); unsubAgreement(); };
    }
    return () => { unsubWO(); unsubItems(); };
  }, [user, currentWOId, currentWorkOrder]);

  // 自動載入產品資料庫 (CSV)
  const fetchProducts = async () => {
    setDbLoading(true);
    try {
      // ⚠️ 這裡很重要：檔名必須完全匹配
      const response = await fetch('/products.csv');
      if (!response.ok) throw new Error("找不到資料庫檔案");
      const text = await response.text();
      const lines = text.split('\n');
      const newProducts: any[] = [];
      
      const startIndex = lines[0]?.includes('編號') ? 1 : 0;

      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.split(',');
        if (parts.length >= 3) {
          const no = parts[0].trim().replace(/^\uFEFF/, '');
          const name = parts[1].trim();
          const price = parseFloat(parts[2].trim()) || 0;
          if(no && name) {
             newProducts.push({ no, name, price });
          }
        }
      }
      setProducts(newProducts);
      console.log(`已載入 ${newProducts.length} 筆產品資料`);
    } catch (e) {
      console.error("載入產品資料庫失敗:", e);
    } finally {
      setDbLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // --- Actions ---

  const handleLogin = async () => {
    try {
      setLoading(true);
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      let msg = '登入失敗，請重試';
      if (error.code === 'auth/popup-blocked') msg = '登入視窗被瀏覽器封鎖，請允許彈跳視窗';
      showAlert(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => signOut(auth);

  const showAlert = (message: string, type: 'alert' | 'error' | 'success' = 'alert') => {
    setDialog({ isOpen: true, type, message, onConfirm: () => setDialog({ isOpen: false }) });
  };

  const showConfirm = (message: string, onConfirm: () => void) => {
    setDialog({ isOpen: true, type: 'confirm', message, onConfirm });
  };

  const saveAgreement = async (newData: any) => {
    setDraftAgreement(newData);
    if (user && currentWOId) {
      try {
        await setDoc(doc(db, 'artifacts', 'mobile-mo', 'users', user.uid, 'agreements', currentWOId), newData, { merge: true });
      } catch(e) {
        console.error("Save error:", e);
      }
    }
  };

  const handleCreateWOFromAgreement = async () => {
    if (!draftAgreement.woNo || !draftAgreement.woName || !draftAgreement.contractor) {
      showAlert("請填寫工令編號、工程名稱及受委辦廠商。", 'error');
      return;
    }
    if (!user) return;
    const newId = doc(collection(db, 'dummy')).id;
    const woData = {
      no: draftAgreement.woNo,
      name: draftAgreement.woName,
      applicant: draftAgreement.contractor,
      status: '接收工令',
      createdAt: serverTimestamp()
    };
    try {
      await setDoc(doc(db, 'artifacts', 'mobile-mo', 'users', user.uid, 'workOrders', newId), woData);
      await setDoc(doc(db, 'artifacts', 'mobile-mo', 'users', user.uid, 'agreements', newId), draftAgreement);
      setCurrentWOId(newId);
      showAlert('工令建立成功！', 'success');
      setActiveTab('wo');
    } catch (e) {
      showAlert('建立失敗', 'error');
    }
  };

  const handleSaveWO = async () => {
    if (!woModal.data.no || !woModal.data.name) return showAlert('請填寫完整資訊', 'error');
    if (woModal.data.status === 'MO' && (!woModal.data.subNo || woModal.data.subNo.length < 2)) {
      return showAlert('狀態為 MO 時，分工令必須填寫且至少2碼 (例如 01)', 'error');
    }
    try {
      const id = woModal.data.id || doc(collection(db, 'dummy')).id;
      const dataToSave = { ...woModal.data, updatedAt: serverTimestamp(), createdAt: woModal.data.createdAt || serverTimestamp() };
      await setDoc(doc(db, 'artifacts', 'mobile-mo', 'users', user!.uid, 'workOrders', id), dataToSave, { merge: true });
      setWoModal({ isOpen: false, data: null });
      if(!currentWOId) setCurrentWOId(id);
    } catch (e) { showAlert('儲存失敗', 'error'); }
  };

  const handleDeleteWO = (id: string) => {
    showConfirm('刪除後無法復原，包含所有MO明細與協議書，確定嗎？', async () => {
       await deleteDoc(doc(db, 'artifacts', 'mobile-mo', 'users', user!.uid, 'workOrders', id));
       setDialog({ isOpen: false });
       if(currentWOId === id) setCurrentWOId(null);
    });
  };

  const handleSaveItem = async () => {
    if (!itemModal.data.no || !itemModal.data.qty) return showAlert('請填寫完整', 'error');
    try {
       const id = itemModal.data.id || doc(collection(db, 'dummy')).id;
       await setDoc(doc(db, 'artifacts', 'mobile-mo', 'users', user!.uid, 'items', id), {
         ...itemModal.data,
         workOrderId: currentWOId,
         qty: Number(itemModal.data.qty),
         price: Number(itemModal.data.price || 0)
       });
       setItemModal({ isOpen: false, data: null });
    } catch(e) { showAlert('儲存失敗', 'error'); }
  };

  const handleDeleteItem = (id: string) => {
    showConfirm('確定刪除此項目？', async () => {
      await deleteDoc(doc(db, 'artifacts', 'mobile-mo', 'users', user!.uid, 'items', id));
      setDialog({ isOpen: false });
    });
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        const text = evt.target?.result as string;
        if(text) {
            const lines = text.split('\n');
            const newProducts: any[] = [];
            const startIndex = lines[0]?.includes('編號') ? 1 : 0;
            for (let i = startIndex; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                const parts = line.split(',');
                if (parts.length >= 3) {
                    newProducts.push({
                        no: parts[0].trim().replace(/^\uFEFF/, ''),
                        name: parts[1].trim(),
                        price: parseFloat(parts[2].trim()) || 0
                    });
                }
            }
            setProducts(newProducts);
            showAlert(`成功匯入 ${newProducts.length} 筆資料`, 'success');
            setDbModalOpen(false);
        }
    };
    reader.readAsText(file);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-blue-600"><Loader2 className="animate-spin" size={48} /></div>;

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-600 to-blue-800 p-6">
        <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-sm text-center animate-in zoom-in-95 duration-300">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-600"><FileSpreadsheet size={40} /></div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">行動版 MO</h1>
          <p className="text-gray-500 mb-8">中鋼藍風格 • 雲端同步 • 專業工令</p>
          <button onClick={handleLogin} disabled={loading} className={`w-full py-4 bg-gray-900 text-white rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-black transition-transform active:scale-95 shadow-xl shadow-gray-400/50 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}>
            {loading ? <Loader2 className="animate-spin" size={20} /> : <UserIcon size={20} />}
            使用 Google 帳號登入
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-[Microsoft JhengHei] pb-24 safe-area-bottom">
      
      {/* 頂部 Header - 只放 Logo 與登出 */}
      {!isSigningMode && (
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100 safe-area-top">
          <div className="flex justify-between items-center p-4">
             <div className="flex items-center gap-2">
               <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-500/30"><FileSpreadsheet size={18} /></div>
               <h1 className="font-bold text-lg tracking-tight text-slate-800">行動版 MO</h1>
             </div>
             <div className="flex items-center gap-2">
               <span className="text-xs text-gray-500 hidden sm:inline">{user.email || '使用者'}</span>
               <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-500 bg-gray-50 hover:bg-red-50 rounded-full transition-colors"><LogOut size={18} /></button>
             </div>
          </div>
        </header>
      )}

      {/* 全螢幕簽署模式 Header */}
      {isSigningMode && (
        <div className="sticky top-0 z-40 bg-slate-900 text-white p-4 flex justify-between items-center shadow-lg safe-area-top">
           <span className="font-bold flex items-center gap-2"><PenTool size={18}/> 現場簽署模式</span>
           <button onClick={() => setIsSigningMode(false)} className="bg-slate-700 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 hover:bg-slate-600"><Maximize size={14}/> 退出</button>
        </div>
      )}

      <main className={`p-4 max-w-2xl mx-auto w-full transition-all duration-300 ${isSigningMode ? 'bg-white min-h-screen' : 'mb-20'}`}>
        
        {/* Tab 1: 協議書 */}
        {activeTab === 'agreement' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
             {!isSigningMode && !currentWOId && (
               <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded-2xl shadow-lg shadow-blue-500/20 flex items-center justify-between">
                 <div>
                   <h2 className="font-bold text-lg">建立新協議書</h2>
                   <p className="text-blue-100 text-xs mt-1">填寫下方資料後建立工令</p>
                 </div>
                 <div className="bg-white/20 p-2 rounded-xl"><FileText size={24} /></div>
               </div>
             )}
             
             {currentWorkOrder && !isSigningMode && (
               <div className="bg-blue-50 border border-blue-100 p-3 rounded-2xl flex justify-between items-center">
                 <div className="flex items-center gap-2">
                    <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-lg">工作中</span>
                    <span className="font-bold text-blue-900">{currentWorkOrder.no}</span>
                 </div>
                 <div className="flex gap-2">
                   <button onClick={() => {}} className="p-2 text-blue-600 bg-white rounded-full shadow-sm hover:shadow active:scale-95"><Share2 size={18} /></button>
                   <button onClick={() => setIsSigningMode(true)} className="p-2 text-blue-600 bg-white rounded-full shadow-sm hover:shadow active:scale-95"><Maximize size={18} /></button>
                 </div>
               </div>
             )}

             <div className={`bg-white rounded-3xl ${isSigningMode ? '' : 'shadow-sm border border-slate-100'} overflow-hidden`}>
                {!isSigningMode && <div className="bg-slate-50 p-4 border-b border-slate-100 text-center text-slate-500 font-bold text-sm">工程委辦及開工工安協議書</div>}
                
                <div className="p-5 space-y-6">
                   <div className="grid gap-4">
                     <div>
                       <label className="text-xs font-bold text-slate-400 ml-1 mb-1 block">工令編號</label>
                       <input type="text" value={draftAgreement.woNo || ''} readOnly={!!currentWOId} onChange={e => setDraftAgreement({...draftAgreement, woNo: e.target.value.toUpperCase()})} className="w-full bg-slate-50 border-0 rounded-xl p-3 font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 transition-all" placeholder="輸入編號..." />
                     </div>
                     <div>
                       <label className="text-xs font-bold text-slate-400 ml-1 mb-1 block">工程名稱</label>
                       <input type="text" value={draftAgreement.woName || ''} readOnly={!!currentWOId} onChange={e => setDraftAgreement({...draftAgreement, woName: e.target.value})} className="w-full bg-slate-50 border-0 rounded-xl p-3 font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 transition-all" placeholder="輸入名稱..." />
                     </div>
                     <div>
                       <label className="text-xs font-bold text-slate-400 ml-1 mb-1 block">承包廠商</label>
                       <div className="relative">
                          <select value={draftAgreement.contractor || ''} disabled={!!currentWOId} onChange={e => setDraftAgreement({...draftAgreement, contractor: e.target.value})} className="w-full bg-slate-50 border-0 rounded-xl p-3 font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 appearance-none">
                            <option value="" disabled>請選擇...</option>
                            {CONTRACTOR_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                          <ChevronDown className="absolute right-3 top-3.5 text-slate-400 pointer-events-none" size={18} />
                       </div>
                     </div>
                   </div>

                   <hr className="border-slate-100"/>

                   {/* --- 工程期限 --- */}
                   <div>
                      <h4 className="font-bold text-slate-800 mb-3 text-sm">工程期限</h4>
                      <div className="space-y-3">
                        <label className={`flex items-start gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer ${draftAgreement.durationOption === '1' ? 'border-blue-500 bg-blue-50/50' : 'border-transparent bg-slate-50'}`}>
                           <input type="radio" checked={draftAgreement.durationOption === '1'} disabled={!!currentWOId} onChange={() => setDraftAgreement({...draftAgreement, durationOption: '1'})} className="mt-1 w-4 h-4 text-blue-600" />
                           <div className="text-sm text-slate-600 leading-relaxed">
                              本工程施工期限為 
                              <input type="number" 
                                value={draftAgreement.durationDays || ''}
                                readOnly={!!currentWOId}
                                onChange={e => setDraftAgreement({...draftAgreement, durationDays: e.target.value})}
                                onClick={e => e.stopPropagation()}
                                className="w-10 border-b-2 border-slate-300 text-center bg-transparent focus:border-blue-500 outline-none font-bold text-blue-600 mx-1 no-arrow"
                              />
                              工作天，需配合
                              <input type="text" 
                                value={draftAgreement.durationCoop || ''}
                                readOnly={!!currentWOId}
                                onChange={e => setDraftAgreement({...draftAgreement, durationCoop: e.target.value})}
                                onClick={e => e.stopPropagation()}
                                className="w-16 border-b-2 border-slate-300 text-center bg-transparent focus:border-blue-500 outline-none font-bold text-blue-600 mx-1"
                              />
                              施工。
                           </div>
                        </label>
                        <label className={`flex items-start gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer ${draftAgreement.durationOption === '2' ? 'border-blue-500 bg-blue-50/50' : 'border-transparent bg-slate-50'}`}>
                           <input type="radio" checked={draftAgreement.durationOption === '2'} disabled={!!currentWOId} onChange={() => setDraftAgreement({...draftAgreement, durationOption: '2'})} className="mt-1 w-4 h-4 text-blue-600" />
                           <div className="text-sm text-slate-600 leading-relaxed">
                              需配合施工，其施工期限為配合工程完成後於 
                              <input type="number" 
                                value={draftAgreement.durationCalendarDays || ''}
                                readOnly={!!currentWOId}
                                onChange={e => setDraftAgreement({...draftAgreement, durationCalendarDays: e.target.value})}
                                onClick={e => e.stopPropagation()}
                                className="w-10 border-b-2 border-slate-300 text-center bg-transparent focus:border-blue-500 outline-none font-bold text-blue-600 mx-1 no-arrow"
                              />
                              日曆天內完成。
                           </div>
                        </label>
                        <label className={`flex items-start gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer ${draftAgreement.durationOption === '3' ? 'border-blue-500 bg-blue-50/50' : 'border-transparent bg-slate-50'}`}>
                           <input type="radio" checked={draftAgreement.durationOption === '3'} disabled={!!currentWOId} onChange={() => setDraftAgreement({...draftAgreement, durationOption: '3'})} className="mt-1 w-4 h-4 text-blue-600" />
                           <div className="text-sm text-slate-600 leading-relaxed">
                              本工程施工期限於 
                              <input type="date" 
                                value={draftAgreement.durationDate || ''}
                                readOnly={!!currentWOId}
                                onChange={e => setDraftAgreement({...draftAgreement, durationDate: e.target.value})}
                                onClick={e => e.stopPropagation()}
                                className="border rounded px-1 bg-white text-xs ml-1"
                              />
                              完成。
                           </div>
                        </label>
                      </div>
                   </div>

                   <hr className="border-slate-100"/>

                   {/* Safety Checks */}
                   <div className="rounded-2xl border border-slate-100 overflow-hidden">
                      <button onClick={() => setIsSafetyExpanded(!isSafetyExpanded)} className="w-full flex justify-between items-center p-4 bg-slate-50 hover:bg-slate-100 transition-colors">
                        <span className="font-bold text-slate-700 text-sm">施工前安全確認事項 ({draftAgreement.safetyChecks?.length || 0}/20)</span>
                        {isSafetyExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                      {(isSafetyExpanded || isSigningMode) && (
                        <div className="p-2 bg-white max-h-96 overflow-y-auto">
                           {SAFETY_CHECK_ITEMS.map((item, idx) => (
                             <label key={idx} className="flex gap-3 p-3 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors">
                               <input type="checkbox" checked={(draftAgreement.safetyChecks || []).includes(idx)} disabled={!!currentWOId && !isSigningMode} onChange={() => { if(currentWOId && !isSigningMode) return; const checks = draftAgreement.safetyChecks || []; const newChecks = checks.includes(idx) ? checks.filter((i:number) => i !== idx) : [...checks, idx]; saveAgreement({...draftAgreement, safetyChecks: newChecks}); }} className="mt-1 w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                               <span className="text-sm text-slate-600 leading-relaxed">{item}</span>
                             </label>
                           ))}
                        </div>
                      )}
                   </div>

                   {/* Signatures */}
                   <div>
                      <h4 className="font-bold text-slate-800 mb-3 text-sm">簽名確認</h4>
                      <div className="grid gap-3">
                         {SIGNATURE_ROLES.map(role => (
                           <div key={role.id} onClick={() => !draftAgreement.signatures?.[role.id] && setSigningRole(role)} className={`p-3 rounded-xl border-2 border-dashed transition-all cursor-pointer ${draftAgreement.signatures?.[role.id] ? 'border-blue-200 bg-blue-50/30' : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50'}`}>
                              <div className="flex justify-between items-center mb-2">
                                 <span className="text-xs font-bold text-slate-500">{role.label}</span>
                                 {draftAgreement.signatures?.[role.id] && <button onClick={(e) => { e.stopPropagation(); showConfirm('清除重簽？', () => { const s = {...draftAgreement.signatures}; delete s[role.id]; saveAgreement({...draftAgreement, signatures: s}); setDialog({isOpen:false}); }); }} className="text-red-400 hover:text-red-600 p-1"><X size={14}/></button>}
                              </div>
                              {draftAgreement.signatures?.[role.id] ? (
                                <img src={draftAgreement.signatures[role.id].img} alt="簽名" className="h-16 object-contain mix-blend-multiply" />
                              ) : (
                                <div className="h-16 flex items-center justify-center text-slate-300 gap-2"><PenTool size={16}/> 點擊簽名</div>
                              )}
                           </div>
                         ))}
                      </div>
                   </div>

                   {!currentWOId && (
                     <button onClick={handleCreateWOFromAgreement} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 active:scale-95 transition-transform flex items-center justify-center gap-2">
                       <FileSignature size={20} /> 建立工令並存檔
                     </button>
                   )}
                </div>
             </div>
          </div>
        )}

        {/* Tab 2: 工令管理 */}
        {activeTab === 'wo' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
             <div className="flex justify-between items-center">
                <h2 className="font-bold text-xl text-slate-800">工令總表</h2>
                <button onClick={() => { setCurrentWOId(null); setActiveTab('agreement'); }} className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors flex items-center gap-1"><Plus size={16}/> 新增</button>
             </div>
             {workOrders.length === 0 ? (
               <div className="text-center py-20 text-slate-400"><ClipboardList size={48} className="mx-auto mb-4 opacity-20" /><p>尚無工令資料</p></div>
             ) : (
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {workOrders.map(wo => (
                    <div key={wo.id} onClick={() => { setCurrentWOId(wo.id); setActiveTab('mo'); }} className={`bg-white p-4 rounded-2xl border transition-all active:scale-[0.98] cursor-pointer relative overflow-hidden ${currentWOId === wo.id ? 'border-blue-500 shadow-md ring-1 ring-blue-500' : 'border-slate-100 shadow-sm hover:shadow-md'}`}>
                       <div className="flex justify-between items-start mb-2">
                          <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${wo.status === 'MO' ? 'bg-purple-100 text-purple-600' : wo.status === '已結案' ? 'bg-slate-100 text-slate-500' : 'bg-blue-100 text-blue-600'}`}>{wo.status}</span>
                          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                             <button onClick={() => { setWoModal({ isOpen: true, data: wo }); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full"><Edit2 size={16}/></button>
                             <button onClick={() => handleDeleteWO(wo.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full"><Trash2 size={16}/></button>
                          </div>
                       </div>
                       <h3 className="font-bold text-slate-800 text-lg">{wo.no}{wo.subNo ? `-${wo.subNo}` : ''}</h3>
                       <p className="text-sm text-slate-500 truncate">{wo.name}</p>
                       <div className="mt-3 flex items-center justify-between">
                          <span className="text-xs text-slate-400">{wo.applicant}</span>
                          <span className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1">查看 <ArrowRight size={10}/></span>
                       </div>
                    </div>
                  ))}
               </div>
             )}
          </div>
        )}

        {/* Tab 3: MO 明細 */}
        {activeTab === 'mo' && (
           <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500 pb-20">
              <div className="bg-slate-900 text-white p-5 rounded-3xl shadow-xl shadow-slate-900/20 relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                 <h2 className="font-bold text-lg relative z-10">{currentWorkOrder?.name}</h2>
                 <p className="text-slate-400 font-mono text-sm mb-4 relative z-10">{currentWorkOrder?.no}{currentWorkOrder?.subNo ? `-${currentWorkOrder.subNo}` : ''}</p>
                 <div className="flex gap-4 relative z-10">
                    <div><p className="text-[10px] text-slate-400 uppercase tracking-wider">Total Items</p><p className="text-2xl font-bold">{currentItems.length}</p></div>
                    <div><p className="text-[10px] text-slate-400 uppercase tracking-wider">Est. Amount</p><p className="text-2xl font-bold text-blue-400">${currentItems.reduce((a, b) => a + (b.qty * b.price), 0).toLocaleString()}</p></div>
                 </div>
              </div>
              <div className="flex gap-2 overflow-x-auto py-1">
                 <button onClick={() => setDbModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 shadow-sm hover:bg-slate-50 whitespace-nowrap"><Database size={16}/> 產品庫</button>
                 <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 shadow-sm hover:bg-slate-50 whitespace-nowrap"><FileSpreadsheet size={16}/> 匯出 Excel</button>
              </div>
              <div className="space-y-3">
                 {currentItems.map(item => (
                   <div key={item.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                         <div className="flex items-center gap-2 mb-1">
                            <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded font-mono">{item.no}</span>
                            <h3 className="font-bold text-slate-800 text-sm truncate">{item.name}</h3>
                         </div>
                         <div className="flex gap-4 text-xs text-slate-500">
                            <span>單價: ${item.price}</span>
                            <span className="text-blue-600 font-bold">數量: {item.qty}</span>
                         </div>
                      </div>
                      <button onClick={() => handleDeleteItem(item.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"><Trash2 size={18}/></button>
                   </div>
                 ))}
              </div>
              <button onClick={() => { setItemModal({ isOpen: true, data: { no: '', name: '', qty: '', price: 0 } }); setShowSuggestions(false); }} className="fixed bottom-24 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-600/40 flex items-center justify-center hover:bg-blue-700 active:scale-90 transition-all z-30"><Plus size={28} /></button>
           </div>
        )}
      </main>

      {/* --- Bottom Navigation (手機版固定底部) --- */}
      {!isSigningMode && (
        <nav className="fixed bottom-0 w-full bg-white border-t border-gray-200 flex justify-around items-center z-50 safe-area-bottom shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
          <button 
            onClick={() => setActiveTab('agreement')} 
            className={`flex flex-col items-center justify-center flex-1 py-3 gap-1 transition-colors ${activeTab === 'agreement' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <FileText size={24} strokeWidth={activeTab === 'agreement' ? 2.5 : 2} />
            <span className="text-[10px] font-bold">協議書</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('wo')} 
            className={`flex flex-col items-center justify-center flex-1 py-3 gap-1 transition-colors ${activeTab === 'wo' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <LayoutList size={24} strokeWidth={activeTab === 'wo' ? 2.5 : 2} />
            <span className="text-[10px] font-bold">工令管理</span>
          </button>
          
          <button 
            onClick={() => { if(!currentWOId) return showAlert('請先選擇工令', 'error'); setActiveTab('mo'); }} 
            className={`flex flex-col items-center justify-center flex-1 py-3 gap-1 transition-colors ${activeTab === 'mo' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <FileSpreadsheet size={24} strokeWidth={activeTab === 'mo' ? 2.5 : 2} />
            <span className="text-[10px] font-bold">MO 明細</span>
          </button>
        </nav>
      )}

      {/* --- Modals --- */}
      {signingRole && <SignaturePad title={signingRole.label} onSave={(img) => { const newSigs = { ...draftAgreement.signatures, [signingRole.id]: { img, date: new Date().toISOString().split('T')[0] } }; saveAgreement({ ...draftAgreement, signatures: newSigs }); setSigningRole(null); }} onClose={() => setSigningRole(null)} />}
      
      {itemModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10">
              <div className="flex justify-between items-center mb-6"><h3 className="font-bold text-lg text-slate-800">新增 MO 項目</h3><button onClick={() => setItemModal({ isOpen: false, data: null })} className="p-2 bg-slate-100 rounded-full"><X size={20}/></button></div>
              <div className="space-y-4">
                 <div className="relative">
                    <label className="text-xs font-bold text-slate-400 ml-1 mb-1 block">產品編號 / 搜尋</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-3.5 text-slate-400" size={18}/>
                      <input type="text" value={itemModal.data.no} onChange={(e) => { const val = e.target.value.toUpperCase(); setItemModal({ ...itemModal, data: { ...itemModal.data, no: val } }); if (val) { setFilteredProducts(products.filter(p => p.no.includes(val) || p.name.includes(val))); setShowSuggestions(true); } else { setShowSuggestions(false); } }} className="w-full bg-slate-50 border-0 rounded-xl pl-10 p-3 font-mono font-bold text-slate-700 focus:ring-2 focus:ring-blue-500" placeholder="E001..." />
                    </div>
                    {showSuggestions && filteredProducts.length > 0 && (
                       <ul className="absolute z-10 w-full bg-white border border-slate-100 shadow-xl rounded-xl mt-1 max-h-40 overflow-y-auto">
                          {filteredProducts.map(p => (
                             <li key={p.no} onClick={() => { setItemModal({ ...itemModal, data: { ...itemModal.data, no: p.no, name: p.name, price: p.price } }); setShowSuggestions(false); }} className="p-3 hover:bg-blue-50 border-b border-slate-50 last:border-0 cursor-pointer">
                                <span className="font-bold text-blue-600 block text-xs font-mono">{p.no}</span>
                                <span className="text-sm text-slate-600">{p.name}</span>
                             </li>
                          ))}
                       </ul>
                    )}
                 </div>
                 <div><label className="text-xs font-bold text-slate-400 ml-1 mb-1 block">產品名稱</label><input type="text" readOnly value={itemModal.data.name} className="w-full bg-slate-100 border-0 rounded-xl p-3 text-slate-500" /></div>
                 <div className="flex gap-4">
                    <div className="flex-1"><label className="text-xs font-bold text-slate-400 ml-1 mb-1 block">單價</label><input type="number" readOnly value={itemModal.data.price} className="w-full bg-slate-100 border-0 rounded-xl p-3 font-mono text-slate-500" /></div>
                    <div className="flex-1"><label className="text-xs font-bold text-slate-400 ml-1 mb-1 block">數量</label><input type="number" value={itemModal.data.qty} onChange={e => setItemModal({...itemModal, data: {...itemModal.data, qty: e.target.value}})} className="w-full bg-slate-50 border-0 rounded-xl p-3 font-mono font-bold text-blue-600 focus:ring-2 focus:ring-blue-500" autoFocus /></div>
                 </div>
                 <button onClick={handleSaveItem} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 mt-2 active:scale-95 transition-transform">確認儲存</button>
              </div>
           </div>
        </div>
      )}

      {woModal.isOpen && (
         <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in-95">
               <h3 className="font-bold text-lg mb-4 text-slate-800">編輯工令狀態</h3>
               <div className="space-y-3">
                  <input type="text" value={woModal.data.no} readOnly className="w-full bg-slate-100 p-3 rounded-xl text-slate-500 font-bold" />
                  <select value={woModal.data.status} onChange={(e) => setWoModal({...woModal, data: {...woModal.data, status: e.target.value}})} className="w-full bg-slate-50 border-0 p-3 rounded-xl font-bold text-slate-700 focus:ring-2 focus:ring-blue-500">
                     <option>接收工令</option><option>MO</option><option>已完工</option><option>已結案</option>
                  </select>
                  {woModal.data.status === 'MO' && (
                     <div><label className="text-xs font-bold text-blue-500 ml-1 mb-1 block">分工令號碼 (2碼英文數字)</label><input type="text" maxLength={2} placeholder="01" value={woModal.data.subNo || ''} onChange={(e) => setWoModal({...woModal, data: {...woModal.data, subNo: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')}})} className="w-full bg-white border-2 border-blue-200 p-3 rounded-xl font-mono font-bold text-blue-600 focus:border-blue-500 focus:ring-0 uppercase text-center text-xl tracking-widest" /></div>
                  )}
                  <div className="flex gap-2 mt-4">
                     <button onClick={() => setWoModal({isOpen: false, data: null})} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold">取消</button>
                     <button onClick={handleSaveWO} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20">儲存</button>
                  </div>
               </div>
            </div>
         </div>
      )}

      {dbModalOpen && (
         <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-sm rounded-3xl p-6 text-center shadow-2xl animate-in zoom-in-95">
               <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600"><Database size={32}/></div>
               <h3 className="font-bold text-xl mb-2 text-slate-800">產品資料庫</h3>
               <p className="text-slate-400 text-sm mb-6">目前共有 {products.length} 筆資料</p>
               
               {/* 提示訊息 */}
               <div className="text-left bg-blue-50 p-4 rounded-xl mb-4 border border-blue-100">
                  <p className="text-xs text-blue-800 font-bold mb-1">💡 如何更新資料庫？</p>
                  <p className="text-xs text-blue-600 leading-relaxed">請將您的 Excel 轉存為 <code>products.csv</code>，並放入 GitHub 專案的 <code>public</code> 資料夾中，App 將自動載入。</p>
               </div>

               <div className="flex gap-2">
                  <button onClick={fetchProducts} disabled={dbLoading} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 hover:bg-blue-700 active:scale-95 transition-transform">
                     {dbLoading ? <Loader2 className="animate-spin" size={20}/> : <RefreshCw size={20}/>} 重新載入
                  </button>
                  <button onClick={() => setDbModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 rounded-xl">關閉</button>
               </div>
            </div>
         </div>
      )}

      {dialog.isOpen && (
         <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-xs rounded-3xl p-6 text-center shadow-2xl animate-in zoom-in-95">
               <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${dialog.type === 'error' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>{dialog.type === 'error' ? <AlertTriangle size={28}/> : <CheckCircle2 size={28}/>}</div>
               <p className="font-bold text-slate-700 mb-6 leading-relaxed">{dialog.message}</p>
               <div className="flex gap-2">
                  {dialog.type === 'confirm' && <button onClick={() => setDialog({isOpen: false})} className="flex-1 py-2.5 border border-slate-200 text-slate-500 rounded-xl font-bold">取消</button>}
                  <button onClick={() => dialog.onConfirm ? dialog.onConfirm() : setDialog({isOpen: false})} className={`flex-1 py-2.5 text-white rounded-xl font-bold shadow-lg ${dialog.type === 'error' ? 'bg-red-500 shadow-red-500/30' : 'bg-blue-600 shadow-blue-500/30'}`}>確認</button>
               </div>
            </div>
         </div>
      )}

      <style>{`
        .no-arrow::-webkit-outer-spin-button, .no-arrow::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; } .no-arrow { -moz-appearance: textfield; }
        .hide-scrollbar::-webkit-scrollbar { display: none; } .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @supports (padding-bottom: env(safe-area-inset-bottom)) { .safe-area-bottom { padding-bottom: calc(env(safe-area-inset-bottom) + 1rem); } }
        @supports (padding-top: env(safe-area-inset-top)) { .safe-area-top { padding-top: calc(env(safe-area-inset-top) + 0.5rem); } }
      `}</style>
    </div>
  );
}