import { useState } from 'react';
import { ChevronDown, ChevronUp, X, PenTool, FileText, Send, Printer, FileSignature } from 'lucide-react';
import { CONTRACTOR_OPTIONS, SAFETY_CHECK_ITEMS, SIGNATURE_ROLES } from '../constants';
import type { Agreement, SigningRole } from '../types';

interface Props {
  data: Partial<Agreement>;
  currentWOId: string | null;
  isShared: boolean;
  onChange: (field: keyof Agreement, value: any) => void;
  onToggleSafety: (idx: number) => void;
  onSigning: (role: SigningRole) => void;
  onClearSignature: (roleId: string) => void;
  onDateChange: (roleId: string, date: string) => void;
  onCreate: () => void;
  onTransfer: () => void;
}

export default function AgreementView({ 
  data, currentWOId, isShared, 
  onChange, onToggleSafety, onSigning, onClearSignature, onDateChange, onCreate, onTransfer
}: Props) {
  const [isSafetyExpanded, setIsSafetyExpanded] = useState(false);
  
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {!currentWOId && !isShared && (
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded-2xl shadow-lg flex justify-between no-print">
          <div><h2 className="font-bold text-lg">建立新協議書</h2><p className="text-blue-100 text-xs mt-1">填寫下方資料後建立工令</p></div>
          <div className="bg-white/20 p-2 rounded-xl"><FileText size={24} /></div>
        </div>
      )}
      
      {currentWOId && (
        <div className="bg-blue-50 border border-blue-100 p-3 rounded-2xl flex justify-between items-center no-print">
          <div className="flex items-center gap-2">
            <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-lg">查案中</span>
            <span className="font-bold text-blue-900">{data.woNo}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={onTransfer} className="p-2 text-blue-600 bg-white rounded-full shadow-sm active:scale-95" title="轉交"><Send size={18}/></button>
            <button onClick={() => window.print()} className="p-2 text-blue-600 bg-white rounded-full shadow-sm active:scale-95" title="列印 PDF"><Printer size={18}/></button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden print:border-0 print:shadow-none">
        <div className="bg-slate-50 p-4 border-b text-center text-slate-500 font-bold text-sm print:bg-white print:text-black print:text-xl print:border-b-2 print:border-black">工程委辦及開工工安協議書</div>
        
        <div className="p-5 space-y-6 print:p-0 print:pt-4">
          <div className="grid gap-4 print:grid-cols-2 print:gap-x-8">
            <div>
              <label className="text-xs font-bold text-slate-400 ml-1 mb-1 block print:text-black print:text-sm">工令編號</label>
              <input type="text" value={data.woNo || ''} onChange={e => onChange('woNo', e.target.value)} className="w-full bg-slate-50 border-0 rounded-xl p-3 font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 font-mono uppercase print:p-0 print:text-black" placeholder="例如: Y6N10001" maxLength={8} />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 ml-1 mb-1 block print:text-black print:text-sm">工程名稱</label>
              <input type="text" value={data.woName || ''} onChange={e => onChange('woName', e.target.value)} className="w-full bg-slate-50 border-0 rounded-xl p-3 font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 print:p-0 print:text-black" placeholder="輸入名稱..." />
            </div>
            <div className="print:col-span-2">
              <label className="text-xs font-bold text-slate-400 ml-1 mb-1 block print:text-black print:text-sm">承包廠商</label>
              <div className="relative">
                <select value={data.contractor || ''} onChange={e => onChange('contractor', e.target.value)} className="w-full bg-slate-50 border-0 rounded-xl p-3 font-bold text-slate-700 appearance-none print:p-0 print:text-black">
                  <option value="" disabled>請選擇...</option>
                  {CONTRACTOR_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-3.5 text-slate-400 pointer-events-none no-print" size={18} />
              </div>
            </div>
          </div>
          <hr className="border-slate-100 print:border-black"/>
          
          <div>
            <h4 className="font-bold text-slate-800 mb-3 text-sm print:text-black print:text-base">工程期限</h4>
            <div className="space-y-3">
              {[
                { id: '1', label: '工作天', content: <>本工程施工期限為 <input type="number" value={data.durationDays || ''} onChange={e => onChange('durationDays', e.target.value)} className="w-10 border-b-2 text-center font-bold text-blue-600 no-arrow print:text-black print:border-black"/> 工作天，需配合 <input type="text" value={data.durationCoop || ''} onChange={e => onChange('durationCoop', e.target.value)} className="w-16 border-b-2 text-center font-bold text-blue-600 print:text-black print:border-black"/> 施工。</> },
                { id: '2', label: '日曆天', content: <>需配合施工，其施工期限為配合工程完成後於 <input type="number" value={data.durationCalendarDays || ''} onChange={e => onChange('durationCalendarDays', e.target.value)} className="w-10 border-b-2 text-center font-bold text-blue-600 no-arrow print:text-black print:border-black"/> 日曆天內完成。</> },
                { id: '3', label: '特定日', content: <>本工程施工期限於 <input type="date" value={data.durationDate || ''} onChange={e => onChange('durationDate', e.target.value)} className="border rounded px-1 bg-white text-xs ml-1 print:border-black print:text-black"/> 完成。</> }
              ].map(opt => (
                <div key={opt.id} className={`${data.durationOption !== opt.id ? 'print:hidden' : ''}`}>
                    <label className={`flex items-start gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer ${data.durationOption === opt.id ? 'border-blue-500 bg-blue-50/50 print:border-0 print:bg-transparent print:p-0' : 'border-transparent bg-slate-50 no-print'}`}>
                    <input type="radio" checked={data.durationOption === opt.id} onChange={() => onChange('durationOption', opt.id)} className="mt-1 w-4 h-4 text-blue-600 no-print" />
                    <div className="text-sm text-slate-600 leading-relaxed print:text-black print:text-sm">{opt.content}</div>
                    </label>
                </div>
              ))}
            </div>
          </div>
          <hr className="border-slate-100 print:border-black"/>

          <div className="rounded-2xl border border-slate-100 overflow-hidden print:border-0">
            <button onClick={() => setIsSafetyExpanded(!isSafetyExpanded)} className="w-full flex justify-between items-center p-4 bg-slate-50 hover:bg-slate-100 no-print">
              <span className="font-bold text-slate-700 text-sm">施工前安全確認事項 ({data.safetyChecks?.length || 0}/20)</span>
              {isSafetyExpanded ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
            </button>
            {(isSafetyExpanded || true) && (
              <div className={`p-2 bg-white max-h-96 overflow-y-auto no-print ${isSafetyExpanded ? '' : 'hidden'}`}>
                {SAFETY_CHECK_ITEMS.map((item, idx) => (
                  <label key={idx} className="flex gap-3 p-3 hover:bg-slate-50 rounded-lg cursor-pointer">
                    <input type="checkbox" checked={(data.safetyChecks || []).includes(idx)} onChange={() => onToggleSafety(idx)} className="mt-1 w-5 h-5 rounded border-gray-300 text-blue-600" />
                    <span className="text-sm text-slate-600 leading-relaxed">{item}</span>
                  </label>
                ))}
              </div>
            )}
            <div className="hidden print-only p-4">
                 <h4 className="font-bold mb-2">安全確認事項：</h4>
                 {SAFETY_CHECK_ITEMS.filter((_, i) => (data.safetyChecks || []).includes(i)).map(item => (
                     <div key={item} className="text-sm mb-1">☑ {item}</div>
                 ))}
            </div>
          </div>

          <div className="print:break-inside-avoid">
            <h4 className="font-bold text-slate-800 mb-3 text-sm print:text-black">簽名確認</h4>
            <div className="grid gap-3 print:grid-cols-3 print:gap-4">
              {SIGNATURE_ROLES.map(role => (
                <div key={role.id} onClick={() => !data.signatures?.[role.id] && onSigning(role)} className={`p-3 rounded-xl border-2 border-dashed transition-all cursor-pointer print:border print:border-black print:rounded-none ${data.signatures?.[role.id] ? 'border-blue-200 bg-blue-50/30 print:bg-transparent' : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50'}`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-slate-500 print:text-black">{role.label}</span>
                    {data.signatures?.[role.id] && <button onClick={(e) => { e.stopPropagation(); onClearSignature(role.id); }} className="text-red-400 p-1 no-print"><X size={14}/></button>}
                  </div>
                  {data.signatures?.[role.id] ? (
                    <div className="flex flex-col items-center">
                      {/* 修正：將 h-16 改為 h-32，放大簽名顯示區域 */}
                      <img src={data.signatures[role.id]!.img} alt="簽名" className="h-32 object-contain mix-blend-multiply" />
                      <input type="date" value={data.signatures[role.id]!.date} onClick={e => e.stopPropagation()} onChange={e => onDateChange(role.id, e.target.value)} className="text-xs border rounded px-1 mt-1 text-gray-500 print:border-0 print:text-black" />
                    </div>
                  ) : (
                    <div className="h-16 flex items-center justify-center text-slate-300 gap-2 no-print"><PenTool size={16}/> 點擊簽名</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {!currentWOId && !isShared && (
            <button onClick={onCreate} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-transform no-print"><FileSignature size={20}/> 建立工令並存檔</button>
          )}
        </div>
      </div>
    </div>
  );
}