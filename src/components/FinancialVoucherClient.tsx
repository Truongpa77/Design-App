"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import '../app/customers/customers.css';
import '../app/vouchers/voucher.css';
import { 
  LookupSelect, 
  QuickAddCustomerModal, 
  QuickAddMaterialModal, 
  QuickAddAccountModal,
  DateInput
} from "@/components/LookupSelect";
import { useMenu } from '@/components/MenuProvider';

interface Customer {
  id: number;
  name: string;
  phone: string;
  address: string;
}

interface Material {
  id: number;
  material_code: string | null;
  name: string;
  unit: string;
  unit_price: number;
}

interface Account {
  account_code: string;
  account_name: string;
}

interface VoucherItem {
  material_id: string;
  description: string;
  debit_account: string;
  credit_account: string;
  amount: string;
  tax_percent: string;
  tax_amount: string;
  total_amount: string;
  transaction_code?: string;
}

interface Voucher {
  id: number;
  document_no: string;
  type: string;
  document_date: string;
  customer_id: number | null;
  partner_name: string;
  partner_address: string;
  description: string;
  total_amount: number;
  total_tax: number;
  grand_total: number;
  created_at: string;
  customer_name?: string;
  item_count?: number;
  transaction_code?: string;
}

export default function FinancialVoucherClient({
  type,
  title,
  customers,
  materials,
  accounts,
}: {
  type: 'receipt' | 'payment' | 'debit_advice' | 'credit_advice';
  title: string;
  customers: Customer[];
  materials: Material[];
  accounts: Account[];
}) {
  const [localCustomers, setLocalCustomers] = useState<Customer[]>(customers);
  const [localMaterials, setLocalMaterials] = useState<Material[]>(materials);
  const [localAccounts, setLocalAccounts] = useState<Account[]>(accounts);
  const [transactionsList, setTransactionsList] = useState<any[]>([]);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const res = await fetch('/api/transactions');
        if (res.ok) {
          const data = await res.json();
          setTransactionsList(data);
        }
      } catch (e) {
        console.error('Error fetching transactions pool:', e);
      }
    };
    fetchTransactions();
  }, []);

  // ── Screen 1 State (Summary Table) ──────────────────────────────────
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [vouchersLoading, setVouchersLoading] = useState(true);

  // ── Collapsible Details State ───────────────────────────────────────
  const [expandedVouchers, setExpandedVouchers] = useState<{ [key: number]: any[] }>({});
  const [loadingVoucherId, setLoadingVoucherId] = useState<number | null>(null);

  const toggleExpand = async (id: number) => {
    if (expandedVouchers[id] !== undefined) {
      const next = { ...expandedVouchers };
      delete next[id];
      setExpandedVouchers(next);
    } else {
      setLoadingVoucherId(id);
      setExpandedVouchers(prev => ({ ...prev, [id]: [] }));
      try {
        const res = await fetch(`/api/vouchers/financial/${id}`);
        if (res.ok) {
          const data = await res.json();
          setExpandedVouchers(prev => ({ ...prev, [id]: data.items || [] }));
        } else {
          const next = { ...expandedVouchers };
          delete next[id];
          setExpandedVouchers(next);
          alert('Không thể tải chi tiết chứng từ');
        }
      } catch (e) {
        console.error(e);
        const next = { ...expandedVouchers };
        delete next[id];
        setExpandedVouchers(next);
      } finally {
        setLoadingVoucherId(null);
      }
    }
  };

  const handlePrint = async (v: Voucher) => {
    try {
      const res = await fetch(`/api/vouchers/financial/${v.id}`);
      if (!res.ok) return alert("Không thể tải chi tiết chứng từ để in");
      const data = await res.json();

      // Hàm đọc số thành chữ tiếng Việt
      const docSoTien = (soTien: number): string => {
        if (soTien === 0) return "Không đồng";
        const ChuSo = [" không", " một", " hai", " ba", " bốn", " năm", " sáu", " bảy", " tám", " chín"];
        const Tien = ["", " nghìn", " triệu", " tỷ", " nghìn tỷ", " triệu tỷ"];
        let Lan = 0;
        let i = 0;
        let Chuoi = "";
        let vitri = [];
        let temp = Math.abs(soTien);
        while (temp > 0) {
          vitri[Lan] = temp % 1000;
          temp = Math.floor(temp / 1000);
          Lan++;
        }
        const DocSoBaChuSo = (baso: number, hienThiKhongTrang: boolean): string => {
          let tram = Math.floor(baso / 100);
          let chuc = Math.floor((baso % 100) / 10);
          let donvi = baso % 10;
          let kq = "";
          if (tram > 0 || hienThiKhongTrang) {
            kq += ChuSo[tram] + " trăm";
          }
          if (chuc > 0) {
            if (chuc === 1) kq += " mười";
            else kq += ChuSo[chuc] + " mươi";
          } else if (tram > 0 && donvi > 0) {
            kq += " linh";
          }
          if (donvi > 0) {
            if (donvi === 1 && chuc > 1) {
              kq += " mốt";
            } else if (donvi === 5 && chuc > 0) {
              kq += " lăm";
            } else {
              kq += ChuSo[donvi];
            }
          }
          return kq;
        };
        for (i = Lan - 1; i >= 0; i--) {
          let hienThiTrang = (i < Lan - 1);
          let kq = DocSoBaChuSo(vitri[i], hienThiTrang);
          if (vitri[i] > 0 || i === 0) {
            Chuoi += kq + Tien[i];
          }
        }
        Chuoi = Chuoi.trim();
        if (Chuoi.length > 0) {
          Chuoi = Chuoi.substring(0, 1).toUpperCase() + Chuoi.substring(1) + " đồng";
        }
        return Chuoi;
      };

      // Tính tổng hợp danh sách tài khoản Nợ/Có duy nhất
      const debitAccountsSet = new Set<string>();
      const creditAccountsSet = new Set<string>();
      let totalAmount = 0;
      let totalTax = 0;
      let grandTotal = 0;
      let detailRowsHtml = "";

      (data.items || []).forEach((item: any, idx: number) => {
        if (item.debit_account) debitAccountsSet.add(item.debit_account);
        if (item.credit_account) creditAccountsSet.add(item.credit_account);
        const amt = Number(item.amount || 0);
        const taxAmt = Number(item.tax_amount || 0);
        
        totalAmount += amt;
        totalTax += taxAmt;
        grandTotal += (amt + taxAmt);

        const descriptionText = item.transaction_code 
          ? `[${item.transaction_code}] ${item.description || data.description || ""}`
          : (item.description || data.description || "");

        detailRowsHtml += `
          <tr>
            <td style="text-align: center;">${idx + 1}</td>
            <td>${descriptionText}</td>
            <td style="text-align: center; font-family: monospace; font-weight: bold;">${item.debit_account || ""}</td>
            <td style="text-align: center; font-family: monospace; font-weight: bold;">${item.credit_account || ""}</td>
            <td class="num">${new Intl.NumberFormat('vi-VN').format(amt)}</td>
            <td class="num">${new Intl.NumberFormat('vi-VN').format(taxAmt)}</td>
            <td class="num" style="font-weight: bold;">${new Intl.NumberFormat('vi-VN').format(amt + taxAmt)}</td>
          </tr>
        `;
      });

      const listDebitAccs = Array.from(debitAccountsSet).join(", ") || ".......";
      const listCreditAccs = Array.from(creditAccountsSet).join(", ") || ".......";

      const printWindow = window.open("", "_blank");
      if (printWindow) {
        let formCode = "Mẫu số 01 - TT";
        let formNote = "Ban hành theo Thông tư số 200/2014/TT-BTC<br/>ngày 22/12/2014 của Bộ Tài chính";
        let documentTitle = "CHỨNG TỪ KẾ TOÁN";
        let partnerLabel = "Họ và tên người nộp tiền";
        let reasonLabel = "Lý do nộp";
        
        let sigsHtml = "";
        let bottomNote = "";

        const dateObj = new Date(data.document_date);
        const dateStr = `Ngày ${dateObj.getDate()} tháng ${dateObj.getMonth() + 1} năm ${dateObj.getFullYear()}`;

        if (type === 'receipt') {
          formCode = "Mẫu số 01 - TT";
          documentTitle = "PHIẾU THU";
          partnerLabel = "Họ và tên người nộp tiền";
          reasonLabel = "Lý do nộp";
          
          sigsHtml = `
            <div class="sig-col">
              <div class="title">Giám đốc</div>
              <div class="subtitle">(Ký, họ tên, đóng dấu)</div>
              <div class="sign-space"></div>
              <div class="name">......................................</div>
            </div>
            <div class="sig-col">
              <div class="title">Kế toán trưởng</div>
              <div class="subtitle">(Ký, họ tên)</div>
              <div class="sign-space"></div>
              <div class="name">......................................</div>
            </div>
            <div class="sig-col">
              <div class="title">Người nộp tiền</div>
              <div class="subtitle">(Ký, họ tên)</div>
              <div class="sign-space"></div>
              <div class="name">${data.partner_name || data.customer_name || ""}</div>
            </div>
            <div class="sig-col">
              <div class="title">Người lập phiếu</div>
              <div class="subtitle">(Ký, họ tên)</div>
              <div class="sign-space"></div>
              <div class="name">......................................</div>
            </div>
            <div class="sig-col">
              <div class="title">Thủ quỹ</div>
              <div class="subtitle">(Ký, họ tên)</div>
              <div class="sign-space"></div>
              <div class="name">......................................</div>
            </div>
          `;

          bottomNote = `
            <div class="cash-verification">
              <p>Đã nhận đủ số tiền (viết bằng chữ): <span class="dotted-text-fill">${docSoTien(grandTotal)}</span></p>
              <p>+ Tỷ giá ngoại tệ (vàng bạc, đá quý): ..................................................................................................................................</p>
              <p>+ Số tiền quy đổi: ......................................................................................................................................................................</p>
              <p style="font-style: italic; margin-top: 15px; font-size: 11px; text-align: center; color: #555;">(Liên 1: Lưu; Liên 2: Giao người nộp; Liên 3: ...)</p>
            </div>
          `;

        } else if (type === 'payment') {
          formCode = "Mẫu số 02 - TT";
          documentTitle = "PHIẾU CHI";
          partnerLabel = "Họ và tên người nhận tiền";
          reasonLabel = "Lý do chi";
          
          sigsHtml = `
            <div class="sig-col">
              <div class="title">Giám đốc</div>
              <div class="subtitle">(Ký, họ tên, đóng dấu)</div>
              <div class="sign-space"></div>
              <div class="name">......................................</div>
            </div>
            <div class="sig-col">
              <div class="title">Kế toán trưởng</div>
              <div class="subtitle">(Ký, họ tên)</div>
              <div class="sign-space"></div>
              <div class="name">......................................</div>
            </div>
            <div class="sig-col">
              <div class="title">Thủ quỹ</div>
              <div class="subtitle">(Ký, họ tên)</div>
              <div class="sign-space"></div>
              <div class="name">......................................</div>
            </div>
            <div class="sig-col">
              <div class="title">Người nhận tiền</div>
              <div class="subtitle">(Ký, họ tên)</div>
              <div class="sign-space"></div>
              <div class="name">${data.partner_name || data.customer_name || ""}</div>
            </div>
            <div class="sig-col">
              <div class="title">Người lập phiếu</div>
              <div class="subtitle">(Ký, họ tên)</div>
              <div class="sign-space"></div>
              <div class="name">......................................</div>
            </div>
          `;

          bottomNote = `
            <div class="cash-verification">
              <p>Đã nhận đủ số tiền (viết bằng chữ): <span class="dotted-text-fill">${docSoTien(grandTotal)}</span></p>
              <p>+ Tỷ giá ngoại tệ (vàng bạc, đá quý): ..................................................................................................................................</p>
              <p>+ Số tiền quy đổi: ......................................................................................................................................................................</p>
            </div>
          `;
        } else {
          formCode = "Mẫu số B01-DN";
          documentTitle = type === 'debit_advice' ? "GIẤY BÁO NỢ" : "GIẤY BÁO CÓ";
          partnerLabel = "Đối tượng giao dịch";
          reasonLabel = "Lý do giao dịch";
          
          sigsHtml = `
            <div class="sig-col" style="width: 25%;">
              <div class="title">Giám đốc</div>
              <div class="subtitle">(Ký, họ tên, đóng dấu)</div>
              <div class="sign-space"></div>
              <div class="name">......................................</div>
            </div>
            <div class="sig-col" style="width: 25%;">
              <div class="title">Kế toán trưởng</div>
              <div class="subtitle">(Ký, họ tên)</div>
              <div class="sign-space"></div>
              <div class="name">......................................</div>
            </div>
            <div class="sig-col" style="width: 25%;">
              <div class="title">Kiểm soát</div>
              <div class="subtitle">(Ký, họ tên)</div>
              <div class="sign-space"></div>
              <div class="name">......................................</div>
            </div>
            <div class="sig-col" style="width: 25%;">
              <div class="title">Người lập biểu</div>
              <div class="subtitle">(Ký, họ tên)</div>
              <div class="sign-space"></div>
              <div class="name">${data.partner_name || data.customer_name || ""}</div>
            </div>
          `;
        }

        printWindow.document.write(`
          <html>
            <head>
              <title>${documentTitle} - ${data.document_no || ""}</title>
              <style>
                @page { size: A4 portrait; margin: 1.5cm; }
                body { font-family: 'Times New Roman', Times, serif; font-size: 13pt; line-height: 1.35; padding: 0; color: #000; background: #fff; }
                .no-print-bar { background: #f3f4f6; padding: 12px 24px; display: flex; gap: 10px; margin-bottom: 30px; border-bottom: 1px solid #ddd; }
                .btn { font-family: sans-serif; padding: 8px 16px; border-radius: 4px; font-weight: bold; cursor: pointer; border: 1px solid #ccc; background: #fff; font-size: 12px; }
                .btn-primary { background: #0066cc; color: #fff; border-color: #0044aa; }
                
                .print-page { width: 100%; max-width: 800px; margin: 0 auto; padding: 10px 20px; }
                
                .header-table { width: 100%; margin-bottom: 20px; border: none; border-collapse: collapse; }
                .header-table td { vertical-align: top; border: none; padding: 0; }
                .company-section { text-align: left; font-size: 11pt; font-weight: bold; text-transform: uppercase; }
                .company-addr { font-size: 10.5pt; font-weight: normal; text-transform: none; font-style: italic; color: #333; margin-top: 3px; }
                .form-code-section { text-align: center; font-size: 10.5pt; }
                .form-code-title { font-weight: bold; font-size: 11pt; }
                
                .title-section { text-align: center; margin-top: 15px; margin-bottom: 20px; }
                .title-section h1 { font-size: 19pt; font-weight: bold; margin: 0; letter-spacing: 0.05em; }
                .title-section .date { font-style: italic; font-size: 11.5pt; margin-top: 4px; }
                
                .acc-block { font-size: 10.5pt; float: right; width: 180px; text-align: left; line-height: 1.3; }
                .acc-row { display: flex; justify-content: space-between; margin-bottom: 2px; }
                .acc-label { font-weight: bold; }
                .acc-val { font-family: monospace; font-size: 11.5pt; border-bottom: 1px dotted #888; flex: 1; margin-left: 6px; text-align: right; padding-right: 4px; }

                .content-section { width: 100%; margin-bottom: 20px; }
                .dotted-row { display: flex; align-items: flex-end; margin-bottom: 8px; font-size: 12pt; }
                .row-label { font-weight: normal; white-space: nowrap; padding-right: 8px; }
                .row-dots { border-bottom: 1px dotted #444; flex: 1; padding-bottom: 2px; font-weight: bold; font-size: 12pt; }
                
                .detail-table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px; font-size: 11pt; }
                .detail-table th, .detail-table td { border: 1px solid #000; padding: 6px 8px; }
                .detail-table th { background: #f5f5f5; font-weight: bold; text-align: center; text-transform: uppercase; font-size: 10pt; }
                .detail-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
                
                .signatures-block { display: flex; justify-content: space-between; margin-top: 25px; margin-bottom: 30px; page-break-inside: avoid; }
                .sig-col { flex: 1; display: flex; flex-direction: column; align-items: center; text-align: center; font-size: 11.5pt; }
                .sig-col .title { font-weight: bold; margin-bottom: 3px; }
                .sig-col .subtitle { font-style: italic; font-size: 10pt; color: #444; margin-bottom: 60px; }
                .sig-col .name { font-weight: bold; font-size: 11.5pt; margin-top: 10px; }
                .sig-col .sign-space { height: 60px; }
                
                .cash-verification { margin-top: 15px; font-size: 11.5pt; line-height: 1.4; border-top: 1px solid #ccc; padding-top: 15px; page-break-inside: avoid; }
                .cash-verification p { margin: 6px 0; }
                .dotted-text-fill { font-weight: bold; font-style: italic; text-decoration: underline; }
                
                @media print {
                  .no-print-bar { display: none; }
                  body { font-size: 12pt; }
                  .print-page { max-width: 100%; padding: 0; }
                  @page { margin: 1.5cm 1cm; }
                }
              </style>
            </head>
            <body>
              <div class="no-print-bar">
                <button class="btn btn-primary" onclick="window.print()">🖨️ In Chứng Từ (Xuất PDF)</button>
                <button class="btn" onclick="window.close()">Đóng cửa sổ</button>
              </div>
              
              <div class="print-page">
                <table class="header-table">
                  <tr>
                    <td style="width: 55%;">
                      <div class="company-section">
                        CÔNG TY THIẾT KẾ NỘI THẤT TOÀN PHÁT
                        <div class="company-addr">Địa chỉ: Số 12, Phố Duy Tân, Cầu Giấy, Hà Nội</div>
                      </div>
                    </td>
                    <td style="width: 45%; text-align: right;">
                      <div class="form-code-section">
                        <span class="form-code-title">${formCode}</span><br/>
                        ${formNote}
                      </div>
                    </td>
                  </tr>
                </table>
                
                <div class="acc-block">
                  <div class="acc-row">
                    <span class="acc-label">Quyển số:</span>
                    <span class="acc-val">..................</span>
                  </div>
                  <div class="acc-row">
                    <span class="acc-label">Số phiếu:</span>
                    <span class="acc-val" style="font-weight: bold; color: #000;">${data.document_no}</span>
                  </div>
                  <div class="acc-row">
                    <span class="acc-label">Nợ:</span>
                    <span class="acc-val">${listDebitAccs}</span>
                  </div>
                  <div class="acc-row">
                    <span class="acc-label">Có:</span>
                    <span class="acc-val">${listCreditAccs}</span>
                  </div>
                </div>
                
                <div class="title-section">
                  <h1>${documentTitle}</h1>
                  <div class="date">${dateStr}</div>
                </div>
                
                <div class="content-section">
                  <div class="dotted-row">
                    <span class="row-label">${partnerLabel}:</span>
                    <span class="row-dots">${data.partner_name || data.customer_name || "Khách vãng lai"}</span>
                  </div>
                  <div class="dotted-row">
                    <span class="row-label">Địa chỉ:</span>
                    <span class="row-dots">${data.partner_address || ""}</span>
                  </div>
                  <div class="dotted-row">
                    <span class="row-label">${reasonLabel}:</span>
                    <span class="row-dots">${data.description || ""}</span>
                  </div>
                  <div class="dotted-row">
                    <span class="row-label">Số tiền:</span>
                    <span class="row-dots" style="font-size: 13pt;">${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(grandTotal)}</span>
                  </div>
                  <div class="dotted-row">
                    <span class="row-label">Viết bằng chữ:</span>
                    <span class="row-dots" style="font-style: italic;">${docSoTien(grandTotal)}</span>
                  </div>
                  <div class="dotted-row">
                    <span class="row-label">Kèm theo:</span>
                    <span class="row-dots">${data.items ? data.items.length : 0} chứng từ gốc:</span>
                  </div>
                </div>

                <div style="text-align: right; font-style: italic; font-size: 12pt; margin-top: 15px;">
                  Hà Nội, ${dateStr}
                </div>

                <div class="signatures-block">
                  ${sigsHtml}
                </div>
                
                ${bottomNote}
              </div>
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi hệ thống khi in chứng từ.");
    }
  };

  // ── Screen 2 State (Modal Form) ─────────────────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    document_no: '',
    document_date: new Date().toISOString().split('T')[0],
    customer_id: '',
    partner_name: '',
    partner_address: '',
    description: '',
  });

  const [items, setItems] = useState<VoucherItem[]>([]);

  // ── Alert Messages ──────────────────────────────────────────────────
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const { setHeaderActions } = useMenu();

  // ── Quick Add States ────────────────────────────────────────────────
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [isAddMaterialOpen, setIsAddMaterialOpen] = useState(false);

  const [quickAddAccountIndex, setQuickAddAccountIndex] = useState<number | null>(null);
  const [quickAddAccountField, setQuickAddAccountField] = useState<'debit_account' | 'credit_account' | null>(null);
  const [quickAddMaterialIndex, setQuickAddMaterialIndex] = useState<number | null>(null);

  // ── Defaults for accounts ───────────────────────────────────────────
  const getDefaultAccounts = useCallback(() => {
    if (type === 'payment') return { debit_account: '', credit_account: '1111' };
    if (type === 'receipt') return { debit_account: '1111', credit_account: '' };
    if (type === 'debit_advice') return { debit_account: '', credit_account: '11211' };
    if (type === 'credit_advice') return { debit_account: '11211', credit_account: '' };
    return { debit_account: '', credit_account: '' };
  }, [type]);

  // ── Fetch Summary data ─────────────────────────────────────────────
  const fetchVouchers = useCallback(async () => {
    setVouchersLoading(true);
    setMessage('');
    try {
      const res = await fetch(`/api/vouchers/financial?type=${type}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setVouchers(data);
      } else {
        setMessage('Không thể tải danh sách chứng từ');
        setMessageType('error');
      }
    } catch {
      setMessage('Lỗi kết nối máy chủ');
      setMessageType('error');
    } finally {
      setVouchersLoading(false);
    }
  }, [type]);

  useEffect(() => {
    fetchVouchers();
  }, [fetchVouchers]);

  // ── Grid Operations ────────────────────────────────────────────────
  const addRow = () => {
    const defaults = getDefaultAccounts();
    setItems([...items, {
      material_id: '',
      description: '',
      debit_account: defaults.debit_account,
      credit_account: defaults.credit_account,
      amount: '',
      tax_percent: '10',
      tax_amount: '0',
      total_amount: '0',
      transaction_code: ''
    }]);
  };

  const removeRow = (index: number) => {
    if (items.length <= 1) {
      const defaults = getDefaultAccounts();
      setItems([{
        material_id: '',
        description: '',
        debit_account: defaults.debit_account,
        credit_account: defaults.credit_account,
        amount: '',
        tax_percent: '10',
        tax_amount: '0',
        total_amount: '0',
        transaction_code: ''
      }]);
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof VoucherItem, value: string) => {
    const newItems = [...items];
    const nextItem = { ...newItems[index], [field]: value };

    // Auto-fill details if material changes
    if (field === 'material_id') {
      const mat = localMaterials.find(m => m.id.toString() === value);
      if (mat) {
        nextItem.description = mat.name;
        nextItem.amount = mat.unit_price.toString();
      }
    }

    // Auto recalculate tax amount and total
    const amt = parseFloat(nextItem.amount) || 0;
    const taxRate = parseFloat(nextItem.tax_percent) || 0;
    const taxAmt = amt * (taxRate / 100);
    const total = amt + taxAmt;

    nextItem.tax_amount = taxAmt.toString();
    nextItem.total_amount = total.toString();

    newItems[index] = nextItem;
    setItems(newItems);
  };

  // ── Open Form Handlers ──────────────────────────────────────────────
  const handleLineTransactionChange = (index: number, codeVal: string) => {
    const tx = transactionsList.find(t => t.transaction_code === codeVal);
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      transaction_code: codeVal,
      debit_account: tx ? (tx.debit_account || newItems[index].debit_account) : newItems[index].debit_account,
      credit_account: tx ? (tx.credit_account || newItems[index].credit_account) : newItems[index].credit_account,
    };
    setItems(newItems);
  };

  const openAddModal = async () => {
    setIsEditMode(false);
    setEditingId(null);
    setFormData({
      document_no: 'Đang tải...',
      document_date: new Date().toISOString().split('T')[0],
      customer_id: '',
      partner_name: '',
      partner_address: '',
      description: `Giao dịch ${title.toLowerCase()}`,
    });

    const defaults = getDefaultAccounts();
    setItems([{
      material_id: '',
      description: '',
      debit_account: defaults.debit_account,
      credit_account: defaults.credit_account,
      amount: '',
      tax_percent: '10',
      tax_amount: '0',
      total_amount: '0',
      transaction_code: ''
    }]);

    setIsModalOpen(true);
    setMessage('');

    try {
      const res = await fetch(`/api/vouchers/financial/next-no?type=${type}`);
      if (res.ok) {
        const nextNoData = await res.json();
        setFormData(prev => ({ ...prev, document_no: nextNoData.document_no }));
      }
    } catch (e) {
      console.error(e);
      setFormData(prev => ({ ...prev, document_no: '' }));
    }
  };

  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setHeaderActions(
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input 
            type="text" 
            placeholder="Tìm kiếm..."
            className="input-glass"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ 
              paddingLeft: '32px',
              paddingRight: searchQuery ? '28px' : '10px',
              height: '38px',
              fontSize: '13.5px',
              width: '240px',
              background: 'rgba(15, 23, 42, 0.4)'
            }}
          />
          <span style={{ 
            position: 'absolute', 
            left: '10px', 
            top: '50%', 
            transform: 'translateY(-50%)', 
            opacity: 0.5,
            fontSize: '13px',
            pointerEvents: 'none'
          }}>🔍</span>
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
                fontSize: '12px',
                padding: '2px'
              }}
            >
              ✕
            </button>
          )}
        </div>
        <button 
          className="btn-primary" 
          style={{ width: 'auto', background: 'linear-gradient(135deg, var(--primary-color), var(--primary-hover))', border: 'none', height: '38px', display: 'flex', alignItems: 'center', gap: '6px' }} 
          onClick={openAddModal}
        >
          ➕ Thêm mới
        </button>
      </div>
    );
    return () => setHeaderActions(null);
  }, [setHeaderActions, searchQuery]);

  const openEditModal = async (v: Voucher) => {
    setIsEditMode(true);
    setEditingId(v.id);
    setFormData({
      document_no: v.document_no,
      document_date: new Date(v.document_date).toISOString().split('T')[0],
      customer_id: v.customer_id ? v.customer_id.toString() : '',
      partner_name: v.partner_name,
      partner_address: v.partner_address,
      description: v.description,
    });
    setIsModalOpen(true);
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch(`/api/vouchers/financial/${v.id}`, { cache: 'no-store' });
      if (res.ok) {
        const details = await res.json();
        setItems(details.items.map((item: any) => ({
          material_id: item.material_id ? item.material_id.toString() : '',
          description: item.description || '',
          debit_account: item.debit_account || '',
          credit_account: item.credit_account || '',
          amount: item.amount ? item.amount.toString() : '',
          tax_percent: item.tax_percent ? item.tax_percent.toString() : '0',
          tax_amount: item.tax_amount ? item.tax_amount.toString() : '0',
          total_amount: item.total_amount ? item.total_amount.toString() : '0',
          transaction_code: item.transaction_code || '',
        })));
      } else {
        setMessage('Không thể tải chi tiết chứng từ');
        setMessageType('error');
      }
    } catch {
      setMessage('Lỗi kết nối máy chủ');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number, docNo: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa chứng từ [${docNo}]?`)) return;
    try {
      const res = await fetch(`/api/vouchers/financial/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setMessage('Xóa chứng từ thành công!');
        setMessageType('success');
        fetchVouchers();
      } else {
        const err = await res.json();
        setMessage(err.error || 'Lỗi khi xóa chứng từ');
        setMessageType('error');
      }
    } catch {
      setMessage('Lỗi kết nối máy chủ');
      setMessageType('error');
    }
  };

  const handleCustomerChange = (idVal: string) => {
    setFormData(prev => ({ ...prev, customer_id: idVal }));
    const cust = localCustomers.find(c => c.id.toString() === idVal);
    if (cust) {
      setFormData(prev => ({
        ...prev,
        partner_name: cust.name,
        partner_address: cust.address || '',
      }));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.document_no) {
      setMessage('Vui lòng nhập số chứng từ');
      setMessageType('error');
      return;
    }

    const validItems = items.filter(i => (parseFloat(i.amount) || 0) > 0);
    if (validItems.length === 0) {
      setMessage('Vui lòng thêm ít nhất một dòng giao dịch có số tiền lớn hơn 0.');
      setMessageType('error');
      return;
    }

    // Check account codes
    for (let i = 0; i < validItems.length; i++) {
      const line = validItems[i];
      if (!line.debit_account || !line.credit_account) {
        setMessage(`Dòng số ${i + 1} cần chọn đủ cả Tài khoản Nợ và Tài khoản Có.`);
        setMessageType('error');
        return;
      }
    }

    setSaving(true);
    setMessage('');

    const payload = {
      ...formData,
      type,
      items: validItems
    };

    try {
      const url = isEditMode ? `/api/vouchers/financial/${editingId}` : '/api/vouchers/financial';
      const method = isEditMode ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setMessage(isEditMode ? 'Cập nhật chứng từ thành công!' : 'Tạo mới chứng từ thành công!');
        setMessageType('success');
        setIsModalOpen(false);
        fetchVouchers();
      } else {
        const err = await res.json();
        setMessage(err.error || 'Có lỗi xảy ra khi lưu chứng từ');
        setMessageType('error');
      }
    } catch {
      setMessage('Không thể kết nối máy chủ');
      setMessageType('error');
    } finally {
      setSaving(false);
    }
  };

  // ── Quick Add Success Handlers ──────────────────────────────────────
  const handleAddCustSuccess = (newCust: any) => {
    setLocalCustomers(prev => [...prev, newCust]);
    setFormData(prev => ({
      ...prev,
      customer_id: newCust.id.toString(),
      partner_name: newCust.name,
      partner_address: newCust.address || ""
    }));
  };

  const handleAddMatSuccess = (newMat: any) => {
    setLocalMaterials(prev => [...prev, newMat]);
    if (quickAddMaterialIndex !== null) {
      updateItem(quickAddMaterialIndex, 'material_id', newMat.id.toString());
      setQuickAddMaterialIndex(null);
    }
  };

  const handleAddAccountSuccess = (newAcc: any) => {
    const mapped: Account = {
      account_code: newAcc.account_code,
      account_name: newAcc.account_name
    };
    setLocalAccounts(prev => [...prev, mapped]);
    if (quickAddAccountIndex !== null && quickAddAccountField) {
      updateItem(quickAddAccountIndex, quickAddAccountField, newAcc.account_code);
      setQuickAddAccountIndex(null);
      setQuickAddAccountField(null);
    }
  };

  // ── Calculation Helpers ─────────────────────────────────────────────
  const formatNumber = (num: any) => {
    const val = Number(num);
    if (isNaN(val) || val === 0) return '-';
    return new Intl.NumberFormat('vi-VN').format(val);
  };

  const fmtNum = (num: any) => {
    const val = Number(num);
    if (isNaN(val) || val === 0) return <span style={{ color: 'var(--text-muted)' }}>-</span>;
    return new Intl.NumberFormat('vi-VN').format(val);
  };

  const formatPrice = (price: string | number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(price));
  };

  const getSubtotal = () => items.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const getTaxTotal = () => items.reduce((s, r) => s + (parseFloat(r.tax_amount) || 0), 0);
  const getGrandTotal = () => getSubtotal() + getTaxTotal();

  const filteredVouchers = vouchers.filter(v => 
    v.document_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (v.partner_name && v.partner_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (v.customer_name && v.customer_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (v.description && v.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (v.transaction_code && v.transaction_code.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalGrandAmount = filteredVouchers.reduce((s, r) => s + (Number(r.grand_total) || 0), 0);

  return (
    <div className="customers-container animate-fade-in" style={{ paddingBottom: '40px' }}>

      {/* ── Alert message ────────────────────────────────────────────── */}
      {message && (
        <div style={{
          marginBottom: '20px', padding: '12px 18px', borderRadius: '8px',
          fontSize: '14px', fontWeight: 500,
          background: messageType === 'success' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
          border: messageType === 'success' ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(239,68,68,0.3)',
          color: messageType === 'success' ? '#10b981' : '#ef4444'
        }}>
          {message}
        </div>
      )}

      {/* ── Summary List View ────────────────────────────────────────── */}
      <div className="glass-panel" style={{ overflowX: 'auto', padding: '24px', borderRadius: '16px' }}>
        {vouchersLoading ? (
          <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', fontSize: '24px', marginRight: '10px' }}>⏳</span>
            Đang tải dữ liệu chứng từ...
          </div>
        ) : (
          <table className="voucher-detail-table" style={{ width: '100%', minWidth: '1000px' }}>
            <thead>
              <tr>
                <th style={{ width: '40px' }}></th>
                <th style={{ width: '50px', textAlign: 'center' }}>#</th>
                <th style={{ width: '120px' }}>Số chứng từ</th>
                <th style={{ width: '120px', textAlign: 'center' }}>Ngày chứng từ</th>
                <th style={{ minWidth: '220px' }}>Đối tượng giao dịch</th>
                <th style={{ minWidth: '220px' }}>Diễn giải chung</th>
                <th style={{ width: '100px', textAlign: 'center' }}>Số dòng</th>
                <th style={{ width: '160px', textAlign: 'right' }}>Tổng thanh toán</th>
                <th className="th-actions" style={{ width: '120px' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredVouchers.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '48px', marginBottom: '12px' }}>💸</div>
                    <div>Chưa lập {title.toLowerCase()} nào</div>
                    <div style={{ fontSize: '12px', marginTop: '6px', opacity: 0.6 }}>Nhấn <strong>➕ Lập {title.toLowerCase()} mới</strong> để bắt đầu nhập liệu</div>
                  </td>
                </tr>
              ) : (
                <>
                  {filteredVouchers.map((item, idx) => {
                    const isExpanded = expandedVouchers[item.id] !== undefined;
                    const itemsList = expandedVouchers[item.id] || [];
                    const isLoading = loadingVoucherId === item.id;
                    return (
                      <React.Fragment key={item.id}>
                        <tr 
                          onClick={() => toggleExpand(item.id)}
                          style={{ cursor: 'pointer', transition: 'background 0.2s' }}
                        >
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ 
                              display: 'inline-block', 
                              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', 
                              transition: 'transform 0.2s',
                              fontSize: '10px',
                              color: 'var(--primary-color)'
                            }}>
                              ▶
                            </span>
                          </td>
                          <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }} onClick={e => e.stopPropagation()}>{idx + 1}</td>
                          <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#60a5fa', fontSize: '13px' }} onClick={e => e.stopPropagation()}>
                            <div>{item.document_no}</div>
                            {item.transaction_code && (
                              <span style={{ 
                                display: 'inline-block', 
                                fontSize: '10.5px', 
                                color: '#34d399', 
                                background: 'rgba(52, 211, 153, 0.12)', 
                                padding: '1px 5px',
                                borderRadius: '3px',
                                marginTop: '4px',
                                fontWeight: 'normal',
                                fontFamily: 'sans-serif'
                              }}>
                                {item.transaction_code}
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center', fontSize: '13px' }} onClick={e => e.stopPropagation()}>
                            {new Intl.DateTimeFormat('vi-VN').format(new Date(item.document_date))}
                          </td>
                          <td style={{ fontSize: '13px', color: 'var(--text-main)' }} onClick={e => e.stopPropagation()}>
                            {item.partner_name || item.customer_name || <em style={{ opacity: 0.4 }}>-</em>}
                          </td>
                          <td style={{ fontSize: '13px', color: 'var(--text-muted)' }} onClick={e => e.stopPropagation()}>{item.description}</td>
                          <td style={{ textAlign: 'center', fontSize: '13px', fontWeight: 600 }} onClick={e => e.stopPropagation()}>{item.item_count}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981', fontSize: '13.5px', paddingRight: '14px' }} onClick={e => e.stopPropagation()}>
                            {formatPrice(item.grand_total)}
                          </td>
                          <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                            <div className="action-btn-group">
                              <button
                                className="action-btn-icon action-btn-edit"
                                onClick={() => openEditModal(item)}
                                title="Sửa chứng từ"
                              >✏️</button>
                              <button
                                className="action-btn-icon action-btn-secondary"
                                onClick={() => handlePrint(item)}
                                title="In chứng từ"
                              >🖨️</button>
                              <button
                                className="action-btn-icon action-btn-delete"
                                onClick={() => handleDelete(item.id, item.document_no)}
                                title="Xóa chứng từ"
                              >🗑️</button>
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr onClick={e => e.stopPropagation()}>
                            <td colSpan={9} style={{ padding: '12px 24px', background: 'rgba(15, 23, 42, 0.4)' }}>
                              <div className="animate-fade-in" style={{ padding: '8px 0' }}>
                                <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                  Chi tiết định khoản & giao dịch ({item.item_count} dòng)
                                </h4>
                                {isLoading && itemsList.length === 0 ? (
                                  <div style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '13px' }}>Đang tải chi tiết...</div>
                                ) : itemsList.length === 0 ? (
                                  <div style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '13px' }}>Không có chi tiết giao dịch</div>
                                ) : (
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                    <thead>
                                      <tr style={{ background: 'rgba(59, 130, 246, 0.08)' }}>
                                        <th style={{ padding: '8px 10px', textAlign: 'left', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)', fontWeight: 600 }}>Nội dung / Diễn giải chi tiết</th>
                                        <th style={{ padding: '8px 10px', textAlign: 'center', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)', fontWeight: 600, width: '90px' }}>TK Nợ</th>
                                        <th style={{ padding: '8px 10px', textAlign: 'center', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)', fontWeight: 600, width: '90px' }}>TK Có</th>
                                        <th style={{ padding: '8px 10px', textAlign: 'right', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)', fontWeight: 600, width: '130px' }}>Số tiền</th>
                                        <th style={{ padding: '8px 10px', textAlign: 'center', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)', fontWeight: 600, width: '70px' }}>Thuế VAT</th>
                                        <th style={{ padding: '8px 10px', textAlign: 'right', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)', fontWeight: 600, width: '110px' }}>Tiền thuế</th>
                                        <th style={{ padding: '8px 10px', textAlign: 'right', color: '#60a5fa', border: '1px solid rgba(255,255,255,0.08)', fontWeight: 600, width: '140px' }}>Thành tiền</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {itemsList.map((det, idxD) => (
                                        <tr key={idxD} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'transparent' }}>
                                          <td style={{ padding: '8px 10px', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.06)' }}>
                                            {det.transaction_code && (
                                              <span style={{ 
                                                display: 'inline-block', 
                                                fontSize: '10px', 
                                                color: '#34d399', 
                                                background: 'rgba(52, 211, 153, 0.12)', 
                                                padding: '1px 5px',
                                                borderRadius: '3px',
                                                marginRight: '8px',
                                                fontWeight: 'bold',
                                                fontFamily: 'monospace'
                                              }}>
                                                {det.transaction_code}
                                              </span>
                                            )}
                                            {det.description || <span style={{ color: 'var(--text-muted)' }}>-</span>}
                                          </td>
                                          <td style={{ padding: '8px 10px', textAlign: 'center', color: '#f59e0b', fontFamily: 'monospace', fontWeight: 600, border: '1px solid rgba(255,255,255,0.06)' }}>
                                            {det.debit_account || ''}
                                          </td>
                                          <td style={{ padding: '8px 10px', textAlign: 'center', color: '#f59e0b', fontFamily: 'monospace', fontWeight: 600, border: '1px solid rgba(255,255,255,0.06)' }}>
                                            {det.credit_account || ''}
                                          </td>
                                          <td style={{ padding: '8px 10px', textAlign: 'right', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.06)' }}>
                                            {new Intl.NumberFormat('vi-VN').format(Number(det.amount))}
                                          </td>
                                          <td style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                            {det.tax_percent}%
                                          </td>
                                          <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                            {new Intl.NumberFormat('vi-VN').format(Number(det.tax_amount))}
                                          </td>
                                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: '#10b981', border: '1px solid rgba(255,255,255,0.06)' }}>
                                            {new Intl.NumberFormat('vi-VN').format(Number(det.total_amount))}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}

                  {/* Summary Grand Row */}
                  <tr style={{ background: 'rgba(255,255,255,0.03)', borderTop: '2px solid rgba(255,255,255,0.08)', fontWeight: 700 }}>
                    <td colSpan={7} style={{ padding: '12px 14px', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Tổng cộng tiền thu chi báo nợ báo có
                    </td>
                    <td style={{ textAlign: 'right', padding: '12px 14px', color: '#10b981', fontSize: '15px' }}>
                      {formatPrice(totalGrandAmount)}
                    </td>
                    <td />
                  </tr>
                </>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Screen 2 Entry Form Modal Portal ─────────────────────────── */}
      {isModalOpen && typeof document !== 'undefined' && createPortal((
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9000,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
          display: 'flex', flexDirection: 'column',
          animation: 'fadeInModal 0.2s ease',
          overflow: 'hidden',
          height: '100vh'
        }}>
          {/* Modal Container */}
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            background: 'linear-gradient(160deg, rgba(10,18,40,0.98) 0%, rgba(15,23,55,0.98) 100%)',
            borderTop: '2px solid rgba(99,102,241,0.4)',
          }}>
            {/* Header */}
            <div style={{
              padding: '20px 40px',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              flexShrink: 0,
              background: 'rgba(0,0,0,0.2)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '10px',
                  background: 'linear-gradient(135deg, var(--primary-color), var(--primary-hover))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px'
                }}>
                  {isEditMode ? '✏️' : '➕'}
                </div>
                <div>
                  <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#e2e8f0', margin: 0 }}>
                    {isEditMode ? `Cập nhật ${title.toLowerCase()}` : `Lập ${title.toLowerCase()} mới`}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                    Nhập thông tin đối tượng, các dòng chi tiết tài khoản nợ có và số tiền giao dịch
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--text-muted)', cursor: 'pointer', fontSize: '20px',
                  width: '40px', height: '40px', borderRadius: '10px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.15)'; (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}
              >×</button>
            </div>

            {/* Modal Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '30px 40px' }}>
              
              {/* Metadata Inputs */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '20px', 
                background: 'rgba(255,255,255,0.02)', 
                padding: '24px', 
                borderRadius: '16px', 
                border: '1px solid rgba(255,255,255,0.05)',
                marginBottom: '24px',
                maxWidth: '1400px'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                      Ngày chứng từ *
                    </label>
                    <DateInput
                      required
                      value={formData.document_date}
                      onChange={val => setFormData(prev => ({ ...prev, document_date: val }))}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                      Số chứng từ *
                    </label>
                    <input 
                      type="text" 
                      className="input-glass"
                      required
                      value={formData.document_no}
                      onChange={e => setFormData(prev => ({ ...prev, document_no: e.target.value }))}
                      style={{ padding: '10px 14px' }}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                    Đối tượng giao dịch
                  </label>
                  <LookupSelect 
                    lookupKey="customer"
                    value={formData.customer_id}
                    onChange={handleCustomerChange}
                    placeholder="-- Chọn đối tượng khách hàng --"
                    onQuickAdd={() => setIsAddCustomerOpen(true)}
                  />
                </div>

                <div className="form-group">
                  <label style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                    Địa chỉ đối tượng
                  </label>
                  <input 
                    type="text" 
                    className="input-glass"
                    value={formData.partner_address}
                    onChange={e => setFormData(prev => ({ ...prev, partner_address: e.target.value }))}
                    placeholder="Địa chỉ giao dịch"
                    style={{ padding: '10px 14px' }}
                  />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                    Diễn giải chung
                  </label>
                  <input 
                    type="text" 
                    className="input-glass"
                    value={formData.description}
                    onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Nội dung diễn giải chung cho cả chứng từ"
                    style={{ padding: '10px 14px' }}
                  />
                </div>
              </div>

              {/* Detail transaction grid */}
              {loading ? (
                <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', fontSize: '24px', marginRight: '10px' }}>⏳</span>
                  Đang tải chi tiết chứng từ...
                </div>
              ) : (
                <div style={{ maxWidth: '1400px', background: 'rgba(255,255,255,0.01)', borderRadius: '16px', padding: '20px', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ overflowX: 'auto', minHeight: '320px' }}>
                    <table className="voucher-detail-table" style={{ width: '100%', minWidth: '1150px', position: 'relative', zIndex: 2 }}>
                      <thead>
                        <tr>
                          <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                          <th style={{ width: '180px' }}>Loại giao dịch</th>
                          <th style={{ minWidth: '220px' }}>Nội dung</th>
                          <th style={{ width: '120px' }}>TK Nợ</th>
                          <th style={{ width: '120px' }}>TK Có</th>
                          <th style={{ width: '130px', textAlign: 'right' }}>Tiền</th>
                          <th style={{ width: '90px', textAlign: 'center' }}>% Thuế</th>
                          <th style={{ width: '130px', textAlign: 'right' }}>Tiền Thuế</th>
                          <th style={{ width: '130px', textAlign: 'right' }}>Thành tiền</th>
                          <th style={{ width: '40px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, index) => {
                          const mat = localMaterials.find(m => m.id.toString() === item.material_id);
                          const amt = parseFloat(item.amount) || 0;
                          const taxAmt = parseFloat(item.tax_amount) || 0;
                          const lineTotal = parseFloat(item.total_amount) || 0;

                          return (
                            <tr key={index}>
                              <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                                {index + 1}
                              </td>
                              <td>
                                <LookupSelect 
                                  lookupKey="transaction"
                                  value={item.transaction_code || ''}
                                  onChange={val => handleLineTransactionChange(index, val)}
                                  placeholder="-- Chọn giao dịch --"
                                />
                              </td>
                              <td>
                                <input 
                                  type="text"
                                  className="input-glass"
                                  value={item.description}
                                  onChange={e => updateItem(index, 'description', e.target.value)}
                                  placeholder="Nội dung dòng"
                                  style={{ width: '100%', padding: '6px 10px', fontSize: '13px' }}
                                />
                              </td>
                              <td>
                                <LookupSelect 
                                  lookupKey="leaf_account"
                                  value={item.debit_account}
                                  onChange={val => updateItem(index, 'debit_account', val)}
                                  placeholder="Nợ --"
                                  showValueOnly={true}
                                  onQuickAdd={() => {
                                    setQuickAddAccountIndex(index);
                                    setQuickAddAccountField('debit_account');
                                    setIsAddAccountOpen(true);
                                  }}
                                />
                              </td>
                              <td>
                                <LookupSelect 
                                  lookupKey="leaf_account"
                                  value={item.credit_account}
                                  onChange={val => updateItem(index, 'credit_account', val)}
                                  placeholder="Có --"
                                  showValueOnly={true}
                                  onQuickAdd={() => {
                                    setQuickAddAccountIndex(index);
                                    setQuickAddAccountField('credit_account');
                                    setIsAddAccountOpen(true);
                                  }}
                                />
                              </td>
                              <td>
                                <input 
                                  type="number"
                                  className="input-glass voucher-input-num"
                                  value={item.amount}
                                  onChange={e => updateItem(index, 'amount', e.target.value)}
                                  placeholder="0"
                                  min="0"
                                  style={{ textAlign: 'right', padding: '6px 10px', fontSize: '13px' }}
                                />
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <select 
                                  className="input-glass"
                                  value={item.tax_percent}
                                  onChange={e => updateItem(index, 'tax_percent', e.target.value)}
                                  style={{ padding: '6px 8px', fontSize: '12.5px', background: 'var(--input-bg)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: 'var(--text-main)', cursor: 'pointer' }}
                                >
                                  <option value="0">0%</option>
                                  <option value="5">5%</option>
                                  <option value="8">8%</option>
                                  <option value="10">10%</option>
                                </select>
                              </td>
                              <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '13px', paddingRight: '10px' }}>
                                {taxAmt > 0 ? formatNumber(taxAmt) : '-'}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600, color: '#10b981', fontSize: '13px', paddingRight: '10px' }}>
                                {lineTotal > 0 ? formatNumber(lineTotal) : '-'}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button 
                                  type="button"
                                  onClick={() => removeRow(index)}
                                  style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '18px', padding: '2px' }}
                                  title="Xóa dòng"
                                >
                                  &times;
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Grid Buttons */}
                  <div style={{ marginTop: '20px', position: 'relative', zIndex: 1 }}>
                    <button 
                      type="button"
                      className="btn-secondary" 
                      onClick={addRow}
                      style={{ padding: '8px 24px', fontSize: '13px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                      ➕ Thêm dòng
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 40px', borderTop: '1px solid rgba(255,255,255,0.07)',
              display: 'flex', gap: '28px', justifyContent: 'flex-end', alignItems: 'center',
              flexShrink: 0, background: 'rgba(0,0,0,0.25)'
            }}>
              <div style={{ flex: 1, display: 'flex', gap: '32px', justifyContent: 'flex-end', alignItems: 'center', color: 'var(--text-muted)' }}>
                <div>
                  <span style={{ fontSize: '13px', marginRight: '6px' }}>Tiền hàng:</span>
                  <span style={{ color: 'var(--text-main)', fontSize: '15px', fontWeight: 600 }}>
                    {formatPrice(getSubtotal())}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '13px', marginRight: '6px' }}>Tiền thuế:</span>
                  <span style={{ color: '#fca5a5', fontSize: '15px', fontWeight: 600 }}>
                    {formatPrice(getTaxTotal())}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '13px', marginRight: '6px' }}>Tổng thanh toán:</span>
                  <span style={{ color: '#10b981', fontSize: '18px', fontWeight: 700 }}>
                    {formatPrice(getGrandTotal())}
                  </span>
                </div>
              </div>
              
              <button 
                className="btn-secondary" 
                onClick={() => setIsModalOpen(false)} 
                style={{ padding: '11px 28px', fontSize: '14px', background: 'transparent' }}
              >
                Hủy bỏ
              </button>
              <button
                className="btn-primary"
                style={{ width: 'auto', padding: '11px 32px', fontSize: '14px', background: 'linear-gradient(135deg, var(--primary-color), var(--primary-hover))', border: 'none', fontWeight: 600 }}
                onClick={handleSave}
                disabled={saving || loading}
              >
                {saving ? '⏳ Đang lưu...' : '💾 Lưu chứng từ'}
              </button>
            </div>

          </div>
        </div>
      ), document.body)}

      {/* ── Quick Add Modals ──────────────────────────────────────────── */}
      <QuickAddCustomerModal
        isOpen={isAddCustomerOpen}
        onClose={() => setIsAddCustomerOpen(false)}
        onSuccess={handleAddCustSuccess}
      />
      <QuickAddMaterialModal
        isOpen={isAddMaterialOpen}
        onClose={() => setIsAddMaterialOpen(false)}
        onSuccess={handleAddMatSuccess}
      />
      <QuickAddAccountModal
        isOpen={isAddAccountOpen}
        onClose={() => setIsAddAccountOpen(false)}
        onSuccess={handleAddAccountSuccess}
      />

      <style>{`
        @keyframes fadeInModal {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .voucher-detail-table tr:focus-within {
          position: relative;
          z-index: 50;
        }
        .voucher-detail-table tr:focus-within td {
          position: relative;
          z-index: 50;
        }
      `}</style>
    </div>
  );
}
