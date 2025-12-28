import { Timestamp } from 'firebase/firestore';

// 工令資料結構
export interface WorkOrder {
  id: string;
  no: string;         // 工令編號
  name: string;       // 工程名稱
  status: string;     // 狀態
  subNo?: string;     // 分工令
  applicant?: string; // 申請人/承包商
  remark?: string;    // 備註
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// 工令內的項目
export interface WorkOrderItem {
  id: string;
  workOrderId: string;
  no: string;
  name: string;
  qty: number;
  price: number;
  remark?: string;
}

// 產品資料庫
export interface Product {
  no: string;
  name: string;
  price: number;
}

// 簽名物件
export interface Signature {
  img: string;
  date: string;
}

// 協議書資料
export interface Agreement {
  woNo: string;
  woName: string;
  contractor: string;
  durationOption: '1' | '2' | '3';
  durationDays?: string;
  durationCoop?: string;
  durationCalendarDays?: string;
  durationDate?: string;
  safetyChecks: number[];
  signatures: Record<string, Signature | null | undefined>; 
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
  signatureUrl?: string;
  role?: string; // 新增：使用者角色 (承辦人、股長...)
}