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
  writeBatch,
  type QuerySnapshot, 
  type DocumentSnapshot 
} from 'firebase/firestore';
import { 
  FileSpreadsheet, AlertTriangle, CheckCircle2, LogOut, Loader2, User as UserIcon, 
  GitMerge, CheckSquare, Square, Send, X, Settings, PenTool 
} from 'lucide-react';

import { auth, db, provider } from './firebase';
import SignaturePad from './components/SignaturePad';
import AgreementView from './components/AgreementView';
import WorkOrderListView from './components/WorkOrderListView';
import MoDetailView from './components/MoDetailView';
import BottomNavigation from './components/BottomNavigation';
import type { WorkOrder, WorkOrderItem, Product, Agreement, SigningRole, UserProfile } from './types';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null); // 當前使用者的完整資料 (含簽章)
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'agreement' | 'wo' | 'mo'>('wo');
  
  // Data State
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [items, setItems] = useState<WorkOrderItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [currentWOId, setCurrentWOId] = useState<string | null>(null);
  const [draftAgreement, setDraftAgreement] = useState<Partial<Agreement>>({});
  const [dbLoading, setDbLoading] = useState(false);
  const [sharedOwnerId, setSharedOwnerId] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);

  // UI State
  const [dialog, setDialog] = useState<{isOpen: boolean; type?: 'error'|'success'|'confirm'|'alert'; message?: string; onConfirm?: () => void}>({ isOpen: false });
  const [woModal, setWoModal] = useState<{isOpen: boolean; data: Partial<WorkOrder> | null}>({ isOpen: false, data: null });
  const [itemModal, setItemModal] = useState<{isOpen: boolean; data: Partial<WorkOrderItem> | null}>({ isOpen: false, data: null });
  const [mergeModal, setMergeModal] = useState<{isOpen: boolean; selectedIds: string[]}>({ isOpen: false, selectedIds: [] });
  const [transferModal, setTransferModal] = useState<{isOpen: boolean; targetUser: UserProfile | null}>({ isOpen: false, targetUser: null });
  const [showSettingsMenu, setShowSettingsMenu] = useState(false); // 設定選單開關
  
  const [signingRole, setSigningRole] = useState<SigningRole | null>(null); // 協議書簽名用
  const [isSettingSignature, setIsSettingSignature] = useState(false); // 設定個人簽章用
  
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);

  // Computed
  const currentWorkOrder = useMemo(() => workOrders.find(w => w.id === currentWOId), [workOrders, currentWOId]);
  const currentItems = items;

  // --- Effects ---
  useEffect(() => {
    const initAuth = async () => { setLoading(true); };
    initAuth();
    const unsub = onAuthStateChanged(auth, 
        (u) => { 
            setUser(u); 
            // 確保無論有沒有 user，只要 Auth 檢查完就關閉 loading
            // 注意：如果您有其他 useEffect 會再次開啟 loading (如 items 監聽)，這是正常的
            if (!currentWOId) setLoading(false); 
            
            if(u && !new URLSearchParams(window.location.search).get('shareId')) {
                setActiveTab('wo');
            }
        },
        (error) => {
            console.error("Auth Error:", error);
            setLoading(false); // 發生錯誤也要關閉 loading
        }
    );    
    
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

  // 監聽當前使用者的詳細資料 (取得簽章)
  useEffect(() => {
    if(!user) return;
    const unsub = onSnapshot(doc(db, 'artifacts', 'mobile-mo', 'users', user.uid), (doc) => {
        if(doc.exists()) setCurrentUserProfile(doc.data() as UserProfile);
    });
    return () => unsub();
  }, [user]);

  // 監聽所有使用者 (轉交用)
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'artifacts', 'mobile-mo', 'users'));
    const unsubUsers = onSnapshot(q, (snapshot) => {
        const usersList: UserProfile[] = [];
        snapshot.forEach(doc => {
            const userData = doc.data() as UserProfile;
            if (userData.uid !== user.uid) usersList.push(userData);
        });
        setAllUsers(usersList);
    });
    return () => unsubUsers();
  }, [user]);

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
      const newProds: Product[] = [];
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
       getDoc(doc(db, 'artifacts', 'mobile-mo', 'users', uid, 'workOrders', currentWOId)).then(s => s.exists() && setWorkOrders([{id:s.id, ...s.data()} as WorkOrder]));
    } else {
       const unsubWO = onSnapshot(query(collection(db, 'artifacts', 'mobile-mo', 'users', uid, 'workOrders'), orderBy('createdAt', 'desc')), (s: QuerySnapshot) => setWorkOrders(s.docs.map(d => ({id:d.id, ...d.data()} as WorkOrder))));
       return () => unsubWO();
    }
  }, [user, sharedOwnerId, currentWOId]);

  useEffect(() => {
    if ((!user && !sharedOwnerId) || !currentWOId) {
        setItems([]);
        return;
    }
    const uid = sharedOwnerId || user?.uid;
    if (!uid) return;

    setLoading(true);
    const q = query(
        collection(db, 'artifacts', 'mobile-mo', 'users', uid, 'items'), 
        where('workOrderId', '==', currentWOId)
    );
    
    const unsubItems = onSnapshot(q, (s: QuerySnapshot) => {
        setItems(s.docs.map(d => ({id:d.id, ...d.data()} as WorkOrderItem)));
        setLoading(false);
    });
    
    return () => unsubItems();
  }, [user, currentWOId, sharedOwnerId]);

  useEffect(() => {
    if (!user && !sharedOwnerId) return;
    const uid = sharedOwnerId || user?.uid;
    if (!uid) return;

    let unsubAgree = () => {};
    if (currentWOId) {
       unsubAgree = onSnapshot(doc(db, 'artifacts', 'mobile-mo', 'users', uid, 'agreements', currentWOId), (s: DocumentSnapshot) => {
         if(s.exists()) setDraftAgreement(s.data() as Agreement);
         else if (!sharedOwnerId) {
           const wo = workOrders.find(w => w.id === currentWOId);
           setDraftAgreement({ 
               woNo: wo?.no || '', 
               woName: wo?.name || '', 
               contractor: '', 
               durationOption: '1', 
               safetyChecks: [], 
               signatures: {} 
           });
         }
       });
    } else {
        if(!sharedOwnerId) setDraftAgreement({ woNo: '', woName: '', contractor: '', durationOption: '1', safetyChecks: [], signatures: {} });
    }
    return () => unsubAgree();
  }, [user, currentWOId, sharedOwnerId, workOrders]);

  // --- Handlers ---
  const handleLogin = async () => { 
    try { 
        setLoading(true); 
        const result = await signInWithPopup(auth, provider);
        const u = result.user;
        if (u) {
            await setDoc(doc(db, 'artifacts', 'mobile-mo', 'users', u.uid), {
                uid: u.uid,
                email: u.email,
                displayName: u.displayName || u.email?.split('@')[0],
                photoURL: u.photoURL,
                lastLogin: serverTimestamp()
            }, { merge: true });
        }
    } catch(e) { 
        setDialog({isOpen:true, type:'error', message:'登入失敗'}); 
        setLoading(false); 
    } 
  };
  
  const handleLogout = () => { setShowSettingsMenu(false); signOut(auth); };
  
  const handleUpdateAgreement = (field: keyof Agreement, value: any) => {
    if (field === 'woNo') value = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    const newState = { ...draftAgreement, [field]: value };
    setDraftAgreement(newState);
    if(user && currentWOId && !sharedOwnerId) setDoc(doc(db, 'artifacts', 'mobile-mo', 'users', user.uid, 'agreements', currentWOId), newState, {merge:true});
    
    if ((field === 'woNo' || field === 'woName') && currentWOId && user) {
        const updateData = field === 'woNo' ? { no: value } : { name: value };
        setDoc(doc(db, 'artifacts', 'mobile-mo', 'users', user.uid, 'workOrders', currentWOId), updateData, {merge: true});
    }
  };

  const handleToggleSafety = (idx: number) => {
    if(!currentWOId && !sharedOwnerId) return; 
    const checks = draftAgreement.safetyChecks || [];
    const newChecks = checks.includes(idx) ? checks.filter((i:number)=>i!==idx) : [...checks, idx];
    handleUpdateAgreement('safetyChecks', newChecks);
  };

  // 統一處理簽名板儲存 (包含協議書簽名 與 個人設定簽章)
  const handleSignatureSave = async (img: string) => {
    if (!user) return;
    
    if (isSettingSignature) {
        // 設定個人簽章
        await setDoc(doc(db, 'artifacts', 'mobile-mo', 'users', user.uid), { signatureUrl: img }, {merge: true});
        setIsSettingSignature(false);
        setDialog({isOpen:true, type:'success', message:'電子簽章已儲存'});
    } else if (signingRole) {
        // 協議書簽名
        const uid = sharedOwnerId || user?.uid;
        if(!uid || !currentWOId) return;
        const today = new Date().toISOString().split('T')[0];
        const currentSigs = draftAgreement.signatures || {};
        const newSigs = { ...currentSigs, [signingRole.id]: { img, date: today } };
        setDoc(doc(db, 'artifacts', 'mobile-mo', 'users', uid, 'agreements', currentWOId), { ...draftAgreement, signatures: newSigs }, {merge:true});
        setSigningRole(null);
    }
  };
  
  // 快速蓋章功能
  const handleStamp = (role: SigningRole) => {
      if (!currentUserProfile?.signatureUrl) return setDialog({isOpen:true, type:'alert', message:'請先至設定建立電子簽章'});
      
      const uid = sharedOwnerId || user?.uid;
      if(!uid || !currentWOId) return;
      
      const today = new Date().toISOString().split('T')[0];
      const currentSigs = draftAgreement.signatures || {};
      const newSigs = { ...currentSigs, [role.id]: { img: currentUserProfile.signatureUrl, date: today } };
      setDoc(doc(db, 'artifacts', 'mobile-mo', 'users', uid, 'agreements', currentWOId), { ...draftAgreement, signatures: newSigs }, {merge:true});
  };

  const handleSignatureDateChange = (roleId: string, date: string) => {
    const uid = sharedOwnerId || user?.uid;
    if(!uid || !currentWOId) return;
    const currentSigs = draftAgreement.signatures || {};
    const currentSig = currentSigs[roleId];
    if (!currentSig) return;

    const newSigs = { ...currentSigs, [roleId]: { ...currentSig, date } };
    setDoc(doc(db, 'artifacts', 'mobile-mo', 'users', uid, 'agreements', currentWOId), { signatures: newSigs }, {merge:true});
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
    if(!woModal.data?.no || !woModal.data?.name) return;
    if(woModal.data.status==='MO' && (!woModal.data.subNo || woModal.data.subNo.length<2)) return setDialog({isOpen:true, type:'error', message:'MO 狀態需填寫分工令'});
    
    const isNew = !woModal.data.id;
    const id = woModal.data.id || doc(collection(db, 'dummy')).id;
    
    await setDoc(doc(db, 'artifacts', 'mobile-mo', 'users', user!.uid, 'workOrders', id), { 
      ...woModal.data, 
      id: id,
      updatedAt: serverTimestamp(),
      createdAt: woModal.data.createdAt || serverTimestamp()
    }, {merge:true});

    if (isNew) {
        await setDoc(doc(db, 'artifacts', 'mobile-mo', 'users', user!.uid, 'agreements', id), {
            woNo: woModal.data.no,
            woName: woModal.data.name,
            contractor: '',
            durationOption: '1',
            safetyChecks: [],
            signatures: {}
        });
        setDialog({isOpen:true, type:'success', message: '工令建立成功！'});
    } else {
        await setDoc(doc(db, 'artifacts', 'mobile-mo', 'users', user!.uid, 'agreements', id), {
            woNo: woModal.data.no,
            woName: woModal.data.name
        }, {merge: true});
        setDialog({isOpen:true, type:'success', message: '工令更新成功'});
    }

    setWoModal({isOpen:false, data:null});
  };

  const handleSaveItem = async () => {
    if(!itemModal.data?.no || !itemModal.data?.qty) return;

    // 邏輯判斷：同一項目編號只能一筆 (排除自己)
    const duplicate = items.find(i => i.no === itemModal.data?.no && i.id !== itemModal.data?.id);
    if (duplicate) {
        setDialog({isOpen:true, type:'error', message: `項目編號 ${itemModal.data.no} 已存在！`});
        return;
    }

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
      const sourceItems = querySnapshot.docs.map(d => d.data() as WorkOrderItem);

      const batch = writeBatch(db);

      for (const srcItem of sourceItems) {
        const existingItem = currentItems.find(i => i.no === srcItem.no);
        const srcWo = sourceWos.find(w => w.id === srcItem.workOrderId);
        
        if (existingItem) {
          const newQty = Number(existingItem.qty) + Number(srcItem.qty);
          const remark = existingItem.remark ? `${existingItem.remark}, ${srcWo?.no}` : `合併自: ${srcWo?.no}`;
          const itemRef = doc(db, 'artifacts', 'mobile-mo', 'users', user!.uid, 'items', existingItem.id);
          batch.update(itemRef, { qty: newQty, remark: remark });
        } else {
          const newId = doc(collection(db, 'dummy')).id;
          const itemRef = doc(db, 'artifacts', 'mobile-mo', 'users', user!.uid, 'items', newId);
          batch.set(itemRef, { ...srcItem, id: newId, workOrderId: currentWOId, remark: `合併自: ${srcWo?.no}` });
        }
      }

      await batch.commit();

      setDialog({isOpen:true, type:'success', message:`成功合併 ${sourceItems.length} 個項目`});
      setMergeModal({ isOpen: false, selectedIds: [] });
    } catch (e) {
      console.error(e);
      setDialog({isOpen:true, type:'error', message:'合併失敗'});
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async () => {
     if (!transferModal.targetUser || !currentWorkOrder || !user) return;
     const targetUser = transferModal.targetUser;
     const senderName = user.displayName || user.email;

     setLoading(true);
     try {
        const batch = writeBatch(db);
        const newId = doc(collection(db, 'dummy')).id;

        const woRef = doc(db, 'artifacts', 'mobile-mo', 'users', targetUser.uid, 'workOrders', newId);
        batch.set(woRef, {
            ...currentWorkOrder,
            id: newId,
            status: '接收工令',
            remark: `轉交自: ${senderName}`,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        const agreeRef = doc(db, 'artifacts', 'mobile-mo', 'users', targetUser.uid, 'agreements', newId);
        batch.set(agreeRef, {
            ...draftAgreement
        });

        await batch.commit();

        setDialog({isOpen:true, type:'success', message: `已成功轉交給 ${targetUser.displayName}`});
        setTransferModal({isOpen:false, targetUser: null});
     } catch(e) {
        console.error(e);
        setDialog({isOpen:true, type:'error', message: '轉交失敗，請稍後再試'});
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

  if (loading && items.length === 0) return <div className="min-h-screen flex items-center justify-center text-blue-600"><Loader2 className="animate-spin" size={48}/></div>;
  
  if (!user && !sharedOwnerId) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-600 to-blue-800 p-6">
      <div className="bg-white p-8 rounded-3xl w-full max-w-sm text-center shadow-2xl animate-in zoom-in-95 duration-500">
        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-600 shadow-inner">
           <FileSpreadsheet size={40}/>
        </div>
        <h1 className="text-3xl font-extrabold mb-2 text-slate-800 tracking-tight">行動版 MO</h1>
        <p className="text-slate-500 mb-8 font-medium">中鋼風格 • 雲端同步 • 專業工令</p>
        <button onClick={handleLogin} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-lg flex justify-center items-center gap-3 hover:bg-black active:scale-95 transition-all shadow-xl shadow-slate-900/30">
           <UserIcon size={20}/> 使用 Google 登入
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-[Microsoft JhengHei] pb-24 safe-area-bottom">
      
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b p-4 flex justify-between safe-area-top no-print">
        <div className="flex items-center gap-2 font-bold text-lg text-slate-800"><FileSpreadsheet size={18}/> 行動版 MO</div>
        <div className="flex items-center gap-2 relative">
          {sharedOwnerId && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">訪客</span>}
          {user && (
              <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full" onClick={() => setShowSettingsMenu(!showSettingsMenu)}>
                  {user.photoURL ? <img src={user.photoURL} alt="user" className="w-5 h-5 rounded-full" /> : <UserIcon size={14} />}
                  <span className="text-xs font-bold text-slate-700">{user.displayName || user.email?.split('@')[0]}</span>
                  {showSettingsMenu ? <X size={14}/> : <Settings size={14}/>}
              </div>
          )}
          {/* 設定選單 (Dropdown) */}
          {user && showSettingsMenu && (
             <div className="absolute top-12 right-0 bg-white rounded-xl shadow-xl border overflow-hidden w-40 z-50 animate-in zoom-in-95">
                 <button onClick={() => { setIsSettingSignature(true); setShowSettingsMenu(false); }} className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 flex items-center gap-2">
                     <PenTool size={16}/> 設定電子簽章
                 </button>
                 <button onClick={handleLogout} className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 text-red-600 flex items-center gap-2 border-t">
                     <LogOut size={16}/> 登出
                 </button>
             </div>
          )}
        </div>
      </header>

      <main className="p-4 max-w-2xl mx-auto mb-20 print:p-0 print:m-0 print:max-w-none print:mb-0">
        {activeTab === 'agreement' && (
          <AgreementView 
            data={draftAgreement} currentWOId={currentWOId} isShared={!!sharedOwnerId}
            userSignature={currentUserProfile?.signatureUrl}
            onChange={handleUpdateAgreement} onToggleSafety={handleToggleSafety}
            onSigning={setSigningRole} onStamp={handleStamp} onClearSignature={(rid:string) => handleUpdateAgreement('signatures', {...draftAgreement.signatures, [rid]: null})}
            onDateChange={handleSignatureDateChange} 
            onCreate={handleCreateWO} 
            onTransfer={() => setTransferModal({isOpen:true, targetUser: null})}
          />
        )}
        {activeTab === 'wo' && (
          <WorkOrderListView 
            workOrders={workOrders} 
            onSelect={(wo: WorkOrder) => { setCurrentWOId(wo.id); setActiveTab('mo'); }}
            onEdit={(wo: WorkOrder) => { setWoModal({isOpen:true, data:wo}); }}
            onDelete={(id:string) => handleDelete('workOrders', id)}
            onAdd={() => { setWoModal({isOpen:true, data:{no:'', name:'', status:'接收工令'}}); }}
            onCheckAgreement={(id:string) => { setCurrentWOId(id); setActiveTab('agreement'); }}
          />
        )}
        {activeTab === 'mo' && (
          <MoDetailView 
            currentWorkOrder={currentWorkOrder} items={currentItems} dbLoading={dbLoading} productCount={products.length}
            onDeleteItem={(id:string) => handleDelete('items', id)}
            onEditItem={(item) => { setItemModal({isOpen:true, data: item}); setShowSuggestions(false); }}
            onAddClick={() => { setItemModal({isOpen:true, data:{no:'', name:'', qty:0, price:0}}); setShowSuggestions(false); }}
            onReloadDb={fetchProducts}
            onMergeClick={() => setMergeModal({ isOpen: true, selectedIds: [] })}
          />
        )}
      </main>

      <div className="no-print">
         <BottomNavigation activeTab={activeTab} setActiveTab={setActiveTab} onMoClick={() => { if(!currentWOId) return setDialog({isOpen:true, type:'alert', message:'請先選擇工令'}); setActiveTab('mo'); }} />
      </div>

      {/* 簽名板 (共用：協議書簽名 OR 個人設定簽章) */}
      {(signingRole || isSettingSignature) && (
          <SignaturePad 
             title={isSettingSignature ? "設定個人電子簽章" : signingRole?.label || ''} 
             onSave={handleSignatureSave} 
             onClose={() => { setSigningRole(null); setIsSettingSignature(false); }} 
          />
      )}
      
      {woModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-xl animate-in zoom-in-95">
              <h3 className="font-bold text-lg mb-4">{woModal.data?.id ? '編輯工令' : '新增工令'}</h3>
              <div className="space-y-4">
                 <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">工令編號</label>
                    <input type="text" maxLength={8} value={woModal.data?.no || ''} onChange={e => setWoModal({...woModal, data:{...woModal.data, no:e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')}})} className="w-full bg-slate-50 border p-3 rounded-xl font-bold font-mono" placeholder="請輸入8碼工令編號" />
                 </div>
                 <div><label className="text-xs font-bold text-gray-500 block mb-1">工程名稱</label><input type="text" value={woModal.data?.name || ''} onChange={e => setWoModal({...woModal, data:{...woModal.data, name:e.target.value}})} className="w-full bg-slate-50 border p-3 rounded-xl font-bold" placeholder="請輸入工程名稱" /></div>
                 <div><label className="text-xs font-bold text-gray-500 block mb-1">狀態</label><select value={woModal.data?.status || '接收工令'} onChange={e => setWoModal({...woModal, data:{...woModal.data, status:e.target.value}})} className="w-full border p-3 rounded-xl"><option>接收工令</option><option>MO</option><option>已完工</option><option>已結案</option></select></div>
                 {woModal.data?.status==='MO' && <div><label className="text-xs text-blue-500 font-bold block mb-1">分工令 (必填)</label><input type="text" maxLength={2} value={woModal.data.subNo||''} onChange={e => setWoModal({...woModal, data:{...woModal.data, subNo:e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'')}})} className="w-full border-2 border-blue-200 p-3 rounded-xl font-mono font-bold text-center text-xl" /></div>}
                 <div className="flex gap-2 pt-2"><button onClick={() => setWoModal({isOpen:false, data:null})} className="flex-1 py-3 text-slate-500 font-bold bg-slate-100 rounded-xl">取消</button><button onClick={handleSaveWO} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg">儲存</button></div>
              </div>
           </div>
        </div>
      )}

      {transferModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-xl animate-in zoom-in-95">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Send size={20}/> 轉交協議書</h3>
              <p className="text-xs text-gray-500 mb-4">請選擇轉交對象 (已登入過系統的使用者)：</p>
              <div className="space-y-4">
                 <div className="relative">
                    <select 
                        value={transferModal.targetUser?.uid || ''} 
                        onChange={e => {
                            const selected = allUsers.find(u => u.uid === e.target.value);
                            setTransferModal({...transferModal, targetUser: selected || null});
                        }}
                        className="w-full bg-slate-50 border p-3 rounded-xl appearance-none"
                    >
                        <option value="" disabled>請選擇使用者...</option>
                        {allUsers.map(u => (
                            <option key={u.uid} value={u.uid}>{u.displayName} ({u.email})</option>
                        ))}
                    </select>
                    <div className="absolute right-3 top-3.5 pointer-events-none text-gray-400">▼</div>
                 </div>
                 
                 <div className="flex gap-2 pt-2">
                    <button onClick={() => setTransferModal({isOpen:false, targetUser: null})} className="flex-1 py-3 text-slate-500 font-bold bg-slate-100 rounded-xl">取消</button>
                    <button 
                        onClick={handleTransfer} 
                        disabled={!transferModal.targetUser}
                        className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:shadow-none"
                    >
                        確認轉交
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {mergeModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-sm rounded-3xl flex flex-col shadow-xl animate-in zoom-in-95 max-h-[80vh]">
              <div className="p-4 border-b flex justify-between items-center"><h3 className="font-bold text-lg flex gap-2"><GitMerge/> 合併工令</h3><button onClick={() => setMergeModal({isOpen:false, selectedIds:[]})}><X size={20}/></button></div>
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
                 <button onClick={() => setMergeModal({isOpen:false, selectedIds:[]})} className="flex-1 py-3 text-slate-500 font-bold bg-slate-100 rounded-xl">取消</button>
                 <button onClick={handleMergeWorkOrders} disabled={mergeModal.selectedIds.length === 0} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:shadow-none">確認合併</button>
              </div>
           </div>
        </div>
      )}

      {/* Item Modal */}
      {itemModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
           <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-xl animate-in slide-in-from-bottom-10">
              <div className="flex justify-between mb-4"><h3 className="font-bold">{itemModal.data?.id ? '編輯項目' : '新增項目'}</h3><button onClick={() => setItemModal({isOpen:false, data:null})}><X size={20}/></button></div>
              <div className="space-y-4">
                 <div className="relative">
                    <label className="text-xs font-bold text-gray-500 block mb-1">項目編號</label>
                    <input type="text" value={itemModal.data?.no || ''} onChange={e => { const v=e.target.value.toUpperCase(); setItemModal({...itemModal, data:{...itemModal.data, no:v}}); if(v) { setFilteredProducts(products.filter(p=>p.no.includes(v)||p.name.includes(v))); setShowSuggestions(true); } else setShowSuggestions(false); }} className="w-full border p-3 rounded-xl font-mono" placeholder="搜尋編號..." />
                    {showSuggestions && <ul className="absolute z-10 w-full bg-white border shadow-xl max-h-40 overflow-y-auto">{filteredProducts.map(p=><li key={p.no} onClick={() => { setItemModal({...itemModal, data:{...itemModal.data, no:p.no, name:p.name, price:p.price}}); setShowSuggestions(false); }} className="p-3 hover:bg-blue-50 border-b cursor-pointer"><span className="font-bold text-blue-600 font-mono block">{p.no}</span><span className="text-xs">{p.name}</span></li>)}</ul>}
                 </div>
                 
                 <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">項目名稱</label>
                    <input type="text" readOnly value={itemModal.data?.name || ''} className="w-full bg-slate-100 p-3 rounded-xl" />
                 </div>
                 
                 <div className="flex gap-3">
                    <div className="flex-1">
                        <label className="text-xs font-bold text-gray-500 block mb-1">單價</label>
                        <input type="number" readOnly value={itemModal.data?.price || 0} className="w-full bg-slate-100 p-3 rounded-xl text-center" />
                    </div>
                    <div className="flex-1">
                        <label className="text-xs font-bold text-gray-500 block mb-1">數量</label>
                        <input type="number" value={itemModal.data?.qty || ''} onChange={e => setItemModal({...itemModal, data:{...itemModal.data, qty: Number(e.target.value)}})} className="w-full border p-3 rounded-xl text-center font-bold text-blue-600" autoFocus />
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
        @media print {
            @page { size: A4; margin: 10mm; }
            body { background: white; -webkit-print-color-adjust: exact; }
            .no-print, header, nav, .fixed { display: none !important; }
            .print-only { display: block !important; }
            .print:hidden { display: none !important; }
            .shadow-xl, .shadow-lg, .shadow-sm { box-shadow: none !important; }
            .rounded-2xl, .rounded-3xl, .rounded-xl { border-radius: 0 !important; }
            .border { border-color: #000 !important; }
            input, select { border: none !important; background: transparent !important; padding: 0 !important; }
            .bg-slate-50 { background: transparent !important; }
            main { margin: 0 !important; padding: 0 !important; width: 100% !important; max-width: none !important; }
        }
        @supports (padding-bottom: env(safe-area-inset-bottom)) { .safe-area-bottom { padding-bottom: calc(env(safe-area-inset-bottom) + 1rem); } }
        @supports (padding-top: env(safe-area-inset-top)) { .safe-area-top { padding-top: calc(env(safe-area-inset-top) + 0.5rem); } }
      `}</style>
    </div>
  );
}