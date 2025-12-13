import { useState, useEffect, useMemo } from 'react';
import { signInWithPopup, signOut, onAuthStateChanged, type User } from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp, 
  orderBy, 
  onSnapshot, 
  type QuerySnapshot, 
  type DocumentSnapshot 
} from 'firebase/firestore';
// 修正：移除未使用的 Maximize, Link
import { 
  FileSpreadsheet, X, AlertTriangle, CheckCircle2, PenTool, LogOut, Loader2, User as UserIcon, 
  GitMerge, CheckSquare, Square 
} from 'lucide-react';

import { auth, db, provider } from './firebase';
import SignaturePad from './components/SignaturePad';
import AgreementView from './components/AgreementView';
import WorkOrderListView from './components/WorkOrderListView';
import MoDetailView from './components/MoDetailView';
import BottomNavigation from './components/BottomNavigation';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'agreement' | 'wo' | 'mo'>('agreement');
  const [isSigningMode, setIsSigningMode] = useState(false);
  
  // Data
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [currentWOId, setCurrentWOId] = useState<string | null>(null);
  const [draftAgreement, setDraftAgreement] = useState<any>({});
  const [dbLoading, setDbLoading] = useState(false);
  const [sharedOwnerId, setSharedOwnerId] = useState<string | null>(null);

  // UI
  const [dialog, setDialog] = useState<any>({ isOpen: false });
  const [woModal, setWoModal] = useState<any>({ isOpen: false, data: null });
  const [itemModal, setItemModal] = useState<any>({ isOpen: false, data: null });
  const [mergeModal, setMergeModal] = useState<any>({ isOpen: false, selectedIds: [] });
  const [signingRole, setSigningRole] = useState<any>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);

  // Computed
  const currentWorkOrder = useMemo(() => workOrders.find(w => w.id === currentWOId), [workOrders, currentWOId]);
  const currentItems = useMemo(() => items.filter(i => i.workOrderId === currentWOId), [items, currentWOId]);

  // --- Effects ---
  useEffect(() => {
    const initAuth = async () => { setLoading(true); };
    initAuth();
    const unsub = onAuthStateChanged(auth, u => { setUser(u); setLoading(false); });
    
    const params = new URLSearchParams(window.location.search);
    const shareId = params.get('shareId');
    const ownerId = params.get('ownerId');
    if (shareId && ownerId) {
      setSharedOwnerId(ownerId);
      setCurrentWOId(shareId);
      setActiveTab('agreement');
      setDialog({isOpen:true, type:'alert', message:'您正在檢視他人分享的協議書'});
    }
    return () => unsub();
  }, []);

  const fetchProducts = async () => {
    setDbLoading(true);
    try {
      const res = await fetch(`/products.csv?t=${Date.now()}`);
      if(!res.ok) throw new Error();
      const buf = await res.arrayBuffer();
      let text = '';
      try { text = new TextDecoder('utf-8').decode(buf); } catch(e) {}
      if(!text.includes('編號') && !text.includes('名稱')) {
        try { text = new TextDecoder('big5').decode(buf); } catch(e) {}
      }
      const lines = text.split(/\r\n|\n/);
      const newProds = [];
      const start = (lines[0]?.includes('編號') || lines[0]?.includes('no')) ? 1 : 0;
      for(let i=start; i<lines.length; i++) {
        const l = lines[i].trim();
        if(!l) continue;
        const p = l.split(',');
        if(p.length >= 3) {
          const no = p[0].trim().replace(/^\uFEFF/, '');
          const name = p.slice(1, p.length-1).join(',').trim().replace(/^"|"$/g, '');
          const price = parseFloat(p[p.length-1].trim().replace(/["\s,]/g, '')) || 0;
          if(no && name) newProds.push({no, name, price});
        }
      }
      setProducts(newProds);
    } catch(e) { console.error(e); } finally { setDbLoading(false); }
  };
  useEffect(() => { fetchProducts(); }, []);

  useEffect(() => {
    if (!user && !sharedOwnerId) return;
    const uid = sharedOwnerId || user?.uid;
    if (!uid) return;

    if (sharedOwnerId && currentWOId) {
       getDoc(doc(db, 'artifacts', 'mobile-mo', 'users', uid, 'workOrders', currentWOId)).then(s => s.exists() && setWorkOrders([{id:s.id, ...s.data()}]));
       return onSnapshot(doc(db, 'artifacts', 'mobile-mo', 'users', uid, 'agreements', currentWOId), (s: DocumentSnapshot) => s.exists() && setDraftAgreement(s.data()));
    }

    const unsubWO = onSnapshot(query(collection(db, 'artifacts', 'mobile-mo', 'users', uid, 'workOrders'), orderBy('createdAt', 'desc')), (s: QuerySnapshot) => setWorkOrders(s.docs.map(d => ({id:d.id, ...d.data()}))));
    const unsubItems = onSnapshot(query(collection(db, 'artifacts', 'mobile-mo', 'users', uid, 'items')), (s: QuerySnapshot) => setItems(s.docs.map(d => ({id:d.id, ...d.data()}))));
    
    let unsubAgree = () => {};
    if (currentWOId) {
       unsubAgree = onSnapshot(doc(db, 'artifacts', 'mobile-mo', 'users', uid, 'agreements', currentWOId), (s: DocumentSnapshot) => {
         if(s.exists()) setDraftAgreement(s.data());
         else if (!sharedOwnerId) {
           // 3. 點擊新增工令時，要顯示空白協議書
           setDraftAgreement({ woNo: '', woName: '', contractor: '', durationOption: '1', safetyChecks: [], signatures: {} });
         }
       });
    } else {
        if(!sharedOwnerId) setDraftAgreement({ woNo: '', woName: '', contractor: '', durationOption: '1', safetyChecks: [], signatures: {} });
    }
    return () => { unsubWO(); unsubItems(); unsubAgree(); };
  }, [user, currentWOId, sharedOwnerId, currentWorkOrder]);

  // --- Handlers ---
  const handleLogin = async () => { try { setLoading(true); await signInWithPopup(auth, provider); } catch(e) { setDialog({isOpen:true, type:'error', message:'登入失敗'}); setLoading(false); } };
  const handleLogout = () => signOut(auth);
  
  const handleUpdateAgreement = (field: string, value: any) => {
    // 工令編號限制：8碼、大寫、英數字
    if (field === 'woNo') value = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    
    const newState = { ...draftAgreement, [field]: value };
    setDraftAgreement(newState);
    if(user && currentWOId && !sharedOwnerId) setDoc(doc(db, 'artifacts', 'mobile-mo', 'users', user.uid, 'agreements', currentWOId), newState, {merge:true});
  };

  const handleToggleSafety = (idx: number) => {
    if(currentWOId && !isSigningMode) return;
    const checks = draftAgreement.safetyChecks || [];
    const newChecks = checks.includes(idx) ? checks.filter((i:number)=>i!==idx) : [...checks, idx];
    handleUpdateAgreement('safetyChecks', newChecks);
  };

  const handleSignatureSave = (img: string) => {
    const uid = sharedOwnerId || user?.uid;
    if(!uid || !currentWOId || !signingRole) return;
    const today = new Date().toISOString().split('T')[0];
    const newSigs = { ...draftAgreement.signatures, [signingRole.id]: { img, date: today } };
    setDoc(doc(db, 'artifacts', 'mobile-mo', 'users', uid, 'agreements', currentWOId), { ...draftAgreement, signatures: newSigs }, {merge:true});
    setSigningRole(null);
  };

  const handleSignatureDateChange = (roleId: string, date: string) => {
    const uid = sharedOwnerId || user?.uid;
    if(!uid || !currentWOId) return;
    const newSigs = { ...draftAgreement.signatures, [roleId]: { ...draftAgreement.signatures[roleId], date } };
    setDoc(doc(db, 'artifacts', 'mobile-mo', 'users', uid, 'agreements', currentWOId), { signatures: newSigs }, {merge:true});
    setSigningRole(null);
  };

  const handleShare = async () => {
    if (!currentWOId || !user) return;
    const url = `${window.location.origin}?shareId=${currentWOId}&ownerId=${user.uid}`;
    const text = `【開工協議書連結】\n工令：${draftAgreement.woNo}\n請點擊連結進行簽署：\n${url}`;
    if (navigator.share) navigator.share({ title: '簽署通知', text, url }).catch(()=>{});
    else { navigator.clipboard.writeText(text); setDialog({isOpen:true, type:'alert', message:'已複製連結'}); }
  };

  const handleCreateWO = async () => {
    if(!draftAgreement.woNo || !draftAgreement.woName || !draftAgreement.contractor) return setDialog({isOpen:true, type:'error', message:'請填寫完整'});
    if(!user) return;
    const id = doc(collection(db, 'dummy')).id;
    const woData = { no: draftAgreement.woNo, name: draftAgreement.woName, applicant: draftAgreement.contractor, status: '接收工令', createdAt: serverTimestamp() };
    await setDoc(doc(db, 'artifacts', 'mobile-mo', 'users', user.uid, 'workOrders', id), woData);
    await setDoc(doc(db, 'artifacts', 'mobile-mo', 'users', user.uid, 'agreements', id), draftAgreement);
    setCurrentWOId(id); setActiveTab('wo'); setDialog({isOpen:true, type:'alert', message:'建立成功'});
  };

  const handleSaveWO = async () => {
    if(!woModal.data.no || !woModal.data.name) return;
    if(woModal.data.status==='MO' && (!woModal.data.subNo || woModal.data.subNo.length<2)) return setDialog({isOpen:true, type:'error', message:'MO 狀態需填寫分工令'});
    const id = woModal.data.id;
    await setDoc(doc(db, 'artifacts', 'mobile-mo', 'users', user!.uid, 'workOrders', id), { ...woModal.data, updatedAt: serverTimestamp() }, {merge:true});
    // 同步更新協議書的工令編號與名稱
    await setDoc(doc(db, 'artifacts', 'mobile-mo', 'users', user!.uid, 'agreements', id), { woNo: woModal.data.no, woName: woModal.data.name }, {merge: true});
    setWoModal({isOpen:false, data:null});
    if(!currentWOId) setCurrentWOId(id);
  };

  const handleSaveItem = async () => {
    if(!itemModal.data.no || !itemModal.data.qty) return;
    const id = itemModal.data.id || doc(collection(db, 'dummy')).id;
    await setDoc(doc(db, 'artifacts', 'mobile-mo', 'users', user!.uid, 'items', id), { ...itemModal.data, workOrderId: currentWOId, qty: Number(itemModal.data.qty), price: Number(itemModal.data.price||0) });
    setItemModal({isOpen:false, data:null});
  };

  const handleMergeWorkOrders = async () => {
    if (mergeModal.selectedIds.length === 0) return;
    setLoading(true);
    try {
      const sourceWos = workOrders.filter(w => mergeModal.selectedIds.includes(w.id));
      const q = query(collection(db, 'artifacts', 'mobile-mo', 'users', user!.uid, 'items'), where('workOrderId', 'in', mergeModal.selectedIds));
      const querySnapshot = await getDocs(q);
      const sourceItems = querySnapshot.docs.map(d => d.data());

      for (const srcItem of sourceItems) {
        const existingItem = currentItems.find(i => i.no === srcItem.no);
        const srcWo = sourceWos.find(w => w.id === srcItem.workOrderId);
        if (existingItem) {
          const newQty = Number(existingItem.qty) + Number(srcItem.qty);
          const remark = existingItem.remark ? `${existingItem.remark}, ${srcWo?.no}` : `合併自: ${srcWo?.no}`;
          await setDoc(doc(db, 'artifacts', 'mobile-mo', 'users', user!.uid, 'items', existingItem.id), { qty: newQty, remark: remark }, { merge: true });
        } else {
          const newId = doc(collection(db, 'dummy')).id;
          await setDoc(doc(db, 'artifacts', 'mobile-mo', 'users', user!.uid, 'items', newId), { ...srcItem, workOrderId: currentWOId, remark: `合併自: ${srcWo?.no}` });
        }
      }
      setDialog({isOpen:true, type:'success', message:`成功合併 ${sourceItems.length} 個項目`});
      setMergeModal({ isOpen: false, selectedIds: [] });
    } catch (e) {
      console.error(e);
      setDialog({isOpen:true, type:'error', message:'合併失敗'});
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (col: string, id: string) => {
    setDialog({isOpen:true, type:'confirm', message:'確定刪除？', onConfirm: async () => {
      await deleteDoc(doc(db, 'artifacts', 'mobile-mo', 'users', user!.uid, col, id));
      setDialog({isOpen:false});
      if(col==='workOrders' && currentWOId===id) setCurrentWOId(null);
    }});
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-blue-600"><Loader2 className="animate-spin" size={48}/></div>;
  if (!user && !sharedOwnerId) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-blue-600 p-6">
      <div className="bg-white p-8 rounded-3xl w-full max-w-sm text-center shadow-2xl">
        <FileSpreadsheet size={40} className="mx-auto mb-6 text-blue-600"/>
        <h1 className="text-2xl font-bold mb-2">行動版 MO</h1>
        <button onClick={handleLogin} className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold mt-6 flex justify-center gap-2"><UserIcon/> Google 登入</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-[Microsoft JhengHei] pb-24 safe-area-bottom">
      {!isSigningMode && (
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b p-4 flex justify-between safe-area-top">
          <div className="flex items-center gap-2 font-bold text-lg text-slate-800"><FileSpreadsheet size={18}/> 行動版 MO</div>
          <div className="flex items-center gap-2">
            {sharedOwnerId && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">訪客</span>}
            {user && <button onClick={handleLogout}><LogOut size={18} className="text-slate-400"/></button>}
          </div>
        </header>
      )}

      {isSigningMode && (
        <div className="sticky top-0 z-40 bg-slate-900 text-white p-4 flex justify-between safe-area-top shadow-lg">
           <span className="font-bold flex gap-2"><PenTool size={18}/> 現場簽署</span>
           <button onClick={() => setIsSigningMode(false)} className="bg-slate-700 px-3 py-1 rounded text-xs">退出</button>
        </div>
      )}

      <main className={`p-4 max-w-2xl mx-auto ${isSigningMode ? 'bg-white min-h-screen' : 'mb-20'}`}>
        {activeTab === 'agreement' && (
          <AgreementView 
            data={draftAgreement} currentWOId={currentWOId} isSigningMode={isSigningMode} isShared={!!sharedOwnerId}
            onChange={handleUpdateAgreement} onToggleSafety={handleToggleSafety}
            onSigning={setSigningRole} onClearSignature={(rid:string) => handleUpdateAgreement('signatures', {...draftAgreement.signatures, [rid]: null})}
            onDateChange={handleSignatureDateChange} onCreate={handleCreateWO} onShare={handleShare} onExitSigning={setIsSigningMode}
          />
        )}
        {activeTab === 'wo' && (
          <WorkOrderListView 
            workOrders={workOrders} 
            onSelect={(wo:any) => { setCurrentWOId(wo.id); setActiveTab('mo'); }}
            onEdit={(wo:any) => { setWoModal({isOpen:true, data:wo}); }}
            onDelete={(id:string) => handleDelete('workOrders', id)}
            onAdd={() => { 
                setCurrentWOId(null); 
                // 3. 確保點擊新增工令時，草稿被清空
                setDraftAgreement({ woNo: '', woName: '', contractor: '', durationOption: '1', safetyChecks: [], signatures: {} }); 
                setActiveTab('agreement'); 
            }}
            onCheckAgreement={(id:string) => { setCurrentWOId(id); setActiveTab('agreement'); }}
          />
        )}
        {activeTab === 'mo' && (
          <MoDetailView 
            currentWorkOrder={currentWorkOrder} items={currentItems} dbLoading={dbLoading} productCount={products.length}
            onDeleteItem={(id:string) => handleDelete('items', id)}
            onAddClick={() => { setItemModal({isOpen:true, data:{no:'', name:'', qty:'', price:0}}); setShowSuggestions(false); }}
            onReloadDb={fetchProducts}
            onMergeClick={() => setMergeModal({ isOpen: true, selectedIds: [] })}
            // 修正：不傳遞 unused prop
          />
        )}
      </main>

      {!isSigningMode && <BottomNavigation activeTab={activeTab} setActiveTab={setActiveTab} onMoClick={() => { if(!currentWOId) return setDialog({isOpen:true, type:'alert', message:'請先選擇工令'}); setActiveTab('mo'); }} />}

      {signingRole && <SignaturePad title={signingRole.label} onSave={handleSignatureSave} onClose={() => setSigningRole(null)} />}
      
      {/* 3. 編輯工令 Modal (更新) */}
      {woModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-xl animate-in zoom-in-95">
              <h3 className="font-bold text-lg mb-4">編輯工令</h3>
              <div className="space-y-4">
                 <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">工令編號</label>
                    {/* 1. 編輯工令：編號限制8碼、自動大寫 */}
                    <input type="text" maxLength={8} value={woModal.data.no} onChange={e => setWoModal({...woModal, data:{...woModal.data, no:e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')}})} className="w-full bg-slate-50 border p-3 rounded-xl font-bold font-mono" />
                 </div>
                 <div><label className="text-xs font-bold text-gray-500 block mb-1">工程名稱</label><input type="text" value={woModal.data.name} onChange={e => setWoModal({...woModal, data:{...woModal.data, name:e.target.value}})} className="w-full bg-slate-50 border p-3 rounded-xl font-bold" /></div>
                 <div><label className="text-xs font-bold text-gray-500 block mb-1">狀態</label><select value={woModal.data.status} onChange={e => setWoModal({...woModal, data:{...woModal.data, status:e.target.value}})} className="w-full border p-3 rounded-xl"><option>接收工令</option><option>MO</option><option>已完工</option><option>已結案</option></select></div>
                 {woModal.data.status==='MO' && <div><label className="text-xs text-blue-500 font-bold block mb-1">分工令 (必填)</label><input type="text" maxLength={2} value={woModal.data.subNo||''} onChange={e => setWoModal({...woModal, data:{...woModal.data, subNo:e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'')}})} className="w-full border-2 border-blue-200 p-3 rounded-xl font-mono font-bold text-center text-xl" /></div>}
                 <div className="flex gap-2 pt-2"><button onClick={() => setWoModal({isOpen:false})} className="flex-1 py-3 text-slate-500 font-bold bg-slate-100 rounded-xl">取消</button><button onClick={handleSaveWO} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg">儲存</button></div>
              </div>
           </div>
        </div>
      )}

      {mergeModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-sm rounded-3xl flex flex-col shadow-xl animate-in zoom-in-95 max-h-[80vh]">
              <div className="p-4 border-b flex justify-between items-center"><h3 className="font-bold text-lg flex gap-2"><GitMerge/> 合併工令</h3><button onClick={() => setMergeModal({isOpen:false})}><X/></button></div>
              <div className="p-4 overflow-y-auto flex-1 space-y-2">
                 <p className="text-xs text-gray-500 mb-2">請選擇要合併進來的工令 (可多選)：</p>
                 {workOrders.filter(w => w.id !== currentWOId).map(wo => (
                   <div key={wo.id} onClick={() => {
                      const exists = mergeModal.selectedIds.includes(wo.id);
                      setMergeModal({ ...mergeModal, selectedIds: exists ? mergeModal.selectedIds.filter((id:string) => id !== wo.id) : [...mergeModal.selectedIds, wo.id] });
                   }} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${mergeModal.selectedIds.includes(wo.id) ? 'bg-blue-50 border-blue-300' : 'bg-white hover:bg-slate-50'}`}>
                      <div className={`text-blue-600 ${mergeModal.selectedIds.includes(wo.id) ? 'opacity-100' : 'opacity-30'}`}>{mergeModal.selectedIds.includes(wo.id) ? <CheckSquare size={20}/> : <Square size={20}/>}</div>
                      <div className="flex-1 min-w-0"><span className="font-bold block text-slate-800 text-sm">{wo.no}</span><span className="text-xs text-slate-500 truncate block">{wo.name}</span></div>
                   </div>
                 ))}
                 {workOrders.length <= 1 && <div className="text-center text-gray-400 py-4">沒有其他工令可供合併</div>}
              </div>
              <div className="p-4 border-t flex gap-2">
                 <button onClick={() => setMergeModal({isOpen:false})} className="flex-1 py-3 text-slate-500 font-bold bg-slate-100 rounded-xl">取消</button>
                 <button onClick={handleMergeWorkOrders} disabled={mergeModal.selectedIds.length === 0} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:shadow-none">確認合併</button>
              </div>
           </div>
        </div>
      )}

      {/* 1. Item Modal: 新增標籤 (Label) */}
      {itemModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
           <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-xl animate-in slide-in-from-bottom-10">
              <div className="flex justify-between mb-4"><h3 className="font-bold">新增項目</h3><button onClick={() => setItemModal({isOpen:false})}><X size={20}/></button></div>
              <div className="space-y-4">
                 <div className="relative">
                    <label className="text-xs font-bold text-gray-500 block mb-1">項目編號</label>
                    <input type="text" value={itemModal.data.no} onChange={e => { const v=e.target.value.toUpperCase(); setItemModal({...itemModal, data:{...itemModal.data, no:v}}); if(v) { setFilteredProducts(products.filter(p=>p.no.includes(v)||p.name.includes(v))); setShowSuggestions(true); } else setShowSuggestions(false); }} className="w-full border p-3 rounded-xl font-mono" placeholder="搜尋編號..." />
                    {showSuggestions && <ul className="absolute z-10 w-full bg-white border shadow-xl max-h-40 overflow-y-auto">{filteredProducts.map(p=><li key={p.no} onClick={() => { setItemModal({...itemModal, data:{...itemModal.data, no:p.no, name:p.name, price:p.price}}); setShowSuggestions(false); }} className="p-3 hover:bg-blue-50 border-b cursor-pointer"><span className="font-bold text-blue-600 font-mono block">{p.no}</span><span className="text-xs">{p.name}</span></li>)}</ul>}
                 </div>
                 
                 <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">項目名稱</label>
                    <input type="text" readOnly value={itemModal.data.name} className="w-full bg-slate-100 p-3 rounded-xl" />
                 </div>
                 
                 <div className="flex gap-3">
                    <div className="flex-1">
                        <label className="text-xs font-bold text-gray-500 block mb-1">單價</label>
                        <input type="number" readOnly value={itemModal.data.price} className="w-full bg-slate-100 p-3 rounded-xl text-center" />
                    </div>
                    <div className="flex-1">
                        <label className="text-xs font-bold text-gray-500 block mb-1">數量</label>
                        <input type="number" value={itemModal.data.qty} onChange={e => setItemModal({...itemModal, data:{...itemModal.data, qty:e.target.value}})} className="w-full border p-3 rounded-xl text-center font-bold text-blue-600" autoFocus />
                    </div>
                 </div>
                 <button onClick={handleSaveItem} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold mt-2 shadow-lg">儲存</button>
              </div>
           </div>
        </div>
      )}

      {dialog.isOpen && (
         <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-xs rounded-3xl p-6 text-center shadow-xl animate-in zoom-in-95">
               <div className={`w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center ${dialog.type==='error'?'bg-red-100 text-red-600':'bg-blue-100 text-blue-600'}`}>{dialog.type==='error'?<AlertTriangle size={28}/>:<CheckCircle2 size={28}/>}</div>
               <p className="font-bold text-slate-700 mb-6">{dialog.message}</p>
               <div className="flex gap-2">
                  {dialog.type==='confirm' && <button onClick={() => setDialog({isOpen:false})} className="flex-1 py-2 border rounded-xl">取消</button>}
                  <button onClick={() => { if(dialog.onConfirm) dialog.onConfirm(); setDialog({isOpen:false}); }} className="flex-1 py-2 bg-blue-600 text-white rounded-xl font-bold">確定</button>
               </div>
            </div>
         </div>
      )}
      <style>{`
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        .no-arrow { -moz-appearance: textfield; }
        @supports (padding-bottom: env(safe-area-inset-bottom)) { .safe-area-bottom { padding-bottom: calc(env(safe-area-inset-bottom) + 1rem); } }
        @supports (padding-top: env(safe-area-inset-top)) { .safe-area-top { padding-top: calc(env(safe-area-inset-top) + 0.5rem); } }
      `}</style>
    </div>
  );
}