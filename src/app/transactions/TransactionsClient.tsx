"use client";

import React, { useState, useEffect } from 'react';
import '../customers/customers.css';
import '../vouchers/voucher.css';
import { LookupSelect } from '@/components/LookupSelect';
import { useMenu } from '@/components/MenuProvider';

interface Transaction {
  id: number;
  transaction_code: string;
  transaction_name: string;
  debit_account: string | null;
  credit_account: string | null;
  is_active: boolean;
}

export default function TransactionsClient({
  initialData
}: {
  initialData: Transaction[];
}) {
  const [transactions, setTransactions] = useState<Transaction[]>(initialData);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const { setHeaderActions } = useMenu();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    transaction_code: '',
    transaction_name: '',
    debit_account: '',
    credit_account: ''
  });

  const fetchTransactions = async () => {
    try {
      const res = await fetch('/api/transactions');
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
      }
    } catch (e) {
      console.error('Error fetching transactions:', e);
    }
  };

  const openAdd = () => {
    setEditingId(null);
    setError('');
    setFormData({
      transaction_code: '',
      transaction_name: '',
      debit_account: '',
      credit_account: ''
    });
    setIsModalOpen(true);
  };

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
          style={{ 
            width: 'auto', 
            background: 'linear-gradient(135deg, #10b981, #059669)', 
            border: 'none',
            padding: '8px 16px',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            height: '38px'
          }} 
          onClick={openAdd}
        >
          ➕ Thêm giao dịch mới
        </button>
      </div>
    );
    return () => setHeaderActions(null);
  }, [setHeaderActions, searchQuery]);

  const openEdit = (t: Transaction) => {
    setEditingId(t.id);
    setError('');
    setFormData({
      transaction_code: t.transaction_code,
      transaction_name: t.transaction_name,
      debit_account: t.debit_account || '',
      credit_account: t.credit_account || ''
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.transaction_code || !formData.transaction_name) {
      setError('Vui lòng điền đầy đủ Mã giao dịch và Tên giao dịch');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const url = editingId ? `/api/transactions/${editingId}` : '/api/transactions';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          is_active: editingId ? transactions.find(t => t.id === editingId)?.is_active : true
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Có lỗi xảy ra');
        return;
      }
      await fetchTransactions();
      setIsModalOpen(false);
    } catch (e) {
      setError('Lỗi kết nối máy chủ');
    } finally {
      setSaving(false);
    }
  };

  const handleSoftDelete = async (id: number, code: string) => {
    if (!confirm(`Bạn có chắc chắn muốn ngừng kích hoạt mã giao dịch "${code}"?`)) return;
    try {
      const res = await fetch(`/api/transactions/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        await fetchTransactions();
      } else {
        const data = await res.json();
        alert(data.error || 'Không thể ngừng kích hoạt giao dịch');
      }
    } catch (e) {
      alert('Lỗi kết nối máy chủ');
    }
  };

  const handleReactivate = async (t: Transaction) => {
    try {
      const res = await fetch(`/api/transactions/${t.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...t,
          is_active: true
        })
      });
      if (res.ok) {
        await fetchTransactions();
      } else {
        const data = await res.json();
        alert(data.error || 'Không thể kích hoạt lại giao dịch');
      }
    } catch (e) {
      alert('Lỗi kết nối máy chủ');
    }
  };

  // Lọc tìm kiếm client-side
  const filteredTransactions = transactions.filter(t => 
    t.transaction_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.transaction_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="customers-container animate-fade-in" style={{ paddingBottom: '50px' }}>
      


      {/* Danh sách bảng */}
      <div className="glass-panel table-container" style={{ overflowX: 'auto', minHeight: '400px' }}>
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
              <th style={{ width: '150px', padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Mã giao dịch</th>
              <th style={{ minWidth: '250px', padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Tên giao dịch</th>
              <th style={{ width: '200px', padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'left' }}>Tài khoản Nợ</th>
              <th style={{ width: '200px', padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'left' }}>Tài khoản Có</th>
              <th style={{ width: '150px', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>Trạng thái</th>
              <th className="th-actions" style={{ width: '120px', padding: '14px 16px' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map(t => (
              <tr 
                key={t.id} 
                style={{ 
                  borderBottom: '1px solid rgba(255,255,255,0.04)', 
                  opacity: t.is_active ? 1 : 0.5,
                  background: !t.is_active ? 'rgba(255,255,255,0.005)' : undefined,
                  transition: 'all 0.15s ease'
                }}
              >
                {/* Mã giao dịch */}
                <td style={{ 
                  padding: '14px 16px', 
                  fontFamily: 'monospace', 
                  fontSize: '14px', 
                  fontWeight: 700,
                  color: t.is_active ? '#60a5fa' : 'var(--text-muted)'
                }}>
                  {t.transaction_code}
                </td>

                {/* Tên giao dịch */}
                <td style={{ 
                  padding: '14px 16px', 
                  fontWeight: 500,
                  color: t.is_active ? '#fff' : 'var(--text-muted)'
                }}>
                  {t.transaction_name}
                </td>

                {/* Tài khoản Nợ */}
                <td style={{ padding: '14px 16px', textAlign: 'left' }}>
                  {t.debit_account ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ 
                        fontFamily: 'monospace', 
                        fontSize: '12.5px',
                        background: 'rgba(59, 130, 246, 0.15)', 
                        color: '#60a5fa', 
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: 600
                      }}>
                        {t.debit_account}
                      </span>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic' }}>-- Chưa thiết lập --</span>
                  )}
                </td>

                {/* Tài khoản Có */}
                <td style={{ padding: '14px 16px', textAlign: 'left' }}>
                  {t.credit_account ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ 
                        fontFamily: 'monospace', 
                        fontSize: '12.5px',
                        background: 'rgba(16, 185, 129, 0.15)', 
                        color: '#10b981', 
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: 600
                      }}>
                        {t.credit_account}
                      </span>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic' }}>-- Chưa thiết lập --</span>
                  )}
                </td>

                {/* Trạng thái */}
                <td style={{ textAlign: 'center' }}>
                  {t.is_active ? (
                    <span style={{ 
                      padding: '3px 8px', 
                      borderRadius: '4px', 
                      fontSize: '11px', 
                      background: 'rgba(16, 185, 129, 0.15)', 
                      color: '#10b981', 
                      fontWeight: 600 
                    }}>
                      Kích hoạt
                    </span>
                  ) : (
                    <span style={{ 
                      padding: '3px 8px', 
                      borderRadius: '4px', 
                      fontSize: '11px', 
                      background: 'rgba(239, 68, 68, 0.15)', 
                      color: '#ef4444', 
                      fontWeight: 600 
                    }}>
                      Tạm ngưng
                    </span>
                  )}
                </td>

                {/* Thao tác */}
                <td style={{ padding: '8px 16px', textAlign: 'center' }}>
                  <div className="action-btn-group">
                    <button 
                      className="action-btn-icon action-btn-edit" 
                      title="Sửa"
                      onClick={() => openEdit(t)}
                    >
                      ✏️
                    </button>
                    {t.is_active ? (
                      <button 
                        className="action-btn-icon action-btn-delete" 
                        title="Ngừng kích hoạt"
                        onClick={() => handleSoftDelete(t.id, t.transaction_code)}
                      >
                        ⛔
                      </button>
                    ) : (
                      <button 
                        className="action-btn-icon action-btn-secondary" 
                        title="Kích hoạt lại"
                        style={{ color: '#10b981' }}
                        onClick={() => handleReactivate(t)}
                      >
                        ✔️
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredTransactions.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-muted">
                  Không tìm thấy danh mục giao dịch nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Thêm / Sửa danh mục giao dịch */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel animate-fade-in" style={{ maxWidth: '500px', width: '90vw' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#60a5fa', marginBottom: '16px' }}>
              {editingId ? `Sửa giao dịch: ${formData.transaction_code}` : 'Thêm giao dịch mới'}
            </h2>
            {error && (
              <div style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', marginBottom: '12px' }}>
                {error}
              </div>
            )}
            <form onSubmit={handleSave}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12.5px', marginBottom: '6px', display: 'block', fontWeight: 500 }}>Mã giao dịch *</label>
                <input 
                  required 
                  className="input-glass" 
                  placeholder="Ví dụ: 131, T20" 
                  value={formData.transaction_code} 
                  disabled={!!editingId}
                  onChange={e => setFormData({ ...formData, transaction_code: e.target.value })} 
                />
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12.5px', marginBottom: '6px', display: 'block', fontWeight: 500 }}>Tên giao dịch *</label>
                <input 
                  required 
                  className="input-glass" 
                  placeholder="Ví dụ: Bán hàng công nợ, Chi tiền mặt..." 
                  value={formData.transaction_name} 
                  onChange={e => setFormData({ ...formData, transaction_name: e.target.value })} 
                />
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12.5px', marginBottom: '6px', display: 'block', fontWeight: 500 }}>Tài khoản Nợ</label>
                <LookupSelect
                  lookupKey="account"
                  value={formData.debit_account}
                  onChange={val => setFormData({ ...formData, debit_account: val })}
                  placeholder="-- Chọn tài khoản nợ --"
                />
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '12.5px', marginBottom: '6px', display: 'block', fontWeight: 500 }}>Tài khoản Có</label>
                <LookupSelect
                  lookupKey="account"
                  value={formData.credit_account}
                  onChange={val => setFormData({ ...formData, credit_account: val })}
                  placeholder="-- Chọn tài khoản có --"
                />
              </div>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)} style={{ padding: '6px 14px', fontSize: '13px' }}>Hủy</button>
                <button type="submit" className="btn-primary" disabled={saving} style={{ width: 'auto', padding: '6px 16px', fontSize: '13px' }}>
                  {saving ? 'Đang lưu...' : 'Lưu lại'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
