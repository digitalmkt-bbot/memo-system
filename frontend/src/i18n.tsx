import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type Lang = 'th' | 'en';

const STORE_KEY = 'memo.lang';

export function getStoredLang(): Lang {
  if (typeof localStorage !== 'undefined') {
    const v = localStorage.getItem(STORE_KEY);
    if (v === 'th' || v === 'en') return v;
  }
  return 'th';
}

// ---- Dictionaries -------------------------------------------------------
type Dict = Record<string, any>;

const TH: Dict = {
  common: {
    appName: 'Love Island',
    systemName: 'ระบบ MEMO',
    systemFull: 'ระบบจัดการบันทึกข้อความภายใน (MEMO Management System)',
    logout: 'ออกจากระบบ',
    search: 'ค้นหา',
    loading: 'กำลังโหลด…',
    save: 'บันทึก',
    cancel: 'ยกเลิก',
    edit: 'แก้ไข',
    back: '← กลับ',
    noData: 'ยังไม่มีข้อมูล',
    dash: '—',
  },
  nav: {
    dashboard: 'แดชบอร์ด',
    memos: 'บันทึก (MEMO)',
    create: 'สร้างใหม่',
    reports: 'รายงาน',
    users: 'ผู้ใช้',
    settings: 'ตั้งค่า',
  },
  login: {
    subtitle: 'ระบบจัดการบันทึกข้อความภายใน (MEMO Management System)',
    email: 'อีเมล',
    password: 'รหัสผ่าน',
    signIn: 'เข้าสู่ระบบ',
    signingIn: 'กำลังเข้าสู่ระบบ…',
    failed: 'เข้าสู่ระบบไม่สำเร็จ',
  },
  dashboard: {
    hello: 'สวัสดี',
    overview: 'ภาพรวมบันทึกข้อความ',
    monthlyTitle: 'บันทึกรายเดือน (12 เดือน)',
    byCompanyTitle: 'บันทึกตามบริษัท',
    barTotal: 'ทั้งหมด',
    barApproved: 'อนุมัติ',
    inbox: 'รออนุมัติจากคุณ',
    approved: 'อนุมัติแล้ว',
    pending_manager: 'รอหัวหน้า',
    pending_executive: 'รอผู้บริหาร',
    rejected: 'ไม่อนุมัติ',
    total: 'ทั้งหมด',
  },
  memos: {
    title: 'บันทึก (MEMO)',
    newMemo: '+ สร้างบันทึกใหม่',
    boxSent: 'ของฉัน',
    boxInbox: 'รออนุมัติ',
    boxAll: 'ทั้งหมด',
    searchPlaceholder: 'ค้นหา เลขที่/เรื่อง…',
    noMemos: 'ยังไม่มีบันทึก',
    colNo: 'เลขที่',
    colSubject: 'เรื่อง',
    colCompanyDept: 'บริษัท/แผนก',
    colFrom: 'จาก',
    colStatus: 'สถานะ',
  },
  form: {
    company: 'บริษัท (Company) *',
    department: 'แผนก (Department) *',
    date: 'วันที่ (Date)',
    memoNumber: 'เลขที่ (Memo Number)',
    memoIssued: '— ออกแล้ว —',
    memoAuto: 'ออกอัตโนมัติเมื่อส่ง',
    from: 'จาก (From) *',
    fromPlaceholder: 'ชื่อผู้ส่ง / หน่วยงาน',
    subject: 'เรื่อง (Subject) *',
    attachmentNote: 'หมายเหตุไฟล์แนบ (ข้อความ)',
    attachmentNotePlaceholder: 'เช่น ใบเสนอราคา 1 ฉบับ (คำอธิบาย)',
    attachFile: 'แนบไฟล์ (อัปโหลด)',
    attachHint: 'สูงสุด 10MB · แนบไฟล์เพิ่มได้ในหน้ารายละเอียดหลังบันทึก',
    detail: 'รายละเอียด (Detail) *',
    detailPlaceholder: 'แสดงอย่างน้อย 9 บรรทัด…',
    detailRequired: 'กรุณากรอกรายละเอียด',
    saveDraft: 'บันทึกฉบับร่าง',
    submit: 'ส่งเพื่ออนุมัติ',
    fileTooBig: 'ไฟล์ใหญ่เกิน 10MB — ข้ามการแนบไฟล์',
    attachFailed: 'แนบไฟล์ไม่สำเร็จ: ',
  },
  create: {
    title: 'สร้างบันทึกใหม่',
    subtitle: 'เลขรันจะออกอัตโนมัติแบบ atomic เมื่อกดส่ง',
  },
  edit: {
    title: 'แก้ไขฉบับร่าง',
  },
  view: {
    draft: 'ฉบับร่าง',
    from: 'จาก',
    dept: 'แผนก',
    attachmentNote: 'หมายเหตุไฟล์แนบ',
    dateLabel: 'วันที่',
    approve: '✓ อนุมัติ',
    reject: '✕ ไม่อนุมัติ',
    submit: 'ส่งเพื่ออนุมัติ',
    edit: 'แก้ไข',
    downloadPdf: 'ดาวน์โหลด PDF',
    attachments: 'ไฟล์แนบ',
    noAttachments: 'ยังไม่มีไฟล์แนบ',
    uploading: 'กำลังอัปโหลด…',
    maxPerFile: 'สูงสุด 10MB ต่อไฟล์',
    del: 'ลบ',
    delFileConfirm: 'ลบไฟล์นี้?',
    approvalPath: 'เส้นทางการอนุมัติ',
    stepCreate: 'สร้างบันทึก',
    stepSubmit: 'ส่งเพื่ออนุมัติ',
    stepApprove: 'อนุมัติ',
    stepReject: 'ไม่อนุมัติ',
    waitManager: 'รอหัวหน้าอนุมัติ',
    waitExecutive: 'รอผู้บริหารอนุมัติ',
    pendingAction: 'รอดำเนินการ',
    confirmApprove: 'ยืนยันการอนุมัติ',
    confirmReject: 'ยืนยันการไม่อนุมัติ',
    addComment: 'เพิ่มความคิดเห็น (ถ้ามี)',
    provideReason: 'กรุณาระบุเหตุผล',
    reasonRequired: 'กรุณาระบุเหตุผล',
    fileTooBig: 'ไฟล์ใหญ่เกิน 10MB',
    approveBtn: 'อนุมัติ',
    rejectBtn: 'ไม่อนุมัติ',
  },
  reports: {
    title: 'รายงาน (Reports)',
    subtitle: 'สรุปบันทึกตามบริษัท แผนก และรายเดือน',
    byCompany: 'ตามบริษัท',
    byDept: 'ตามแผนก',
    monthly: 'รายเดือน',
  },
  users: {
    title: 'จัดการผู้ใช้ (Users)',
    subtitle: 'เฉพาะผู้ดูแลระบบ — เพิ่มผู้ใช้และกำหนดบทบาท',
    addUser: '+ เพิ่มผู้ใช้',
    employeeCode: 'รหัสพนักงาน *',
    name: 'ชื่อ *',
    email: 'อีเมล *',
    password: 'รหัสผ่าน *',
    company: 'บริษัท *',
    department: 'แผนก',
    role: 'บทบาท *',
    select: '— เลือก —',
    added: 'เพิ่มผู้ใช้เรียบร้อย',
    note1: 'การแสดงรายชื่อผู้ใช้ทั้งหมดต้องการ endpoint ',
    note2: ' (อยู่ใน Phase 2). ปัจจุบันรองรับการ ',
    note3: 'เพิ่มผู้ใช้',
    note4: ' ผ่าน ',
  },
  settings: {
    title: 'ตั้งค่า (Settings)',
    myAccount: 'บัญชีของฉัน',
    name: 'ชื่อ',
    role: 'บทบาท',
    company: 'บริษัท',
    companiesInSystem: 'บริษัทในระบบ',
  },
  items: {
    title: 'รายการสินค้า / บริการ',
    colItem: 'รายการ', colDetail: 'รายละเอียด', colQty: 'จำนวน', colUnit: 'หน่วย',
    colUnitPrice: 'ราคา/หน่วย', colAmount: 'รวม',
    addRow: '+ เพิ่มรายการ', total: 'ยอดรวม (ฐานอนุมัติ)',
    vatNote: 'VAT จะกำหนดตอนออกเอกสารจัดซื้อ', none: 'ยังไม่มีรายการ',
    vatLabel: 'คิดภาษีมูลค่าเพิ่ม (VAT 7%)', subtotal: 'ยอดรวม', vatAmount: 'VAT 7%', grandTotal: 'ยอดรวมสุทธิ',
  },
  sign: {
    title: 'ลายมือชื่ออนุมัติ',
    requester: 'ผู้ขอ / Requester', manager: 'ผู้จัดการ / Manager', executive: 'ผู้บริหาร / Executive',
    signed: 'ลงชื่อ', date: 'วันที่',
  },
  status: {
    draft: 'ฉบับร่าง', pending_manager: 'รอหัวหน้า', pending_executive: 'รอผู้บริหาร',
    approved: 'อนุมัติแล้ว', rejected: 'ไม่อนุมัติ', cancelled: 'ยกเลิก',
  },
  role: {
    staff: 'พนักงาน', manager: 'หัวหน้างาน', executive: 'ผู้บริหาร', admin: 'ผู้ดูแลระบบ',
  },
};

const EN: Dict = {
  common: {
    appName: 'Love Island',
    systemName: 'MEMO System',
    systemFull: 'Internal MEMO Management System',
    logout: 'Sign out',
    search: 'Search',
    loading: 'Loading…',
    save: 'Save',
    cancel: 'Cancel',
    edit: 'Edit',
    back: '← Back',
    noData: 'No data yet',
    dash: '—',
  },
  nav: {
    dashboard: 'Dashboard',
    memos: 'Memos',
    create: 'Create',
    reports: 'Reports',
    users: 'Users',
    settings: 'Settings',
  },
  login: {
    subtitle: 'Internal MEMO Management System',
    email: 'Email',
    password: 'Password',
    signIn: 'Sign in',
    signingIn: 'Signing in…',
    failed: 'Sign in failed',
  },
  dashboard: {
    hello: 'Hello',
    overview: 'Memo overview',
    monthlyTitle: 'Memos by month (12 months)',
    byCompanyTitle: 'Memos by company',
    barTotal: 'Total',
    barApproved: 'Approved',
    inbox: 'Awaiting your approval',
    approved: 'Approved',
    pending_manager: 'Awaiting manager',
    pending_executive: 'Awaiting executive',
    rejected: 'Rejected',
    total: 'Total',
  },
  memos: {
    title: 'Memos',
    newMemo: '+ New memo',
    boxSent: 'Mine',
    boxInbox: 'To approve',
    boxAll: 'All',
    searchPlaceholder: 'Search no./subject…',
    noMemos: 'No memos yet',
    colNo: 'No.',
    colSubject: 'Subject',
    colCompanyDept: 'Company/Dept',
    colFrom: 'From',
    colStatus: 'Status',
  },
  form: {
    company: 'Company *',
    department: 'Department *',
    date: 'Date',
    memoNumber: 'Memo Number',
    memoIssued: '— issued —',
    memoAuto: 'Auto-generated on submit',
    from: 'From *',
    fromPlaceholder: 'Sender name / unit',
    subject: 'Subject *',
    attachmentNote: 'Attachment note (text)',
    attachmentNotePlaceholder: 'e.g. 1 quotation (description)',
    attachFile: 'Attach file (upload)',
    attachHint: 'Max 10MB · You can add more files on the detail page after saving',
    detail: 'Detail *',
    detailPlaceholder: 'At least 9 lines…',
    detailRequired: 'Please enter the detail',
    saveDraft: 'Save draft',
    submit: 'Submit for approval',
    fileTooBig: 'File exceeds 10MB — skipping attachment',
    attachFailed: 'Attachment failed: ',
  },
  create: {
    title: 'Create new memo',
    subtitle: 'The running number is generated atomically on submit',
  },
  edit: {
    title: 'Edit draft',
  },
  view: {
    draft: 'Draft',
    from: 'From',
    dept: 'Department',
    attachmentNote: 'Attachment note',
    dateLabel: 'Date',
    approve: '✓ Approve',
    reject: '✕ Reject',
    submit: 'Submit for approval',
    edit: 'Edit',
    downloadPdf: 'Download PDF',
    attachments: 'Attachments',
    noAttachments: 'No attachments yet',
    uploading: 'Uploading…',
    maxPerFile: 'Max 10MB per file',
    del: 'Delete',
    delFileConfirm: 'Delete this file?',
    approvalPath: 'Approval path',
    stepCreate: 'Memo created',
    stepSubmit: 'Submitted for approval',
    stepApprove: 'approved',
    stepReject: 'rejected',
    waitManager: 'Awaiting manager approval',
    waitExecutive: 'Awaiting executive approval',
    pendingAction: 'Pending',
    confirmApprove: 'Confirm approval',
    confirmReject: 'Confirm rejection',
    addComment: 'Add a comment (optional)',
    provideReason: 'Please provide a reason',
    reasonRequired: 'Please provide a reason',
    fileTooBig: 'File exceeds 10MB',
    approveBtn: 'Approve',
    rejectBtn: 'Reject',
  },
  reports: {
    title: 'Reports',
    subtitle: 'Memo summary by company, department and month',
    byCompany: 'By company',
    byDept: 'By department',
    monthly: 'By month',
  },
  users: {
    title: 'Users',
    subtitle: 'Admins only — add users and assign roles',
    addUser: '+ Add user',
    employeeCode: 'Employee code *',
    name: 'Name *',
    email: 'Email *',
    password: 'Password *',
    company: 'Company *',
    department: 'Department',
    role: 'Role *',
    select: '— Select —',
    added: 'User added successfully',
    note1: 'Listing all users requires the endpoint ',
    note2: ' (planned for Phase 2). Currently you can ',
    note3: 'add users',
    note4: ' via ',
  },
  settings: {
    title: 'Settings',
    myAccount: 'My account',
    name: 'Name',
    role: 'Role',
    company: 'Company',
    companiesInSystem: 'Companies in system',
  },
  items: {
    title: 'Items / Services',
    colItem: 'Item', colDetail: 'Description', colQty: 'Qty', colUnit: 'Unit',
    colUnitPrice: 'Unit price', colAmount: 'Amount',
    addRow: '+ Add item', total: 'Total (approval base)',
    vatNote: 'VAT is set when the purchase document is issued', none: 'No items yet',
    vatLabel: 'Apply VAT (7%)', subtotal: 'Subtotal', vatAmount: 'VAT 7%', grandTotal: 'Total (incl. VAT)',
  },
  sign: {
    title: 'Approval signatures',
    requester: 'Requester', manager: 'Manager', executive: 'Executive',
    signed: 'Signed', date: 'Date',
  },
  status: {
    draft: 'Draft', pending_manager: 'Awaiting manager', pending_executive: 'Awaiting executive',
    approved: 'Approved', rejected: 'Rejected', cancelled: 'Cancelled',
  },
  role: {
    staff: 'Staff', manager: 'Manager', executive: 'Executive', admin: 'Administrator',
  },
};

const DICTS: Record<Lang, Dict> = { th: TH, en: EN };

function lookup(dict: Dict, key: string): string {
  const v = key.split('.').reduce<any>((o, k) => (o == null ? undefined : o[k]), dict);
  return typeof v === 'string' ? v : key;
}

// ---- Context ------------------------------------------------------------
interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  statusLabel: (s: string) => string;
  roleLabel: (r: string) => string;
}

const Ctx = createContext<I18nCtx>(null as any);
export const useI18n = () => useContext(Ctx);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => getStoredLang());

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(STORE_KEY, l); } catch { /* ignore */ }
    if (typeof document !== 'undefined') document.documentElement.lang = l;
  }, []);

  const t = useCallback((key: string) => lookup(DICTS[lang], key), [lang]);
  const statusLabel = useCallback((s: string) => lookup(DICTS[lang], 'status.' + s), [lang]);
  const roleLabel = useCallback((r: string) => lookup(DICTS[lang], 'role.' + r), [lang]);

  return <Ctx.Provider value={{ lang, setLang, t, statusLabel, roleLabel }}>{children}</Ctx.Provider>;
}
