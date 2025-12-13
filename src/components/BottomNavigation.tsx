import { FileSpreadsheet, FileText, LayoutList } from 'lucide-react';

export default function BottomNavigation({ activeTab, setActiveTab, onMoClick }: any) {
  return (
    <nav className="fixed bottom-0 w-full bg-white border-t flex justify-around items-center z-50 safe-area-bottom shadow">
      <button onClick={() => setActiveTab('agreement')} className={`flex flex-col items-center flex-1 py-3 ${activeTab === 'agreement' ? 'text-blue-600' : 'text-gray-400'}`}><FileText size={24}/><span className="text-[10px]">協議書</span></button>
      <button onClick={() => setActiveTab('wo')} className={`flex flex-col items-center flex-1 py-3 ${activeTab === 'wo' ? 'text-blue-600' : 'text-gray-400'}`}><LayoutList size={24}/><span className="text-[10px]">工令管理</span></button>
      <button onClick={onMoClick} className={`flex flex-col items-center flex-1 py-3 ${activeTab === 'mo' ? 'text-blue-600' : 'text-gray-400'}`}><FileSpreadsheet size={24}/><span className="text-[10px]">MO 明細</span></button>
    </nav>
  );
}