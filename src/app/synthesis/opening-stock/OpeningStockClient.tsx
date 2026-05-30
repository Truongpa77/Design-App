"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import '../../customers/customers.css';
import '../../vouchers/voucher.css';
import { 
  LookupSelect, 
  QuickAddMaterialModal,
  DateInput
} from "@/components/LookupSelect";
import { useMenu } from '@/components/MenuProvider';

interface Warehouse {
  id: number;
  warehouse_code: string;
  warehouse_name: string;
}

interface Material {
  id: number;
  material_code: string | null;
  name: string;
  unit: string;
  unit_price: number;
  type: string;
}

interface InitialStockItem {
  material_id: string;
  quantity: string;
  unit_price: string;
}

interface OpeningStockSummary {
  warehouse_code: string;
  warehouse_name: string;
  opening_date: string;
  total_items: number;
  total_value: number;
}

export default function OpeningStockClient({
  warehouses,
  materials,
}: {
  warehouses: Warehouse[];
  materials: Material[];
}) {
  const [localMaterials, setLocalMaterials] = useState<Material[]>(materials);
  
  const { setHeaderActions } = useMenu();
  
  // ── Summary list state (Screen 1) ──────────────────────────────────
  const [summaryList, setSummaryList] = useState<OpeningStockSummary[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // ── Entry form state (Screen 2 - Modal) ───────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [openingDate, setOpeningDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<InitialStockItem[]>([{ material_id: '', quantity: '', unit_price: '' }]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Feedback Messages ──────────────────────────────────────────────
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');

  // ── Quick Add Modal State ──────────────────────────────────────────
  const [isAddMatOpen, setIsAddMatOpen] = useState(false);
  const [quickAddMatIndex, setQuickAddMatIndex] = useState<number | null>(null);

  // ── Fetch Summary data ─────────────────────────────────────────────
  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/synthesis/opening-stock', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setSummaryList(data);
      } else {
        setMessage('Không thể tải danh sách tổng hợp tồn kho đầu kỳ');
        setMessageType('error');
      }
    } catch {
      setMessage('Lỗi kết nối máy chủ');
      setMessageType('error');
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // ── Form operations ────────────────────────────────────────────────
  const openAddModal = () => {
    setIsEditMode(false);
    setSelectedWarehouse('');
    setOpeningDate(new Date().toISOString().split('T')[0]);
    setItems([{ material_id: '', quantity: '', unit_price: '' }]);
    setIsModalOpen(true);
    setMessage('');
  };

  useEffect(() => {
    setHeaderActions(
      <button 
        className="btn-primary" 
        style={{ width: 'auto', background: 'linear-gradient(135deg, var(--primary-color), var(--primary-hover))', border: 'none', padding: '10px 24px' }} 
        onClick={openAddModal}
      >
        ➕ Thêm mới
      </button>
    );
    return () => setHeaderActions(null);
  }, [setHeaderActions]);

  const openEditModal = async (summary: OpeningStockSummary) => {
    setIsEditMode(true);
    setSelectedWarehouse(summary.warehouse_code);
    setOpeningDate(new Date(summary.opening_date).toISOString().split('T')[0]);
    setIsModalOpen(true);
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch(`/api/synthesis/opening-stock?warehouse_code=${summary.warehouse_code}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          setItems(data.map((item: any) => ({
            material_id: item.material_id.toString(),
            quantity: item.quantity.toString(),
            unit_price: item.unit_price.toString(),
          })));
        } else {
          setItems([{ material_id: '', quantity: '', unit_price: '' }]);
        }
      } else {
        setMessage('Không thể tải chi tiết kho bãi');
        setMessageType('error');
      }
    } catch {
      setMessage('Lỗi kết nối máy chủ');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (warehouseCode: string) => {
    if (!confirm(`Xóa toàn bộ tồn kho đầu kỳ của kho [${warehouseCode}]?`)) return;
    try {
      const res = await fetch(`/api/synthesis/opening-stock?warehouse_code=${warehouseCode}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setMessage('Xóa tồn kho đầu kỳ thành công!');
        setMessageType('success');
        fetchSummary();
      } else {
        const err = await res.json();
        setMessage(err.error || 'Có lỗi xảy ra khi xóa');
        setMessageType('error');
      }
    } catch {
      setMessage('Lỗi kết nối máy chủ');
      setMessageType('error');
    }
  };

  const addRow = () => {
    setItems([...items, { material_id: '', quantity: '', unit_price: '' }]);
  };

  const removeRow = (index: number) => {
    if (items.length <= 1) {
      setItems([{ material_id: '', quantity: '', unit_price: '' }]);
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof InitialStockItem, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    // Tự điền đơn giá mặc định khi chọn vật tư
    if (field === 'material_id') {
      const mat = localMaterials.find(m => m.id.toString() === value);
      if (mat) {
        newItems[index].unit_price = mat.unit_price.toString();
      }
    }
    setItems(newItems);
  };

  const handleWarehouseChange = (code: string) => {
    // Kiểm tra nếu kho này đã được lập số dư ở danh sách tổng hợp
    if (!isEditMode && summaryList.some(s => s.warehouse_code === code)) {
      alert(`Kho bãi này đã được lập số dư đầu kỳ. Vui lòng chọn kho khác hoặc chỉnh sửa kho đã lập từ danh sách.`);
      setSelectedWarehouse('');
      return;
    }
    setSelectedWarehouse(code);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarehouse) {
      setMessage('Vui lòng chọn kho bãi trước khi lưu');
      setMessageType('error');
      return;
    }

    const validItems = items.filter(i => i.material_id && Number(i.quantity) > 0);
    if (validItems.length === 0) {
      setMessage('Vui lòng chọn Vật tư và nhập số lượng lớn hơn 0.');
      setMessageType('error');
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/synthesis/opening-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouse_code: selectedWarehouse,
          opening_date: openingDate,
          items: validItems.map(i => ({
            material_id: Number(i.material_id),
            quantity: Number(i.quantity),
            unit_price: Number(i.unit_price || 0),
          }))
        })
      });

      if (res.ok) {
        setMessage('Lưu số dư tồn kho thành công!');
        setMessageType('success');
        setIsModalOpen(false);
        fetchSummary();
      } else {
        const errData = await res.json();
        setMessage(errData.error || 'Có lỗi xảy ra khi lưu số dư');
        setMessageType('error');
      }
    } catch {
      setMessage('Không thể kết nối máy chủ');
      setMessageType('error');
    } finally {
      setSaving(false);
    }
  };

  // ── Quick Add Material ──────────────────────────────────────────────
  const handleAddMatSuccess = (newMat: any) => {
    setLocalMaterials(prev => [...prev, newMat]);
    if (quickAddMatIndex !== null) {
      updateItem(quickAddMatIndex, "material_id", newMat.id.toString());
      updateItem(quickAddMatIndex, "unit_price", newMat.unit_price.toString());
      setQuickAddMatIndex(null);
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────
  const formatPrice = (price: string | number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(price));
  };

  const formatNumber = (num: any) => {
    return new Intl.NumberFormat('vi-VN').format(Number(num));
  };

  const formatDateStr = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat('vi-VN').format(date);
    } catch {
      return dateStr;
    }
  };

  const getGrandTotal = () => {
    return items.reduce((sum, item) => {
      const qty = Number(item.quantity || 0);
      const price = Number(item.unit_price || 0);
      return sum + qty * price;
    }, 0);
  };

  const summaryTotalValue = summaryList.reduce((s, r) => s + (Number(r.total_value) || 0), 0);

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
        {summaryLoading ? (
          <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', fontSize: '24px', marginRight: '10px' }}>⏳</span>
            Đang tải dữ liệu tổng hợp...
          </div>
        ) : (
          <table className="voucher-detail-table" style={{ width: '100%', minWidth: '950px' }}>
            <thead>
              <tr>
                <th style={{ width: '50px', textAlign: 'center' }}>#</th>
                <th style={{ width: '120px' }}>Mã Kho</th>
                <th style={{ minWidth: '220px' }}>Tên Kho bãi</th>
                <th style={{ width: '150px', textAlign: 'center' }}>Ngày đầu kỳ</th>
                <th style={{ width: '150px', textAlign: 'center' }}>Tổng số mặt hàng</th>
                <th style={{ width: '200px', textAlign: 'right' }}>Tổng giá trị tồn kho</th>
                <th className="th-actions" style={{ width: '120px' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {summaryList.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '48px', marginBottom: '12px' }}>📦</div>
                    <div>Chưa khai báo tồn kho đầu kỳ cho kho bãi nào</div>
                    <div style={{ fontSize: '12px', marginTop: '6px', opacity: 0.6 }}>Nhấn <strong>➕ Lập tồn kho đầu kỳ</strong> để bắt đầu khai báo</div>
                  </td>
                </tr>
              ) : (
                <>
                  {summaryList.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>{idx + 1}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#60a5fa', fontSize: '13px' }}>
                        {item.warehouse_code}
                      </td>
                      <td style={{ fontSize: '13px', color: 'var(--text-main)' }}>{item.warehouse_name}</td>
                      <td style={{ textAlign: 'center', fontSize: '13px' }}>{formatDateStr(item.opening_date)}</td>
                      <td style={{ textAlign: 'center', fontSize: '13px', fontWeight: 600 }}>{item.total_items}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981', fontSize: '13.5px', paddingRight: '14px' }}>
                        {formatPrice(item.total_value)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div className="action-btn-group">
                          <button
                            className="action-btn-icon action-btn-edit"
                            title="Sửa"
                            onClick={() => openEditModal(item)}
                          >✏️</button>
                          <button
                            className="action-btn-icon action-btn-delete"
                            title="Xóa"
                            onClick={() => handleDelete(item.warehouse_code)}
                          >🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {/* Summary Grand Row */}
                  <tr style={{ background: 'rgba(255,255,255,0.03)', borderTop: '2px solid rgba(255,255,255,0.08)', fontWeight: 700 }}>
                    <td colSpan={5} style={{ padding: '12px 14px', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Tổng cộng giá trị tồn kho hệ thống
                    </td>
                    <td style={{ textAlign: 'right', padding: '12px 14px', color: '#10b981', fontSize: '15px' }}>
                      {formatPrice(summaryTotalValue)}
                    </td>
                    <td />
                  </tr>
                </>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Entry Form Modal Portal ─────────────────────────────────── */}
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
                    {isEditMode ? 'Sửa tồn kho đầu kỳ' : 'Lập tồn kho đầu kỳ mới'}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                    Chọn kho bãi, ngày bắt đầu và cập nhật danh sách sản phẩm vật tư đầu kỳ
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
              
              {/* Meta selectors (Warehouse & Date) */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1.5fr 1fr', 
                gap: '24px', 
                background: 'rgba(255,255,255,0.02)', 
                padding: '24px', 
                borderRadius: '16px', 
                border: '1px solid rgba(255,255,255,0.05)',
                marginBottom: '24px',
                maxWidth: '1400px'
              }}>
                <div className="voucher-field-group">
                  <label style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                    Chọn Kho bãi *
                  </label>
                  <select 
                    className="input-glass" 
                    required
                    value={selectedWarehouse}
                    onChange={e => handleWarehouseChange(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px' }}
                    disabled={isEditMode}
                  >
                    <option value="">-- Chọn kho bãi --</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.warehouse_code}>
                        {w.warehouse_code} - {w.warehouse_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="voucher-field-group">
                  <label style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                    Ngày đầu kỳ *
                  </label>
                  <DateInput
                    required
                    value={openingDate}
                    onChange={val => setOpeningDate(val)}
                  />
                </div>
              </div>

              {/* Detail Items Grid */}
              {loading ? (
                <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', fontSize: '24px', marginRight: '10px' }}>⏳</span>
                  Đang tải chi tiết tồn kho...
                </div>
              ) : (
                <div style={{ maxWidth: '1400px', background: 'rgba(255,255,255,0.01)', borderRadius: '16px', padding: '20px', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ overflowX: 'auto', minHeight: '300px' }}>
                    <table className="voucher-detail-table" style={{ width: '100%', minWidth: '950px', position: 'relative', zIndex: 2 }}>
                      <thead>
                        <tr>
                          <th style={{ width: '40px' }}>#</th>
                          <th style={{ width: '120px' }}>Mã sản phẩm / VT</th>
                          <th style={{ minWidth: '250px' }}>Sản phẩm / Vật tư</th>
                          <th style={{ width: '100px', textAlign: 'center' }}>Đơn vị</th>
                          <th style={{ width: '120px', textAlign: 'right' }}>Số lượng</th>
                          <th style={{ width: '160px', textAlign: 'right' }}>Đơn giá đầu kỳ</th>
                          <th style={{ width: '180px', textAlign: 'right' }}>Thành tiền</th>
                          <th style={{ width: '45px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, index) => {
                          const mat = localMaterials.find(m => m.id.toString() === item.material_id);
                          const qty = Number(item.quantity) || 0;
                          const price = Number(item.unit_price) || 0;
                          const lineAmount = qty * price;

                          return (
                            <tr key={index} className={item.material_id ? '' : 'voucher-empty-row'}>
                              <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                                {index + 1}
                              </td>
                              <td>
                                <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary-color)', fontSize: '13px' }}>
                                  {mat?.material_code || '-'}
                                </span>
                              </td>
                              <td>
                                <LookupSelect
                                  lookupKey="material"
                                  value={item.material_id}
                                  onChange={val => updateItem(index, 'material_id', val)}
                                  placeholder="-- Chọn sản phẩm/vật tư --"
                                  disabled={!selectedWarehouse}
                                  onQuickAdd={() => {
                                    setQuickAddMatIndex(index);
                                    setIsAddMatOpen(true);
                                  }}
                                />
                              </td>
                              <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                                {mat?.unit || '-'}
                              </td>
                              <td>
                                <input 
                                  type="number" 
                                  className="input-glass voucher-input-num"
                                  placeholder="0"
                                  min="0"
                                  step="0.01"
                                  value={item.quantity}
                                  onChange={e => updateItem(index, 'quantity', e.target.value)}
                                  style={{ textAlign: 'right', padding: '6px 10px' }}
                                  disabled={!selectedWarehouse}
                                />
                              </td>
                              <td>
                                <input 
                                  type="number" 
                                  className="input-glass voucher-input-num"
                                  placeholder="0"
                                  min="0"
                                  value={item.unit_price}
                                  onChange={e => updateItem(index, 'unit_price', e.target.value)}
                                  style={{ textAlign: 'right', padding: '6px 10px' }}
                                  disabled={!selectedWarehouse}
                                />
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600, color: '#10b981', fontSize: '13px' }}>
                                {lineAmount > 0 ? formatNumber(lineAmount) + ' đ' : '-'}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button 
                                  type="button"
                                  onClick={() => removeRow(index)}
                                  style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '18px', padding: '2px' }}
                                  title="Xóa dòng"
                                  disabled={!selectedWarehouse}
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
                      style={{ padding: '8px 24px', fontSize: '13px', background: 'rgba(255,255,255,0.03)' }}
                      disabled={!selectedWarehouse}
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
              display: 'flex', gap: '12px', justifyContent: 'flex-end', alignItems: 'center',
              flexShrink: 0, background: 'rgba(0,0,0,0.25)'
            }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Tổng trị giá tồn:</span>
                <span style={{ color: '#10b981', fontSize: '18px', fontWeight: 700 }}>
                  {formatPrice(getGrandTotal())}
                </span>
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
                disabled={saving || loading || !selectedWarehouse}
              >
                {saving ? '⏳ Đang lưu...' : '💾 Lưu số dư'}
              </button>
            </div>

          </div>
        </div>
      ), document.body)}

      {/* ── Quick Add Modal ──────────────────────────────────────────── */}
      <QuickAddMaterialModal 
        isOpen={isAddMatOpen} 
        onClose={() => setIsAddMatOpen(false)} 
        onSuccess={handleAddMatSuccess} 
      />

      {/* Styles for animations and grid overlap z-index */}
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
