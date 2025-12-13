import { useState } from 'react';
// 修正：移除未使用的 Link
import { ChevronDown, ChevronUp, X, PenTool, FileText, Maximize, FileSignature, Send, Printer } from 'lucide-react';
import { CONTRACTOR_OPTIONS, SAFETY_CHECK_ITEMS, SIGNATURE_ROLES } from '../constants';

export default function AgreementView({ 
  data, currentWOId, isSigningMode, isShared, 
  onChange, onToggleSafety, onSigning, onClearSignature, onDateChange, onCreate, onTransfer, onExitSigning 
}: any) {
  const [isSafetyExpanded, setIsSafetyExpanded] = useState(false);
  
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* 建立新協議書標題 */}
      {!isSigningMode && !currentWOId && !isShared && (
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded-2xl shadow-lg flex justify-between no-print">
          <div><h2 className="font-bold text-lg">建立新協議書</h2><p className="text-blue-100 text-xs mt-1">填寫下方資料後建立工令</p></div>
          <div className="bg-white/20 p-2 rounded-xl"><FileText size={24} /></div>
        </div>
      )}
      
      {/* 查案狀態 Bar */}
      {currentWOId && !isSigningMode && (
        <div className="bg-blue-50 border border-blue-100 p-3 rounded-2xl flex justify-between items-center no-print">
          <div className="flex items-center gap-2">
            <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-lg">查案中</span>
            <span className="font-bold text-blue-900">{data.woNo}</span>
          </div>
          <div className="flex gap-2">
             {/* 3. 轉交按鈕 */}
            <button onClick={onTransfer} className="p-2 text-blue-600 bg-white rounded-full shadow-sm active:scale-95" title="轉交"><Send size={18}/></button>
             {/* 5. 列印按鈕 */}
            <button onClick={() => window.print()} className="p-2 text-blue-600 bg-white rounded-full shadow-sm active:scale-95" title="列印 PDF"><Printer size={18}/></button>
            <button onClick={() => onExitSigning(true)} className="p-2 text-blue-600 bg-white rounded-full shadow-sm active:scale-95"><Maximize size={18}/></button>
          </div>
        </div>
      )}

      <div className={`bg-white rounded-3xl ${isSigningMode ? '' : 'shadow-sm border border-slate-100'} overflow-hidden`}>
        {!isSigningMode && <div className="bg-slate-50 p-4 border-b text-center text-slate-500 font-bold text-sm">工程委辦及開工工安協議書</div>}
        <div className="p-5 space-y-6">
          <div className="grid gap-4">
            <div>
              <label className="text-xs font-bold text-slate-400 ml-1 mb-1 block">工令編號 (8碼英數)</label>
              <input type="text" value={data.woNo || ''} readOnly={!!currentWOId} onChange={e => onChange('woNo', e.target.value)} className="w-full bg-slate-50 border-0 rounded-xl p-3 font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 font-mono uppercase" placeholder="例如: Y6N10001" maxLength={8} />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 ml-1 mb-1 block">工程名稱</label>
              <input type="text" value={data.woName || ''} readOnly={!!currentWOId} onChange={e => onChange('woName', e.target.value)} className="w-full bg-slate-50 border-0 rounded-xl p-3 font-bold text-slate-700 focus:ring-2 focus:ring-blue-500" placeholder="輸入名稱..." />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 ml-1 mb-1 block">承包廠商</label>
              <div className="relative">
                <select value={data.contractor || ''} disabled={!!currentWOId} onChange={e => onChange('contractor', e.target.value)} className="w-full bg-slate-50 border-0 rounded-xl p-3 font-bold text-slate-700 appearance-none">
                  <option value="" disabled>請選擇...</option>
                  {CONTRACTOR_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-3.5 text-slate-400 pointer-events-none" size={18} />
              </div>
            </div>
          </div>
          <hr className="border-slate-100"/>
          
          <div>
            <h4 className="font-bold text-slate-800 mb-3 text-sm">工程期限</h4>
            <div className="space-y-3">
              {[
                { id: '1', label: '工作天', content: <>本工程施工期限為 <input type="number" value={data.durationDays || ''} onChange={e => onChange('durationDays', e.target.value)} className="w-10 border-b-2 text-center font-bold text-blue-600 no-arrow"/> 工作天，需配合 <input type="text" value={data.durationCoop || ''} onChange={e => onChange('durationCoop', e.target.value)} className="w-16 border-b-2 text-center font-bold text-blue-600"/> 施工。</> },
                { id: '2', label: '日曆天', content: <>需配合施工，其施工期限為配合工程完成後於 <input type="number" value={data.durationCalendarDays || ''} onChange={e => onChange('durationCalendarDays', e.target.value)} className="w-10 border-b-2 text-center font-bold text-blue-600 no-arrow"/> 日曆天內完成。</> },
                { id: '3', label: '特定日', content: <>本工程施工期限於 <input type="date" value={data.durationDate || ''} onChange={e => onChange('durationDate', e.target.value)} className="border rounded px-1 bg-white text-xs ml-1"/> 完成。</> }
              ].map(opt => (
                <label key={opt.id} className={`flex items-start gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer ${data.durationOption === opt.id ? 'border-blue-500 bg-blue-50/50' : 'border-transparent bg-slate-50'}`}>
                  <input type="radio" checked={data.durationOption === opt.id} onChange={() => onChange('durationOption', opt.id)} className="mt-1 w-4 h-4 text-blue-600" />
                  <div className="text-sm text-slate-600 leading-relaxed">{opt.content}</div>
                </label>
              ))}
            </div>
          </div>
          <hr className="border-slate-100"/>

          <div className="rounded-2xl border border-slate-100 overflow-hidden">
            <button onClick={() => setIsSafetyExpanded(!isSafetyExpanded)} className="w-full flex justify-between items-center p-4 bg-slate-50 hover:bg-slate-100 no-print">
              <span className="font-bold text-slate-700 text-sm">施工前安全確認事項 ({data.safetyChecks?.length || 0}/20)</span>
              {isSafetyExpanded ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
            </button>
            {(isSafetyExpanded || isSigningMode) && (
              <div className="p-2 bg-white max-h-96 overflow-y-auto">
                {SAFETY_CHECK_ITEMS.map((item, idx) => (
                  <label key={idx} className="flex gap-3 p-3 hover:bg-slate-50 rounded-lg cursor-pointer">
                    <input type="checkbox" checked={(data.safetyChecks || []).includes(idx)} disabled={!!currentWOId && !isSigningMode} onChange={() => onToggleSafety(idx)} className="mt-1 w-5 h-5 rounded border-gray-300 text-blue-600" />
                    <span className="text-sm text-slate-600 leading-relaxed">{item}</span>
                  </label>
                ))}
              </div>
            )}
            {/* 列印時只顯示已勾選的項目 */}
            <div className="hidden print-only p-4">
                 <h4 className="font-bold mb-2">安全確認事項：</h4>
                 {SAFETY_CHECK_ITEMS.filter((_, i) => (data.safetyChecks || []).includes(i)).map(item => (
                     <div key={item} className="text-sm mb-1">☑ {item}</div>
                 ))}
            </div>
          </div>

          <div>
            <h4 className="font-bold text-slate-800 mb-3 text-sm">簽名確認</h4>
            <div className="grid gap-3">
              {SIGNATURE_ROLES.map(role => (
                <div key={role.id} onClick={() => !data.signatures?.[role.id] && onSigning(role)} className={`p-3 rounded-xl border-2 border-dashed transition-all cursor-pointer ${data.signatures?.[role.id] ? 'border-blue-200 bg-blue-50/30' : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50'}`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-slate-500">{role.label}</span>
                    {data.signatures?.[role.id] && <button onClick={(e) => { e.stopPropagation(); onClearSignature(role.id); }} className="text-red-400 p-1 no-print"><X size={14}/></button>}
                  </div>
                  {data.signatures?.[role.id] ? (
                    <div className="flex flex-col items-center">
                      <img src={data.signatures[role.id].img} alt="簽名" className="h-16 object-contain mix-blend-multiply" />
                      <input type="date" value={data.signatures[role.id].date} onClick={e => e.stopPropagation()} onChange={e => onDateChange(role.id, e.target.value)} className="text-xs border rounded px-1 mt-1 text-gray-500" />
                    </div>
                  ) : (
                    <div className="h-16 flex items-center justify-center text-slate-300 gap-2"><PenTool size={16}/> 點擊簽名</div>
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