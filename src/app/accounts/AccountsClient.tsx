"use client";

import React, { useState, useEffect } from 'react';
import '../../app/customers/customers.css';
import '../../app/vouchers/voucher.css';
import { LookupSelect } from '@/components/LookupSelect';
import { useMenu } from '@/components/MenuProvider';

interface Account {
  id: number;
  account_code: string;
  account_name: string;
  parent_code: string | null;
  track_foreign_currency: boolean;
  track_object_debt: boolean;
  track_project_cost: boolean;
  is_ledger: boolean;
  is_bank: boolean;
  is_long_term: boolean;
  debt_increase_side: string; // 'debit' hoặc 'credit'
  is_active: boolean;
}

export default function AccountsClient({
  initialAccounts
}: {
  initialAccounts: Account[];
}) {
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedCodes, setCollapsedCodes] = useState<Set<string>>(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const { setHeaderActions } = useMenu();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    account_code: '',
    account_name: '',
    parent_code: '',
    track_foreign_currency: false,
    track_object_debt: false,
    track_project_cost: false,
    is_ledger: false,
    is_bank: false,
    is_long_term: false,
    debt_increase_side: 'debit'
  });

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/accounts');
      if (res.ok) {
        const data = await res.json();
        setAccounts(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getLevel = (accCode: string) => {
    let level = 0;
    let curr = accounts.find(a => a.account_code === accCode);
    while (curr && curr.parent_code) {
      level++;
      curr = accounts.find(a => a.account_code === curr!.parent_code);
    }
    return level;
  };

  const hasChildren = (accCode: string) => {
    return accounts.some(a => a.parent_code === accCode);
  };

  const toggleCollapse = (code: string) => {
    const next = new Set(collapsedCodes);
    if (next.has(code)) {
      next.delete(code);
    } else {
      next.add(code);
    }
    setCollapsedCodes(next);
  };

  const isVisible = (acc: Account) => {
    let parent = acc.parent_code;
    while (parent) {
      if (collapsedCodes.has(parent)) return false;
      const pAcc = accounts.find(a => a.account_code === parent);
      parent = pAcc ? pAcc.parent_code : null;
    }
    return true;
  };

  const openAdd = () => {
    setEditingId(null);
    setError('');
    setFormData({
      account_code: '',
      account_name: '',
      parent_code: '',
      track_foreign_currency: false,
      track_object_debt: false,
      track_project_cost: false,
      is_ledger: false,
      is_bank: false,
      is_long_term: false,
      debt_increase_side: 'debit'
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
            height: '38px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }} 
          onClick={openAdd}
        >
          ➕ Thêm mới
        </button>
      </div>
    );
    return () => setHeaderActions(null);
  }, [setHeaderActions, searchQuery]);

  const openEdit = (acc: Account) => {
    setEditingId(acc.id);
    setError('');
    setFormData({
      account_code: acc.account_code,
      account_name: acc.account_name,
      parent_code: acc.parent_code || '',
      track_foreign_currency: acc.track_foreign_currency,
      track_object_debt: acc.track_object_debt,
      track_project_cost: acc.track_project_cost,
      is_ledger: acc.is_ledger,
      is_bank: acc.is_bank,
      is_long_term: acc.is_long_term,
      debt_increase_side: acc.debt_increase_side || 'debit'
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.account_code || !formData.account_name) {
      setError('Vui lòng điền đầy đủ Số hiệu và Tên tài khoản');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const url = editingId ? `/api/accounts/${editingId}` : '/api/accounts';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Có lỗi xảy ra');
        return;
      }
      await fetchAccounts();
      setIsModalOpen(false);
    } catch (e) {
      setError('Lỗi kết nối máy chủ');
    } finally {
      setSaving(false);
    }
  };

  const handleSoftDelete = async (id: number, code: string) => {
    if (!confirm(`Bạn có chắc chắn muốn đình chỉ hoạt động tài khoản "${code}" và toàn bộ tài khoản con của nó?`)) return;
    try {
      const res = await fetch(`/api/accounts/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        await fetchAccounts();
      } else {
        const data = await res.json();
        alert(data.error || 'Không thể đình chỉ tài khoản');
      }
    } catch (e) {
      alert('Lỗi kết nối máy chủ');
    }
  };

  const handleReactivate = async (acc: Account) => {
    try {
      const res = await fetch(`/api/accounts/${acc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...acc,
          is_active: true
        })
      });
      if (res.ok) {
        await fetchAccounts();
      } else {
        const data = await res.json();
        alert(data.error || 'Không thể kích hoạt lại tài khoản');
      }
    } catch (e) {
      alert('Lỗi kết nối máy chủ');
    }
  };

  const matchesSearch = (acc: Account): boolean => {
    if (!searchQuery) return true;
    const matchesSelf = 
      acc.account_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      acc.account_name.toLowerCase().includes(searchQuery.toLowerCase());
    if (matchesSelf) return true;
    
    const hasMatchingChild = accounts.some(child => {
      let p: string | null = child.parent_code;
      while (p) {
        if (p === acc.account_code) {
          return child.account_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                 child.account_name.toLowerCase().includes(searchQuery.toLowerCase());
        }
        const parentAcc = accounts.find(a => a.account_code === p);
        p = parentAcc ? parentAcc.parent_code : null;
      }
      return false;
    });
    return hasMatchingChild;
  };

  const activeAccounts = accounts.filter(acc => isVisible(acc) && matchesSearch(acc));

  return (
    <div className="customers-container animate-fade-in" style={{ paddingBottom: '50px' }}>
      
      {/* Lưới phân cấp tài khoản */}
      <div className="glass-panel table-container" style={{ overflowX: 'auto', minHeight: '400px' }}>
        <table className="data-table" style={{ width: '100%', minWidth: '1150px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
              <th style={{ width: '140px', padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Số hiệu tài khoản</th>
              <th style={{ minWidth: '250px', padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Tên tài khoản kế toán</th>
              <th style={{ width: '85px', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>Ngoại tệ</th>
              <th style={{ width: '85px', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>Công nợ đối tượng</th>
              <th style={{ width: '85px', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>Chi tiết công trình</th>
              <th style={{ width: '80px', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>Tk sổ cái</th>
              <th style={{ width: '80px', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>Tk ngân hàng</th>
              <th style={{ width: '80px', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>Tk dài hạn</th>
              <th style={{ width: '90px', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>Vế tăng</th>
              <th style={{ width: '120px', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>Trạng thái</th>
              <th className="th-actions" style={{ width: '160px', padding: '12px 16px' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {activeAccounts.map(acc => {
              const level = getLevel(acc.account_code);
              const isCollapsed = collapsedCodes.has(acc.account_code);
              const hasChilds = hasChildren(acc.account_code);

              return (
                <tr 
                  key={acc.id} 
                  style={{ 
                    borderBottom: '1px solid rgba(255,255,255,0.04)', 
                    opacity: acc.is_active ? 1 : 0.45,
                    background: !acc.is_active ? 'rgba(255,255,255,0.01)' : undefined,
                    transition: 'all 0.15s ease'
                  }}
                >
                  {/* Số hiệu tài khoản */}
                  <td style={{ 
                    padding: '10px 16px', 
                    fontFamily: 'monospace', 
                    fontSize: '13.5px', 
                    fontWeight: level === 0 ? 700 : (level === 1 ? 600 : 400),
                    color: level === 0 ? '#60a5fa' : (acc.is_active ? 'var(--text-main)' : 'var(--text-muted)')
                  }}>
                    {acc.account_code}
                  </td>

                  {/* Tên tài khoản kế toán - có thụt dòng */}
                  <td style={{ 
                    padding: '10px 16px', 
                    paddingLeft: `${16 + level * 22}px`,
                    fontWeight: level === 0 ? 700 : (level === 1 ? 600 : 400),
                    color: acc.is_active ? 'var(--text-main)' : 'var(--text-muted)',
                    userSelect: 'none'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {hasChilds ? (
                        <span 
                          onClick={() => toggleCollapse(acc.account_code)}
                          style={{ 
                            cursor: 'pointer', 
                            color: '#60a5fa', 
                            fontSize: '11px',
                            fontWeight: 'bold',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '14px',
                            height: '14px',
                            border: '1px solid rgba(96,165,250,0.4)',
                            borderRadius: '3px',
                            background: 'rgba(96,165,250,0.06)'
                          }}
                        >
                          {isCollapsed ? '+' : '−'}
                        </span>
                      ) : (
                        <span style={{ width: '14px' }}></span>
                      )}
                      <span>{acc.account_name}</span>
                    </div>
                  </td>

                  {/* Checkbox thuộc tính */}
                  <td style={{ textAlign: 'center' }}>
                    <input type="checkbox" checked={acc.track_foreign_currency} readOnly disabled style={{ transform: 'scale(1.1)', opacity: 0.8 }} />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <input type="checkbox" checked={acc.track_object_debt} readOnly disabled style={{ transform: 'scale(1.1)', opacity: 0.8 }} />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <input type="checkbox" checked={acc.track_project_cost} readOnly disabled style={{ transform: 'scale(1.1)', opacity: 0.8 }} />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <input type="checkbox" checked={acc.is_ledger} readOnly disabled style={{ transform: 'scale(1.1)', opacity: 0.8 }} />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <input type="checkbox" checked={acc.is_bank} readOnly disabled style={{ transform: 'scale(1.1)', opacity: 0.8 }} />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <input type="checkbox" checked={acc.is_long_term} readOnly disabled style={{ transform: 'scale(1.1)', opacity: 0.8 }} />
                  </td>

                  {/* Vế tăng */}
                  <td style={{ textAlign: 'center', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                    {acc.debt_increase_side === 'credit' ? (
                      <span style={{ color: '#ef4444', fontWeight: 600 }}>Có</span>
                    ) : (
                      <span style={{ color: '#60a5fa', fontWeight: 600 }}>Nợ</span>
                    )}
                  </td>

                  {/* Trạng thái */}
                  <td style={{ textAlign: 'center' }}>
                    {acc.is_active ? (
                      <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 500 }}>
                        Đang dùng
                      </span>
                    ) : (
                      <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontWeight: 500 }}>
                        Đình chỉ
                      </span>
                    )}
                  </td>

                  {/* Thao tác */}
                  <td style={{ padding: '8px 16px', textAlign: 'center' }}>
                    <div className="action-btn-group">
                      <button 
                        className="action-btn-icon action-btn-edit" 
                        title="Sửa"
                        onClick={() => openEdit(acc)}
                      >
                        ✏️
                      </button>
                      {acc.is_active ? (
                        <button 
                          className="action-btn-icon action-btn-delete" 
                          title="Đình chỉ"
                          onClick={() => handleSoftDelete(acc.id, acc.account_code)}
                        >
                          ⛔
                        </button>
                      ) : (
                        <button 
                          className="action-btn-icon action-btn-secondary" 
                          title="Kích hoạt"
                          onClick={() => handleReactivate(acc)}
                        >
                          ✔️
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal Thêm / Sửa tài khoản */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel animate-fade-in" style={{ maxWidth: '520px', width: '90vw' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#60a5fa', marginBottom: '16px' }}>
              {editingId ? `Sửa tài khoản: ${formData.account_code}` : 'Thêm tài khoản kế toán mới'}
            </h2>
            {error && (
              <div style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', marginBottom: '12px' }}>
                {error}
              </div>
            )}
            <form onSubmit={handleSave}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '12px', marginBottom: '12px' }}>
                <div className="form-group">
                  <label style={{ fontSize: '12px' }}>Số hiệu tài khoản *</label>
                  <input 
                    required 
                    className="input-glass" 
                    placeholder="Ví dụ: 1111" 
                    value={formData.account_code} 
                    onChange={e => setFormData({ ...formData, account_code: e.target.value })} 
                  />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '12px' }}>Tên tài khoản kế toán *</label>
                  <input 
                    required 
                    className="input-glass" 
                    placeholder="Tên gọi..." 
                    value={formData.account_name} 
                    onChange={e => setFormData({ ...formData, account_name: e.target.value })} 
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px' }}>Tài khoản cha</label>
                <LookupSelect
                  lookupKey="account"
                  value={formData.parent_code}
                  onChange={val => setFormData({ ...formData, parent_code: val })}
                  placeholder="-- Cấp cao nhất (Không có cha) --"
                />
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px' }}>Vế tăng công nợ (Nếu có)</label>
                <select 
                  className="input-glass" 
                  value={formData.debt_increase_side} 
                  onChange={e => setFormData({ ...formData, debt_increase_side: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px' }}
                >
                  <option value="debit">Nợ (Debit)</option>
                  <option value="credit">Có (Credit)</option>
                </select>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '20px' }}>
                <h4 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.04em' }}>
                  Thuộc tính của tài khoản
                </h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={formData.track_foreign_currency} onChange={e => setFormData({ ...formData, track_foreign_currency: e.target.checked })} />
                    Theo dõi ngoại tệ
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={formData.track_object_debt} onChange={e => setFormData({ ...formData, track_object_debt: e.target.checked })} />
                    Theo dõi công nợ đối tượng
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={formData.track_project_cost} onChange={e => setFormData({ ...formData, track_project_cost: e.target.checked })} />
                    Theo dõi chi tiết giá thành
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={formData.is_ledger} onChange={e => setFormData({ ...formData, is_ledger: e.target.checked })} />
                    Tài khoản sổ cái
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={formData.is_bank} onChange={e => setFormData({ ...formData, is_bank: e.target.checked })} />
                    Tài khoản ngân hàng
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={formData.is_long_term} onChange={e => setFormData({ ...formData, is_long_term: e.target.checked })} />
                    Tài khoản dài hạn
                  </label>
                </div>
              </div>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)} style={{ padding: '6px 14px', fontSize: '13px' }}>Hủy</button>
                <button type="submit" className="btn-primary" disabled={saving} style={{ width: 'auto', padding: '6px 16px', fontSize: '13px' }}>
                  {saving ? 'Đang lưu...' : 'Lưu tài khoản'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
