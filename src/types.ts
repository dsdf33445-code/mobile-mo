import { Timestamp } from 'firebase/firestore';

// 工令資料結構
export interface WorkOrder {
  id: string;
  no: string;         // 工令編號 (e.g. Y6N10001)
  name: string;       // 工程名稱
  status: string;     // 狀態: '接收工令' | 'MO' | '已完工' | '已結案'
  subNo?: string;     // 分工令 (僅 MO 狀態有)
  applicant?: string; // 申請人/承包商
  remark?: string;    // 備註 (用於顯示轉交來源等)
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// 工令內的項目 (MO Item)
export interface WorkOrderItem {
  id: string;
  workOrderId: string;
  no: string;         // 項目編號
  name: string;       // 項目名稱
  qty: number;        // 數量
  price: number;      // 單價
  remark?: string;    // 備註 (用於顯示合併來源等)
}

// 產品資料庫 (來自 CSV)
export interface Product {
  no: string;
  name: string;
  price: number;
}

// 簽名物件
export interface Signature {
  img: string;        // Base64 圖片字串
  date: string;       // YYYY-MM-DD
}

// 協議書資料
export interface Agreement {
  woNo: string;
  woName: string;
  contractor: string;
  durationOption: '1' | '2' | '3';
  durationDays?: string;        // 工作天
  durationCoop?: string;        // 配合施工內容
  durationCalendarDays?: string;// 日曆天
  durationDate?: string;        // 特定日期
  safetyChecks: number[];       // 勾選的安全事項索引
  signatures: Record<string, Signature | null | undefined>; // key 為角色 ID
}

// 簽名角色定義
export interface SigningRole {
  id: string;
  label: string;
}

// 使用者設定檔
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
}