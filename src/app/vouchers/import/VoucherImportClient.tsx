"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import "../../customers/customers.css";
import "../voucher.css";
import { useMenu } from "@/components/MenuProvider";
import { 
  LookupSelect, 
  QuickAddCustomerModal, 
  QuickAddMaterialModal,
  DateInput
} from "@/components/LookupSelect";

interface Material {
  id: number;
  material_code: string | null;
  name: string;
  unit: string;
  unit_price: number;
}

interface Warehouse {
  id: number;
  warehouse_code: string;
  warehouse_name: string;
}

interface Customer {
  id: number;
  name: string;
  phone: string;
  address: string;
}

interface VoucherItem {
  material_id: string;
  warehouse_code: string;
  quantity: string;
  unit_price: string;
  tax_percent: string;
  line_amount: number;
  total_price: number;
}

interface Voucher {
  id: number;
  document_no: string;
  document_date: string;
  partner_name: string;
  partner_address: string;
  subtotal_amount: number;
  tax_amount: number;
  total_amount: number;
  item_count: number;
}

const emptyItem = (): VoucherItem => ({
  material_id: '',
  warehouse_code: '',
  quantity: '',
  unit_price: '',
  tax_percent: '5',
  line_amount: 0,
  total_price: 0,
});

const emptyHeader = () => ({
  document_no: '',
  document_date: new Date().toISOString().split('T')[0],
  customer_id: '',
  partner_name: '',
  partner_address: '',
  description: '',
});

export default function VoucherImportClient({
  initialData,
  materials,
  warehouses,
  customers,
}: {
  initialData: Voucher[];
  materials: Material[];
  warehouses: Warehouse[];
  customers: Customer[];
}) {
  const [vouchers, setVouchers] = useState<Voucher[]>(initialData);
  const [searchQuery, setSearchQuery] = useState('');
  const [localCustomers, setLocalCustomers] = useState<Customer[]>(customers);
  const [localMaterials, setLocalMaterials] = useState<Material[]>(materials);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingNo, setLoadingNo] = useState(false);
  const [error, setError] = useState('');

  const { setHeaderActions } = useMenu();

  const filteredVouchers = vouchers.filter(v => 
    v.document_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (v.partner_name && v.partner_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const [isAddCustOpen, setIsAddCustOpen] = useState(false);
  const [isAddMatOpen, setIsAddMatOpen] = useState(false);
  const [quickAddMatIndex, setQuickAddMatIndex] = useState<number | null>(null);

  const handleAddCustSuccess = (newCust: any) => {
    setLocalCustomers(prev => [...prev, newCust]);
    setHeader(prev => ({
      ...prev,
      customer_id: newCust.id.toString(),
      partner_name: newCust.name,
      partner_address: newCust.address || ""
    }));
  };

  const handleAddMatSuccess = (newMat: any) => {
    setLocalMaterials(prev => [...prev, newMat]);
    if (quickAddMatIndex !== null) {
      updateItem(quickAddMatIndex, "material_id", newMat.id.toString());
      updateItem(quickAddMatIndex, "unit_price", newMat.unit_price.toString());
      setQuickAddMatIndex(null);
    }
  };

  const [header, setHeader] = useState(emptyHeader());
  const [items, setItems] = useState<VoucherItem[]>([emptyItem(), emptyItem(), emptyItem()]);
  const [expandedVouchers, setExpandedVouchers] = useState<{ [key: number]: any[] }>({});
  const [loadingVoucherId, setLoadingVoucherId] = useState<number | null>(null);

  const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

  const toggleExpand = async (id: number) => {
    if (expandedVouchers[id] !== undefined) {
      const next = { ...expandedVouchers };
      delete next[id];
      setExpandedVouchers(next);
    } else {
      setLoadingVoucherId(id);
      setExpandedVouchers(prev => ({ ...prev, [id]: [] }));
      try {
        const res = await fetch(`/api/vouchers/import/${id}`);
        if (res.ok) {
          const data = await res.json();
          setExpandedVouchers(prev => ({ ...prev, [id]: data.items || [] }));
        } else {
          const next = { ...expandedVouchers };
          delete next[id];
          setExpandedVouchers(next);
          alert('Không thể tải chi tiết phiếu nhập');
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

  const computeItem = (item: VoucherItem): VoucherItem => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unit_price) || 0;
    const tax = parseFloat(item.tax_percent) || 0;
    const line_amount = qty * price;
    const total_price = line_amount * (1 + tax / 100);
    return { ...item, line_amount, total_price };
  };

  const updateItem = (index: number, field: keyof VoucherItem, value: string) => {
    const newItems = [...items];
    const updated = { ...newItems[index], [field]: value };
    if (field === 'material_id') {
      const mat = localMaterials.find(m => m.id.toString() === value);
      if (mat) {
        updated.unit_price = mat.unit_price.toString();
        if (!updated.warehouse_code && warehouses.length > 0) {
          updated.warehouse_code = warehouses[0].warehouse_code;
        }
      }
    }
    newItems[index] = computeItem(updated);
    setItems(newItems);
  };

  const handleCustomerChange = (customerId: string) => {
    if (!customerId) {
      setHeader(h => ({ ...h, customer_id: '', partner_name: '', partner_address: '' }));
      return;
    }
    const cust = localCustomers.find(c => c.id.toString() === customerId);
    if (cust) {
      setHeader(h => ({
        ...h,
        customer_id: customerId,
        partner_name: cust.name,
        partner_address: cust.address || '',
      }));
    }
  };

  const addRow = () => setItems([...items, emptyItem()]);
  const removeRow = (i: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, idx) => idx !== i));
  };

  const subtotal = items.reduce((s, i) => s + i.line_amount, 0);
  const taxTotal = items.reduce((s, i) => s + (i.total_price - i.line_amount), 0);
  const grandTotal = subtotal + taxTotal;

  const openAdd = async () => {
    setEditingId(null);
    setError('');
    setLoadingNo(true);
    const h = emptyHeader();
    setHeader(h);
    setItems([emptyItem(), emptyItem(), emptyItem()]);
    setIsFormOpen(true);
    // Lay so phieu ke tiep
    try {
      const res = await fetch('/api/vouchers/import/next-no');
      if (res.ok) {
        const data = await res.json();
        setHeader(prev => ({ ...prev, document_no: data.document_no }));
      }
    } catch (e) { console.error(e); }
    finally { setLoadingNo(false); }
  };

  useEffect(() => {
    if (!isFormOpen) {
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
          <button className="btn-primary" style={{ width: 'auto', height: '38px', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={openAdd}>
            ➕ Thêm mới
          </button>
        </div>
      );
    } else {
      setHeaderActions(null);
    }
    return () => setHeaderActions(null);
  }, [setHeaderActions, isFormOpen, searchQuery]);

  const openEdit = async (v: Voucher) => {
    setEditingId(v.id);
    setError('');
    try {
      const res = await fetch(`/api/vouchers/import/${v.id}`);
      if (!res.ok) return alert('Khong the tai phieu');
      const data = await res.json();
      setHeader({
        document_no: data.document_no,
        document_date: new Date(data.document_date).toISOString().split('T')[0],
        customer_id: data.customer_id?.toString() || '',
        partner_name: data.partner_name || '',
        partner_address: data.partner_address || '',
        description: data.description || '',
      });
      const loadedItems = data.items.map((it: any): VoucherItem => computeItem({
        material_id: it.material_id?.toString() || '',
        warehouse_code: it.warehouse_code || '',
        quantity: it.quantity?.toString() || '0',
        unit_price: it.unit_price?.toString() || '0',
        tax_percent: it.tax_percent?.toString() || '0',
        line_amount: 0, total_price: 0,
      }));
      setItems(loadedItems.length > 0 ? loadedItems : [emptyItem()]);
      setIsFormOpen(true);
    } catch (e) { console.error(e); }
  };

  const closeForm = () => {
    setIsFormOpen(false);
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', window.location.pathname);
    }
  };

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const editId = params.get('edit_id');
      if (editId) {
        const idNum = parseInt(editId, 10);
        if (!isNaN(idNum)) {
          openEdit({ id: idNum } as any);
        }
      }
    }
  }, []);


  const handlePrint = async (v: Voucher) => {
    try {
      const res = await fetch(`/api/vouchers/import/${v.id}`);
      if (!res.ok) return alert("Không thể tải chi tiết phiếu nhập để in");
      const data = await res.json();

      const printWindow = window.open("", "_blank");
      if (printWindow) {
        let tableRowsHtml = "";
        let subtotal = 0;
        let totalTax = 0;
        let grandTotal = 0;

        (data.items || []).forEach((item: any, idx: number) => {
          const qty = Number(item.quantity || 0);
          const price = Number(item.unit_price || 0);
          const amt = qty * price;
          const taxRate = Number(item.tax_percent || 0);
          const taxAmt = amt * (taxRate / 100);
          const total = amt + taxAmt;

          subtotal += amt;
          totalTax += taxAmt;
          grandTotal += total;

          tableRowsHtml += `
            <tr>
              <td style="text-align: center;">${idx + 1}</td>
              <td style="font-family: monospace;">${item.material_code || ""}</td>
              <td>${item.material_name || item.name || ""}</td>
              <td style="text-align: center;">${item.material_unit || ""}</td>
              <td style="text-align: center; font-family: monospace;">${item.warehouse_code || ""}</td>
              <td class="num">${new Intl.NumberFormat('vi-VN').format(qty)}</td>
              <td class="num">${new Intl.NumberFormat('vi-VN').format(price)}</td>
              <td class="num">${new Intl.NumberFormat('vi-VN').format(amt)}</td>
              <td class="num" style="text-align: center;">${taxRate}%</td>
              <td class="num" style="font-weight: bold;">${new Intl.NumberFormat('vi-VN').format(total)}</td>
            </tr>
          `;
        });

        const dateObj = new Date(data.document_date);
        const dateStr = `Ngày ${dateObj.getDate()} tháng ${dateObj.getMonth() + 1} năm ${dateObj.getFullYear()}`;

        printWindow.document.write(`
          <html>
            <head>
              <title>Phiếu Nhập Kho - ${data.document_no || ""}</title>
              <style>
                body { font-family: 'Segoe UI', 'Inter', sans-serif; padding: 45px; color: #111; background: #fff; line-height: 1.4; }
                .header-container { display: flex; justify-content: space-between; margin-bottom: 30px; }
                .company-info { font-size: 13px; text-transform: uppercase; font-weight: bold; }
                .company-addr { font-size: 12px; font-weight: normal; text-transform: none; color: #555; margin-top: 4px; }
                .doc-template { font-size: 12px; font-weight: bold; text-align: right; }
                
                .title-block { text-align: center; margin-bottom: 25px; }
                .title-block h1 { font-size: 24px; font-weight: bold; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.05em; }
                .title-block .date { font-style: italic; font-size: 14px; margin-bottom: 5px; }
                .title-block .doc-no { font-size: 14px; font-weight: bold; font-family: monospace; }
                
                .info-table { width: 100%; margin-bottom: 25px; border-collapse: collapse; }
                .info-table td { padding: 6px 0; border: none; font-size: 14px; }
                .info-table td.label { width: 150px; font-weight: bold; vertical-align: top; }
                .info-table td.value { border-bottom: 1px dotted #ccc; }

                .print-table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px; }
                .print-table th, .print-table td { border: 1px solid #666; padding: 8px 6px; text-align: left; }
                .print-table th { background: #f0f2f5; font-weight: bold; font-size: 12px; text-transform: uppercase; color: #333; text-align: center; }
                .print-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
                
                .summary-block { display: flex; flex-direction: column; align-items: flex-end; margin-top: 20px; width: 100%; font-size: 14px; }
                .summary-row { display: flex; justify-content: flex-end; width: 340px; padding: 5px 0; }
                .summary-row span:first-child { flex: 1; text-align: right; padding-right: 15px; font-weight: bold; }
                .summary-row span:last-child { width: 150px; text-align: right; font-weight: bold; font-variant-numeric: tabular-nums; }
                .summary-total { border-top: 2px solid #333; padding-top: 6px; margin-top: 4px; font-size: 16px; }
                
                .signatures-container { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-top: 40px; font-size: 13px; text-align: center; }
                .signature-cell { display: flex; flex-direction: column; align-items: center; }
                .signature-cell .title { font-weight: bold; margin-bottom: 65px; }
                .signature-cell .subtitle { font-style: italic; font-size: 11px; color: #555; margin-top: -65px; margin-bottom: 50px; }
                .signature-cell .name { font-weight: bold; }
                
                .actions { margin-bottom: 25px; display: flex; gap: 10px; }
                .btn { padding: 8px 18px; border-radius: 6px; cursor: pointer; border: 1px solid #ccc; background: #f9f9f9; font-weight: bold; font-size: 13px; }
                .btn-primary { background: #2563eb; color: #fff; border-color: #2563eb; }
                @media print {
                  body { padding: 0; }
                  .no-print { display: none; }
                  @page { size: A4 landscape; margin: 1.2cm; }
                }
              </style>
            </head>
            <body>
              <div class="actions no-print">
                <button class="btn btn-primary" onclick="window.print()">🖨️ In Phiếu Nhập (Xuất PDF)</button>
                <button class="btn" onclick="window.close()">Đóng cửa sổ</button>
              </div>
              
              <div class="header-container">
                <div class="company-info">
                  CÔNG TY THIẾT KẾ NỘI THẤT TOÀN PHÁT
                  <div class="company-addr">Địa chỉ: Số 12, Phố Duy Tân, Cầu Giấy, Hà Nội</div>
                </div>
                <div class="doc-template">
                  Mẫu số 01-VT<br/>
                  (Ban hành theo Thông tư số 200/2014/TT-BTC)
                </div>
              </div>

              <div class="title-block">
                <h1>PHIẾU NHẬP KHO</h1>
                <div class="date">${dateStr}</div>
                <div class="doc-no">Số chứng từ: ${data.document_no}</div>
              </div>
              
              <table class="info-table">
                <tr>
                  <td class="label">Người giao hàng:</td>
                  <td class="value">${data.partner_name || data.customer_name || ""}</td>
                </tr>
                <tr>
                  <td class="label">Địa chỉ:</td>
                  <td class="value">${data.partner_address || ""}</td>
                </tr>
                <tr>
                  <td class="label">Lý do nhập kho:</td>
                  <td class="value">${data.description || ""}</td>
                </tr>
              </table>

              <table class="print-table">
                <thead>
                  <tr>
                    <th style="width: 40px; text-align: center;">STT</th>
                    <th style="width: 100px;">Mã vật tư</th>
                    <th>Tên vật tư, sản phẩm</th>
                    <th style="width: 60px; text-align: center;">ĐVT</th>
                    <th style="width: 70px; text-align: center;">Mã Kho</th>
                    <th style="width: 90px; text-align: right;">Số lượng</th>
                    <th style="width: 110px; text-align: right;">Đơn giá</th>
                    <th style="width: 120px; text-align: right;">Thành tiền</th>
                    <th style="width: 70px; text-align: center;">Thuế VAT</th>
                    <th style="width: 130px; text-align: right;">Cộng thanh toán</th>
                  </tr>
                </thead>
                <tbody>
                  ${tableRowsHtml}
                </tbody>
              </table>

              <div class="summary-block">
                <div class="summary-row">
                  <span>Tiền hàng trước thuế:</span>
                  <span>${new Intl.NumberFormat('vi-VN').format(subtotal)} đ</span>
                </div>
                <div class="summary-row">
                  <span>Thuế giá trị gia tăng:</span>
                  <span>${new Intl.NumberFormat('vi-VN').format(totalTax)} đ</span>
                </div>
                <div class="summary-row summary-total">
                  <span>Tổng tiền thanh toán:</span>
                  <span>${new Intl.NumberFormat('vi-VN').format(grandTotal)} đ</span>
                </div>
              </div>

              <div class="signatures-container">
                <div class="signature-cell">
                  <div class="title">Giám đốc</div>
                  <div class="subtitle">(Ký, họ tên, đóng dấu)</div>
                  <div class="name">................................................</div>
                </div>
                <div class="signature-cell">
                  <div class="title">Kế toán trưởng</div>
                  <div class="subtitle">(Ký, họ tên)</div>
                  <div class="name">................................................</div>
                </div>
                <div class="signature-cell">
                  <div class="title">Thủ kho</div>
                  <div class="subtitle">(Ký, họ tên)</div>
                  <div class="name">................................................</div>
                </div>
                <div class="signature-cell">
                  <div class="title">Người giao hàng</div>
                  <div class="subtitle">(Ký, họ tên)</div>
                  <div class="name">................................................</div>
                </div>
                <div class="signature-cell">
                  <div class="title">Người lập phiếu</div>
                  <div class="subtitle">(Ký, họ tên)</div>
                  <div class="name">................................................</div>
                </div>
              </div>
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi hệ thống khi in phiếu nhập kho.");
    }
  };

  const handleSave = async () => {
    const validItems = items.filter(i => i.material_id && parseFloat(i.quantity) > 0);
    if (validItems.length === 0) {
      setError('Vui long nhap it nhat 1 dong hang hop le');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const url = editingId ? `/api/vouchers/import/${editingId}` : '/api/vouchers/import';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...header, customer_id: header.customer_id || null, items: validItems }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Co loi'); return; }
      if (editingId) {
        setVouchers(vouchers.map(v => v.id === editingId ? data : v));
      } else {
        setVouchers([data, ...vouchers]);
      }
      closeForm();
    } catch (e) {
      setError('Khong the ket noi server');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="customers-container">

      {/* ---- DANH SACH PHIEU NHAP ---- */}
      {!isFormOpen && (
        <>
          <div className="glass-panel table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}></th>
                  <th>So Phieu</th>
                  <th>Ngay</th>
                  <th>Doi tuong</th>
                  <th style={{ textAlign: 'right' }}>Tien hang</th>
                  <th style={{ textAlign: 'right' }}>Thue</th>
                  <th style={{ textAlign: 'right' }}>Tong tien</th>
                  <th style={{ textAlign: 'center' }}>So dong</th>
                  <th className="th-actions">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredVouchers.map(v => {
                  const isExpanded = expandedVouchers[v.id] !== undefined;
                  const itemsList = expandedVouchers[v.id] || [];
                  const isLoading = loadingVoucherId === v.id;
                  return (
                    <React.Fragment key={v.id}>
                      <tr 
                        onClick={() => toggleExpand(v.id)} 
                        style={{ cursor: 'pointer', transition: 'background 0.2s' }}
                      >
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ 
                            display: 'inline-block', 
                            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', 
                            transition: 'transform 0.2s',
                            fontSize: '10px',
                            color: '#60a5fa'
                          }}>
                            ▶
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, color: '#60a5fa', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                            {v.document_no}
                          </span>
                        </td>
                        <td>{new Date(v.document_date).toLocaleDateString('vi-VN')}</td>
                        <td className="font-medium">{v.partner_name || '-'}</td>
                        <td style={{ textAlign: 'right' }}>{fmt(v.subtotal_amount || 0)}</td>
                        <td style={{ textAlign: 'right', color: '#f59e0b' }}>{fmt(v.tax_amount || 0)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>{fmt(v.total_amount || 0)}</td>
                        <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{v.item_count}</td>
                        <td onClick={e => e.stopPropagation()}>
                          <div className="action-btn-group">
                            <button className="action-btn-icon action-btn-edit" onClick={() => openEdit(v)} title="Sửa / Xem">
                              ✏️
                            </button>
                            <button className="action-btn-icon action-btn-secondary" onClick={() => handlePrint(v)} title="In phiếu">
                              🖨️
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr onClick={e => e.stopPropagation()}>
                          <td colSpan={9} style={{ padding: '12px 24px', background: 'rgba(15, 23, 42, 0.4)' }}>
                            <div className="animate-fade-in" style={{ padding: '8px 0' }}>
                              <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Chi tiết sản phẩm ({v.item_count} dòng)
                              </h4>
                              {isLoading && itemsList.length === 0 ? (
                                <div style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '13px' }}>Đang tải chi tiết...</div>
                              ) : itemsList.length === 0 ? (
                                <div style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '13px' }}>Không có chi tiết sản phẩm</div>
                              ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                  <thead>
                                    <tr style={{ background: 'rgba(59, 130, 246, 0.08)' }}>
                                      <th style={{ padding: '8px 10px', textAlign: 'left', color: '#60a5fa', border: '1px solid rgba(255,255,255,0.08)', fontWeight: 600 }}>Mã SP/Vt</th>
                                      <th style={{ padding: '8px 10px', textAlign: 'left', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)', fontWeight: 600 }}>Tên sản phẩm / Vật tư</th>
                                      <th style={{ padding: '8px 10px', textAlign: 'center', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)', fontWeight: 600 }}>Kho</th>
                                      <th style={{ padding: '8px 10px', textAlign: 'right', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)', fontWeight: 600 }}>Số lượng</th>
                                      <th style={{ padding: '8px 10px', textAlign: 'right', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)', fontWeight: 600 }}>Đơn giá</th>
                                      <th style={{ padding: '8px 10px', textAlign: 'right', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)', fontWeight: 600 }}>Tiền hàng</th>
                                      <th style={{ padding: '8px 10px', textAlign: 'center', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)', fontWeight: 600 }}>% Thuế</th>
                                      <th style={{ padding: '8px 10px', textAlign: 'right', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)', fontWeight: 600 }}>Thành tiền</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {itemsList.map((item, idx) => (
                                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                        <td style={{ padding: '8px 10px', color: '#60a5fa', fontFamily: 'monospace', border: '1px solid rgba(255,255,255,0.06)' }}>{item.material_code || '-'}</td>
                                        <td style={{ padding: '8px 10px', color: '#f8fafc', fontWeight: 500, border: '1px solid rgba(255,255,255,0.06)' }}>{item.material_name || item.name}</td>
                                        <td style={{ padding: '8px 10px', textAlign: 'center', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.06)' }}>{item.warehouse_code || '-'}</td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.06)' }}>
                                          {fmt(item.quantity)} {item.material_unit ? `(${item.material_unit})` : ''}
                                        </td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.06)' }}>{fmt(item.unit_price)}</td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.06)' }}>{fmt(Number(item.quantity) * Number(item.unit_price))}</td>
                                        <td style={{ padding: '8px 10px', textAlign: 'center', color: '#f59e0b', border: '1px solid rgba(255,255,255,0.06)' }}>{item.tax_percent}%</td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: '#10b981', border: '1px solid rgba(255,255,255,0.06)' }}>{fmt(item.total_price)}</td>
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
                {filteredVouchers.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-8 text-muted">Chua co phieu nhap nao</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ---- FORM PHIEU NHAP KHO ---- */}
      {isFormOpen && (
        <div className="voucher-form glass-panel">

          {/* Tieu de + nut */}
          <div className="voucher-form-header">
            <h2 className="voucher-title">PHIEU NHAP KHO</h2>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn-secondary" onClick={closeForm}>
                &larr; Quay lai
              </button>
              <button className="btn-primary" style={{ width: 'auto' }} onClick={handleSave} disabled={saving}>
                {saving ? 'Dang luu...' : (editingId ? 'Cap nhat' : 'Luu Phieu Nhap')}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ marginBottom: '16px', padding: '10px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#ef4444', fontSize: '14px' }}>
              {error}
            </div>
          )}

          {/* Header phieu */}
          <div className="voucher-meta">
            {/* Dong 1: Ngay + So phieu */}
            <div className="voucher-meta-row">
              <div className="voucher-field-group" style={{ maxWidth: '200px' }}>
                <label>Ngay</label>
                <DateInput
                  value={header.document_date}
                  onChange={val => setHeader({ ...header, document_date: val })}
                />
              </div>
              <div className="voucher-field-group" style={{ maxWidth: '200px' }}>
                <label>So Phieu</label>
                <input
                  className="input-glass voucher-input"
                  style={{ fontFamily: 'monospace', fontWeight: 700, color: '#60a5fa', letterSpacing: '0.06em' }}
                  value={loadingNo ? 'Dang tai...' : header.document_no}
                  placeholder="PN0001"
                  onChange={e => setHeader({ ...header, document_no: e.target.value })}
                  readOnly={loadingNo}
                />
              </div>
            </div>

            {/* Dong 2: Doi tuong (chon khach hang) - full width */}
            <div className="voucher-field-group" style={{ marginTop: '14px' }}>
              <label>Doi tuong (Khach hang / NCC)</label>
              <LookupSelect
                lookupKey="customer"
                value={header.customer_id}
                onChange={val => handleCustomerChange(val)}
                placeholder="-- Chọn khách hàng --"
                onQuickAdd={() => setIsAddCustOpen(true)}
              />
            </div>

            {/* Dong 3: Dia chi */}
            <div className="voucher-field-group" style={{ marginTop: '14px' }}>
              <label>Dia chi</label>
              <input className="input-glass voucher-input" placeholder="Dia chi..."
                value={header.partner_address}
                onChange={e => setHeader({ ...header, partner_address: e.target.value })} />
            </div>

            {/* Dong 4: Dien giai */}
            <div className="voucher-field-group" style={{ marginTop: '14px' }}>
              <label>Dien giai</label>
              <input className="input-glass voucher-input" placeholder="Noi dung dien giai, ghi chu them..."
                value={header.description}
                onChange={e => setHeader({ ...header, description: e.target.value })} />
            </div>
          </div>

          {/* Bang chi tiet */}
          <div style={{ overflowX: 'auto', marginTop: '24px', minHeight: '350px' }}>
            <table className="voucher-detail-table">
              <thead>
                <tr>
                  <th style={{ width: '36px' }}>#</th>
                  <th style={{ width: '100px' }}>Mã</th>
                  <th style={{ minWidth: '220px' }}>Ten SP / Vat tu</th>
                  <th style={{ width: '120px' }}>Ma Kho</th>
                  <th style={{ width: '90px' }}>So luong</th>
                  <th style={{ width: '130px' }}>Don gia</th>
                  <th style={{ width: '130px', textAlign: 'right' }}>Tien hang</th>
                  <th style={{ width: '70px', textAlign: 'center' }}>% Thue</th>
                  <th style={{ width: '140px', textAlign: 'right' }}>Thanh tien</th>
                  <th style={{ width: '36px' }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} className={item.material_id ? '' : 'voucher-empty-row'}>
                    <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                      {item.material_id ? idx + 1 : ''}
                    </td>
                    <td>
                      <span style={{ fontFamily: "monospace", fontWeight: 600, fontSize: "12px", color: '#60a5fa' }}>
                        {localMaterials.find(m => m.id.toString() === item.material_id)?.material_code || "-"}
                      </span>
                    </td>
                    <td>
                      <LookupSelect
                        lookupKey="material"
                        value={item.material_id}
                        onChange={val => updateItem(idx, 'material_id', val)}
                        placeholder="-- Chọn vật tư --"
                        onQuickAdd={() => {
                          setQuickAddMatIndex(idx);
                          setIsAddMatOpen(true);
                        }}
                      />
                    </td>
                    <td>
                      <select className="input-glass voucher-select" value={item.warehouse_code}
                        onChange={e => updateItem(idx, 'warehouse_code', e.target.value)}>
                        <option value="">-- Kho --</option>
                        {warehouses.map(w => (
                          <option key={w.id} value={w.warehouse_code}>{w.warehouse_code}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input type="number" min="0" className="input-glass voucher-input-num" placeholder="0"
                        value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} />
                    </td>
                    <td>
                      <input type="number" min="0" className="input-glass voucher-input-num" placeholder="0"
                        value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', e.target.value)} />
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 500 }}>
                      {item.line_amount > 0 ? fmt(item.line_amount) : ''}
                    </td>
                    <td>
                      <input type="number" min="0" max="100" className="input-glass voucher-input-num" placeholder="0"
                        value={item.tax_percent} onChange={e => updateItem(idx, 'tax_percent', e.target.value)} />
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#10b981' }}>
                      {item.total_price > 0 ? fmt(item.total_price) : ''}
                    </td>
                    <td>
                      {item.material_id && (
                        <button onClick={() => removeRow(idx)}
                          style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '18px', padding: '2px 6px', lineHeight: 1 }}>
                          &times;
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '12px' }}>
            <button className="btn-secondary" style={{ padding: '8px 20px', fontSize: '13px' }} onClick={addRow}>
              + Them dong
            </button>
          </div>

          {/* Tong ket */}
          <div className="voucher-summary">
            <div className="voucher-summary-row">
              <span>Tien hang</span>
              <span>{fmt(subtotal)}</span>
            </div>
            <div className="voucher-summary-row">
              <span>Tien thue</span>
              <span style={{ color: '#f59e0b' }}>{fmt(taxTotal)}</span>
            </div>
            <div className="voucher-summary-row voucher-summary-total">
              <span>Tong tien</span>
              <span style={{ color: '#10b981' }}>{fmt(grandTotal)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Modals */}
      <QuickAddCustomerModal 
        isOpen={isAddCustOpen} 
        onClose={() => setIsAddCustOpen(false)} 
        onSuccess={handleAddCustSuccess} 
      />
      <QuickAddMaterialModal 
        isOpen={isAddMatOpen} 
        onClose={() => setIsAddMatOpen(false)} 
        onSuccess={handleAddMatSuccess} 
      />
    </div>
  );
}
