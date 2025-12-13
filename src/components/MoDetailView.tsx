import { Plus, Trash2, FileSpreadsheet, RefreshCw, Loader2 } from 'lucide-react';

export default function MoDetailView({ currentWorkOrder, items, onDeleteItem, onAddClick, onExcelExport, onReloadDb, dbLoading, productCount }: any) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500 pb-20">
      <div className="bg-slate-900 text-white p-5 rounded-3xl shadow-xl shadow-slate-900/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-2xl"></div>
        <h2 className="font-bold text-lg relative z-10">{currentWorkOrder?.name}</h2>
        <p className="text-slate-400 font-mono text-sm mb-4 relative z-10">{currentWorkOrder?.no}{currentWorkOrder?.subNo ? `-${currentWorkOrder.subNo}` : ''}</p>
        <div className="flex gap-4 relative z-10">
          <div><p className="text-[10px] text-slate-400 uppercase tracking-wider">Total Items</p><p className="text-2xl font-bold">{items.length}</p></div>
          <div><p className="text-[10px] text-slate-400 uppercase tracking-wider">Est. Amount</p><p className="text-2xl font-bold text-blue-400">${items.reduce((a:any, b:any) => a + (b.qty * b.price), 0).toLocaleString()}</p></div>
        </div>
      </div>
      
      <div className="flex gap-2 overflow-x-auto py-1">
         <button onClick={onReloadDb} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 shadow-sm hover:bg-slate-50 whitespace-nowrap">
            {dbLoading ? <Loader2 className="animate-spin" size={14}/> : <RefreshCw size={14}/>} 
            資料庫 ({productCount})
         </button>
         <button onClick={onExcelExport} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 shadow-sm hover:bg-slate-50 whitespace-nowrap"><FileSpreadsheet size={16}/> 匯出 Excel</button>
      </div>

      <div className="space-y-3">
        {items.map((item: any) => (
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
            <button onClick={() => onDeleteItem(item.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full"><Trash2 size={18}/></button>
          </div>
        ))}
      </div>
      <button onClick={onAddClick} className="fixed bottom-24 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-600/40 flex items-center justify-center hover:bg-blue-700 active:scale-90 transition-all z-30"><Plus size={28} /></button>
    </div>
  );
}