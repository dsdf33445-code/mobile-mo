import { Plus, Edit2, Trash2, FileText, ArrowRight, ClipboardList } from 'lucide-react';

export default function WorkOrderListView({ workOrders, onSelect, onEdit, onDelete, onAdd, onCheckAgreement }: any) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex justify-between items-center">
        <h2 className="font-bold text-xl text-slate-800">工令總表</h2>
        <button onClick={onAdd} className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 flex items-center gap-1"><Plus size={16}/> 新增</button>
      </div>
      {workOrders.length === 0 ? (
        <div className="text-center py-20 text-slate-400"><ClipboardList size={48} className="mx-auto mb-4 opacity-20" /><p>尚無工令資料</p></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {workOrders.map((wo: any) => (
            <div key={wo.id} onClick={() => onSelect(wo)} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all active:scale-[0.98] cursor-pointer relative overflow-hidden">
              <div className="flex justify-between items-start mb-2">
                <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${wo.status === 'MO' ? 'bg-purple-100 text-purple-600' : wo.status === '已結案' ? 'bg-slate-100 text-slate-500' : 'bg-blue-100 text-blue-600'}`}>{wo.status}</span>
                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                  <button onClick={() => onCheckAgreement(wo.id)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full" title="查案"><FileText size={16}/></button>
                  <button onClick={() => onEdit(wo)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full"><Edit2 size={16}/></button>
                  <button onClick={() => onDelete(wo.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full"><Trash2 size={16}/></button>
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
  );
}