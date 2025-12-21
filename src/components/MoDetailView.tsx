import { Plus, Trash2, FileSpreadsheet, RefreshCw, Loader2, GitMerge, ExternalLink, Edit } from 'lucide-react';
import { utils, writeFile } from 'xlsx'; 
import type { WorkOrder, WorkOrderItem } from '../types';

interface Props {
  currentWorkOrder?: WorkOrder;
  items: WorkOrderItem[];
  onDeleteItem: (id: string) => void;
  onEditItem: (item: WorkOrderItem) => void; // 新增編輯功能
  onAddClick: () => void;
  onReloadDb: () => void;
  onMergeClick: () => void;
  dbLoading: boolean;
  productCount: number;
}

export default function MoDetailView({ 
  currentWorkOrder, items, onDeleteItem, onEditItem, onAddClick, onReloadDb, onMergeClick, dbLoading, productCount 
}: Props) {
  
  const handleExport = () => {
    if (!items || items.length === 0) return;
    
    const headers = ['項目編號(*必填)', '項目名稱(可不填寫)', '數量(*必填)', '倍率(*必填)', '加成(*必填)', '備註(可不填寫)'];
    
    const data = items.map((item) => [
      item.no,
      item.name,
      Number(item.qty),
      1.0,
      1.0,
      ''
    ]);

    const wsData = [headers, ...data];
    const ws = utils.aoa_to_sheet(wsData);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "ITEM");

    const no = currentWorkOrder?.no || 'export';
    const sub = currentWorkOrder?.subNo ? `-${currentWorkOrder.subNo}` : ''; 
    const now = new Date();
    const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
    const filename = `${no}${sub}_${dateStr}.xls`;

    writeFile(wb, filename, { bookType: 'biff8' });
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500 pb-20">
      <div className="bg-[#1e3a8a] text-white p-5 rounded-3xl shadow-xl shadow-blue-900/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
        
        <h2 className="font-bold text-xl relative z-10 mb-1">{currentWorkOrder?.name}</h2>
        <p className="text-blue-200 font-mono text-sm mb-6 relative z-10 border-b border-blue-700/50 pb-2 inline-block">
          {currentWorkOrder?.no}{currentWorkOrder?.subNo ? `-${currentWorkOrder.subNo}` : ''}
        </p>
        
        <div className="flex justify-between items-end relative z-10">
          <div>
             <p className="text-[10px] text-blue-300 uppercase tracking-wider mb-0.5">預估總金額</p>
             <p className="text-3xl font-bold text-white leading-none">
               <span className="text-lg mr-1">$</span>
               {items.reduce((a, b) => a + (b.qty * b.price), 0).toLocaleString()}
             </p>
          </div>
          <div className="text-right">
             <p className="text-[10px] text-blue-300 uppercase tracking-wider mb-0.5">項目總數</p>
             <p className="text-2xl font-bold text-white leading-none">{items.length}</p>
          </div>
        </div>
      </div>
      
      <div className="flex justify-between items-center py-1 overflow-x-auto">
         <button onClick={onReloadDb} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 shadow-sm hover:bg-slate-50 whitespace-nowrap active:scale-95 transition-transform">
            {dbLoading ? <Loader2 className="animate-spin" size={14}/> : <RefreshCw size={14}/>} 
            更新資料庫 ({productCount})
         </button>

         <div className="flex gap-2 ml-2">
            <a 
              href="https://dsz.csc.com.tw/dsz/login/dszs0?action=https://cscqs01.csc.com.tw/qs_home/QS_HOME_Redirect.ASP%3FECinfo=MO01" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-blue-600 shadow-sm hover:bg-blue-50 whitespace-nowrap active:scale-95 transition-transform no-underline"
            >
              <ExternalLink size={16}/> 前往 MO
            </a>
            <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-green-700 shadow-sm hover:bg-green-50 whitespace-nowrap active:scale-95 transition-transform">
                <FileSpreadsheet size={16}/> 匯出 Excel
            </button>
         </div>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
            {item.remark && (
              <span className="absolute top-0 right-0 bg-purple-100 text-purple-700 text-[10px] px-2 py-1 rounded-bl-xl font-bold z-10">
                 {item.remark}
              </span>
            )}
            
            <div className="flex justify-between items-start mt-2">
               <div className="flex-1 min-w-0 pr-8">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded font-mono">{item.no}</span>
                    <h3 className="font-bold text-slate-800 text-sm truncate">{item.name}</h3>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 bg-slate-50 p-2 rounded-lg inline-flex">
                    <span>單價: <span className="font-mono">${item.price.toLocaleString()}</span></span>
                    <div className="w-px h-3 bg-slate-300"></div>
                    <span className="text-blue-600 font-bold">數量: {item.qty}</span>
                    <div className="w-px h-3 bg-slate-300"></div>
                    <span className="font-bold text-slate-700">小計: ${(item.price * item.qty).toLocaleString()}</span>
                  </div>
               </div>
               
               <div className="absolute bottom-2 right-2 flex gap-1">
                 {/* 編輯按鈕 */}
                 <button onClick={() => onEditItem(item)} className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-colors">
                   <Edit size={18}/>
                 </button>
                 {/* 刪除按鈕 */}
                 <button onClick={() => onDeleteItem(item.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                   <Trash2 size={18}/>
                 </button>
               </div>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="text-center py-10 text-slate-400 text-sm">尚無項目，請點擊下方按鈕新增</div>}
      </div>

      <button onClick={onMergeClick} className="fixed bottom-40 right-6 w-12 h-12 bg-purple-600 text-white rounded-full shadow-lg shadow-purple-600/40 flex items-center justify-center hover:bg-purple-700 active:scale-90 transition-all z-30" title="合併工令">
        <GitMerge size={20} />
      </button>

      <button onClick={onAddClick} className="fixed bottom-24 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-600/40 flex items-center justify-center hover:bg-blue-700 active:scale-90 transition-all z-30">
        <Plus size={28} />
      </button>
    </div>
  );
}