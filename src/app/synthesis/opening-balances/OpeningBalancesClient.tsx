"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import '../../customers/customers.css';
import '../../vouchers/voucher.css';
import {
  LookupSelect,
  QuickAddCustomerModal,
  QuickAddProjectModal,
  QuickAddAccountModal
} from "@/components/LookupSelect";
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
  is_active: boolean;
}

interface BalanceRecord {
  id?: number;
  account_code: string;
  account_name?: string;
  customer_id: string;
  customer_name?: string;
  project_item_id: string;
  project_item_name?: string;
  debit_balance: string;
  credit_balance: string;
  debit_balance_ytd: string;
  credit_balance_ytd: string;
}

const EMPTY_FORM: BalanceRecord = {
  account_code: '',
  customer_id: '',
  project_item_id: '',
  debit_balance: '',
  credit_balance: '',
  debit_balance_ytd: '',
  credit_balance_ytd: '',
};

export default function OpeningBalancesClient({
  activeAccounts,
}: {
  activeAccounts: Account[];
}) {
  const [localAccounts, setLocalAccounts] = useState<Account[]>(activeAccounts);

  const { setHeaderActions } = useMenu();

  // ── Data state ──────────────────────────────────────────────────────
  const [records, setRecords] = useState<BalanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');

  // ── Entry panel state ────────────────────────────────────────────────
  const [showPanel, setShowPanel] = useState(false);
  const [editingRecord, setEditingRecord] = useState<BalanceRecord>(EMPTY_FORM);
  const [editingIndex, setEditingIndex] = useState<number | null>(null); // null = new

  // ── Quick Add modals ─────────────────────────────────────────────────
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isAddProjectOpen, setIsAddProjectOpen] = useState(false);
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);

  // ── Helpers ──────────────────────────────────────────────────────────
  const fmtNum = (num: any) => {
    const val = Number(num);
    if (isNaN(val) || val === 0) return <span style={{ color: 'var(--text-muted)' }}>-</span>;
    return new Intl.NumberFormat('vi-VN').format(val);
  };

  const fmtSum = (field: keyof BalanceRecord) =>
    records.reduce((s, r) => s + (parseFloat(r[field] as string) || 0), 0);

  // ── Fetch saved balances ─────────────────────────────────────────────
  const fetchBalances = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/synthesis/opening-balances', { cache: 'no-store' });
      if (res.ok) {
        const data: any[] = await res.json();
        setRecords(data.map(d => ({
          id: d.id,
          account_code: d.account_code || '',
          account_name: d.account_name || '',
          customer_id: d.customer_id ? d.customer_id.toString() : '',
          customer_name: d.customer_name || '',
          project_item_id: d.project_item_id ? d.project_item_id.toString() : '',
          project_item_name: d.project_item_name || '',
          debit_balance: d.debit_balance ? d.debit_balance.toString() : '',
          credit_balance: d.credit_balance ? d.credit_balance.toString() : '',
          debit_balance_ytd: d.debit_balance_ytd ? d.debit_balance_ytd.toString() : '',
          credit_balance_ytd: d.credit_balance_ytd ? d.credit_balance_ytd.toString() : '',
        })));
      } else {
        setMessage('Không thể tải số dư đầu kỳ tài khoản');
        setMessageType('error');
      }
    } catch {
      setMessage('Lỗi kết nối máy chủ');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBalances(); }, [fetchBalances]);

  // ── Save ALL records (current records + edited/new) ──────────────────
  const saveAll = async (newRecords: BalanceRecord[]) => {
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/synthesis/opening-balances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: newRecords })
      });
      if (res.ok) {
        const data: any[] = await res.json();
        setRecords(data.map(d => ({
          id: d.id,
          account_code: d.account_code || '',
          account_name: d.account_name || '',
          customer_id: d.customer_id ? d.customer_id.toString() : '',
          customer_name: d.customer_name || '',
          project_item_id: d.project_item_id ? d.project_item_id.toString() : '',
          project_item_name: d.project_item_name || '',
          debit_balance: d.debit_balance ? d.debit_balance.toString() : '',
          credit_balance: d.credit_balance ? d.credit_balance.toString() : '',
          debit_balance_ytd: d.debit_balance_ytd ? d.debit_balance_ytd.toString() : '',
          credit_balance_ytd: d.credit_balance_ytd ? d.credit_balance_ytd.toString() : '',
        })));
        setMessage('Lưu số dư đầu kỳ thành công!');
        setMessageType('success');
        return true;
      } else {
        const err = await res.json();
        setMessage(err.error || 'Lỗi khi lưu dữ liệu');
        setMessageType('error');
        return false;
      }
    } catch {
      setMessage('Không thể kết nối máy chủ');
      setMessageType('error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  // ── Panel handlers ───────────────────────────────────────────────────
  const openAddPanel = () => {
    setEditingRecord({ ...EMPTY_FORM });
    setEditingIndex(null);
    setShowPanel(true);
  };

  useEffect(() => {
    setHeaderActions(
      <button
        className="btn-primary"
        style={{ width: 'auto', background: 'linear-gradient(135deg, var(--primary-color), var(--primary-hover))', border: 'none', padding: '10px 24px' }}
        onClick={openAddPanel}
        disabled={loading}
      >
        ➕ Thêm mới
      </button>
    );
    return () => setHeaderActions(null);
  }, [setHeaderActions, loading]);

  const openEditPanel = (rec: BalanceRecord, idx: number) => {
    setEditingRecord({ ...rec });
    setEditingIndex(idx);
    setShowPanel(true);
  };

  const closePanel = () => {
    setShowPanel(false);
    setEditingRecord({ ...EMPTY_FORM });
    setEditingIndex(null);
  };

  const updateFormField = (field: keyof BalanceRecord, value: string) => {
    const next = { ...editingRecord, [field]: value };
    if (field === 'account_code') {
      const acc = localAccounts.find(a => a.account_code === value);
      if (!acc || !acc.track_object_debt) next.customer_id = '';
      if (!acc || !acc.track_project_cost) next.project_item_id = '';
    }
    setEditingRecord(next);
  };

  const handlePanelSave = async () => {
    if (!editingRecord.account_code) {
      setMessage('Vui lòng chọn Tài khoản');
      setMessageType('error');
      return;
    }

    // Validate: At least one balance should be > 0
    const val1 = parseFloat(editingRecord.debit_balance) || 0;
    const val2 = parseFloat(editingRecord.credit_balance) || 0;
    const val3 = parseFloat(editingRecord.debit_balance_ytd) || 0;
    const val4 = parseFloat(editingRecord.credit_balance_ytd) || 0;
    if (val1 === 0 && val2 === 0 && val3 === 0 && val4 === 0) {
      setMessage('Vui lòng nhập ít nhất một giá trị số dư lớn hơn 0');
      setMessageType('error');
      return;
    }

    const newRecords = editingIndex === null
      ? [...records, editingRecord]
      : records.map((r, i) => i === editingIndex ? editingRecord : r);

    const ok = await saveAll(newRecords);
    if (ok) closePanel();
  };

  const handleDeleteRecord = async (idx: number) => {
    if (!confirm('Xóa dòng số dư này?')) return;
    const newRecords = records.filter((_, i) => i !== idx);
    await saveAll(newRecords);
  };

  // ── Determine field constraints ──────────────────────────────────────
  const formAccount = localAccounts.find(a => a.account_code === editingRecord.account_code);
  const isCustomerDisabled = !formAccount || !formAccount.track_object_debt;
  const isProjectDisabled = !formAccount || !formAccount.track_project_cost;

  // ── Quick Add success handlers ───────────────────────────────────────
  const handleAddCustomerSuccess = (c: any) => {
    updateFormField('customer_id', c.id.toString());
  };
  const handleAddProjectSuccess = (p: any) => {
    updateFormField('project_item_id', p.id.toString());
  };
  const handleAddAccountSuccess = (a: any) => {
    const mapped: Account = {
      id: a.id,
      account_code: a.account_code,
      account_name: a.account_name,
      parent_code: a.parent_code || null,
      track_foreign_currency: a.track_foreign_currency || false,
      track_object_debt: a.track_object_debt || false,
      track_project_cost: a.track_project_cost || false,
      is_ledger: a.is_ledger || false,
      is_bank: a.is_bank || false,
      is_active: a.is_active !== false,
    };
    setLocalAccounts(prev => [...prev, mapped]);
    updateFormField('account_code', a.account_code);
  };

  return (
    <div className="customers-container animate-fade-in" style={{ paddingBottom: '40px' }}>

      {/* ── Status message ───────────────────────────────────────────── */}
      {message && (
        <div style={{
          marginBottom: '16px', padding: '12px 18px', borderRadius: '8px',
          fontSize: '14px', fontWeight: 500,
          background: messageType === 'success' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
          border: messageType === 'success' ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(239,68,68,0.3)',
          color: messageType === 'success' ? '#10b981' : '#ef4444'
        }}>
          {message}
        </div>
      )}

      {/* ── Data Table ──────────────────────────────────────────────── */}
      <div className="glass-panel" style={{ overflowX: 'auto', padding: '24px', borderRadius: '16px' }}>
        {loading ? (
          <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', fontSize: '24px', marginRight: '10px' }}>⏳</span>
            Đang tải dữ liệu số dư đầu kỳ...
          </div>
        ) : (
          <table className="voucher-detail-table" style={{ width: '100%', minWidth: '1200px' }}>
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                <th style={{ width: '120px' }}>Số hiệu TK</th>
                <th style={{ minWidth: '200px' }}>Tên tài khoản</th>
                <th style={{ minWidth: '160px' }}>Khách hàng</th>
                <th style={{ minWidth: '160px' }}>Công trình/Hạng mục</th>
                <th style={{ width: '130px', textAlign: 'right' }}>Dư Nợ</th>
                <th style={{ width: '130px', textAlign: 'right' }}>Dư Có</th>
                <th style={{ width: '130px', textAlign: 'right' }}>Dư Nợ đầu năm</th>
                <th style={{ width: '130px', textAlign: 'right' }}>Dư Có đầu năm</th>
                <th className="th-actions" style={{ width: '100px' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '48px', marginBottom: '12px' }}>📊</div>
                    <div>Chưa có số dư đầu kỳ nào được khai báo</div>
                    <div style={{ fontSize: '12px', marginTop: '6px', opacity: 0.6 }}>Nhấn <strong>➕ Thêm số dư mới</strong> để bắt đầu nhập liệu</div>
                  </td>
                </tr>
              ) : (
                <>
                  {records.map((rec, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}>
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', padding: '10px 12px' }}>
                        {idx + 1}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#60a5fa', fontSize: '13px', padding: '10px 12px' }}>
                        {rec.account_code}
                      </td>
                      <td style={{ fontSize: '13px', padding: '10px 12px', color: 'var(--text-main)' }}>
                        {rec.account_name || rec.account_code}
                      </td>
                      <td style={{ fontSize: '12.5px', padding: '10px 12px', color: rec.customer_name ? 'var(--text-main)' : 'var(--text-muted)' }}>
                        {rec.customer_name || <em style={{ opacity: 0.5 }}>-</em>}
                      </td>
                      <td style={{ fontSize: '12.5px', padding: '10px 12px', color: rec.project_item_name ? 'var(--text-main)' : 'var(--text-muted)' }}>
                        {rec.project_item_name || <em style={{ opacity: 0.5 }}>-</em>}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, fontSize: '13px', padding: '10px 14px', color: parseFloat(rec.debit_balance) > 0 ? '#60a5fa' : 'var(--text-muted)' }}>
                        {fmtNum(rec.debit_balance)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, fontSize: '13px', padding: '10px 14px', color: parseFloat(rec.credit_balance) > 0 ? '#f87171' : 'var(--text-muted)' }}>
                        {fmtNum(rec.credit_balance)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, fontSize: '13px', padding: '10px 14px', color: parseFloat(rec.debit_balance_ytd) > 0 ? '#60a5fa' : 'var(--text-muted)' }}>
                        {fmtNum(rec.debit_balance_ytd)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, fontSize: '13px', padding: '10px 14px', color: parseFloat(rec.credit_balance_ytd) > 0 ? '#f87171' : 'var(--text-muted)' }}>
                        {fmtNum(rec.credit_balance_ytd)}
                      </td>
                      <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                        <div className="action-btn-group">
                          <button
                            className="action-btn-icon action-btn-edit"
                            title="Sửa"
                            onClick={() => openEditPanel(rec, idx)}
                          >✏️</button>
                          <button
                            className="action-btn-icon action-btn-delete"
                            title="Xóa"
                            onClick={() => handleDeleteRecord(idx)}
                          >🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {/* Summary Row */}
                  <tr style={{ background: 'rgba(255,255,255,0.03)', borderTop: '2px solid rgba(255,255,255,0.08)', fontWeight: 700 }}>
                    <td colSpan={5} style={{ padding: '12px 14px', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Tổng cộng
                    </td>
                    <td style={{ textAlign: 'right', padding: '12px 14px', color: '#60a5fa', fontSize: '14px' }}>
                      {fmtSum('debit_balance') > 0 ? new Intl.NumberFormat('vi-VN').format(fmtSum('debit_balance')) : '-'}
                    </td>
                    <td style={{ textAlign: 'right', padding: '12px 14px', color: '#f87171', fontSize: '14px' }}>
                      {fmtSum('credit_balance') > 0 ? new Intl.NumberFormat('vi-VN').format(fmtSum('credit_balance')) : '-'}
                    </td>
                    <td style={{ textAlign: 'right', padding: '12px 14px', color: '#60a5fa', fontSize: '14px' }}>
                      {fmtSum('debit_balance_ytd') > 0 ? new Intl.NumberFormat('vi-VN').format(fmtSum('debit_balance_ytd')) : '-'}
                    </td>
                    <td style={{ textAlign: 'right', padding: '12px 14px', color: '#f87171', fontSize: '14px' }}>
                      {fmtSum('credit_balance_ytd') > 0 ? new Intl.NumberFormat('vi-VN').format(fmtSum('credit_balance_ytd')) : '-'}
                    </td>
                    <td />
                  </tr>
                </>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Entry Full-Screen Modal (Portal) ────────────────────────── */}
      {showPanel && typeof document !== 'undefined' && createPortal((
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9000,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
          display: 'flex', flexDirection: 'column',
          animation: 'fadeInModal 0.2s ease',
          overflow: 'hidden',
          height: '100vh'
        }}>
          {/* Modal Container - full height, full width */}
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            background: 'linear-gradient(160deg, rgba(10,18,40,0.98) 0%, rgba(15,23,55,0.98) 100%)',
            borderTop: '2px solid rgba(99,102,241,0.4)',
          }}>
            {/* ── Header ── */}
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
                  {editingIndex === null ? '➕' : '✏️'}
                </div>
                <div>
                  <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#e2e8f0', margin: 0 }}>
                    {editingIndex === null ? 'Thêm số dư đầu tài khoản' : 'Sửa số dư đầu tài khoản'}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                    {editingIndex === null ? 'Nhập thông tin tài khoản và số dư đầu kỳ' : `Đang chỉnh sửa dòng #${(editingIndex ?? 0) + 1}`}
                  </p>
                </div>
              </div>
              <button
                onClick={closePanel}
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

            {/* ── Body - 3-column layout ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '28px', maxWidth: '1400px' }}>

                {/* Col 1: Tài khoản */}
                <div style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '16px', padding: '24px'
                }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(96,165,250,0.15)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>1</span>
                    Tài khoản
                  </div>
                  <div className="form-group" style={{ marginBottom: '0' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>
                      Số hiệu tài khoản <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <LookupSelect
                      lookupKey="leaf_account"
                      value={editingRecord.account_code}
                      onChange={val => updateFormField('account_code', val)}
                      placeholder="-- Tìm và chọn tài khoản --"
                      onQuickAdd={() => setIsAddAccountOpen(true)}
                    />
                    {editingRecord.account_code && formAccount && (
                      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>{formAccount.account_name}</div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                          {formAccount.track_object_debt && <span style={{ fontSize: '11px', background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '3px 10px', borderRadius: '20px', border: '1px solid rgba(16,185,129,0.2)' }}>✓ Công nợ</span>}
                          {formAccount.track_project_cost && <span style={{ fontSize: '11px', background: 'rgba(139,92,246,0.15)', color: '#a78bfa', padding: '3px 10px', borderRadius: '20px', border: '1px solid rgba(139,92,246,0.2)' }}>✓ Giá thành</span>}
                          {formAccount.is_bank && <span style={{ fontSize: '11px', background: 'rgba(234,179,8,0.15)', color: '#eab308', padding: '3px 10px', borderRadius: '20px', border: '1px solid rgba(234,179,8,0.2)' }}>🏦 Ngân hàng</span>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Col 2: Khách hàng + Công trình */}
                <div style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px'
                }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(167,139,250,0.15)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>2</span>
                    Đối tượng theo dõi
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: '12px', fontWeight: 600, color: isCustomerDisabled ? 'rgba(156,163,175,0.35)' : 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>
                      Khách hàng {isCustomerDisabled && <span style={{ fontWeight: 400, fontSize: '11px', color: 'rgba(156,163,175,0.5)' }}>(không theo dõi)</span>}
                    </label>
                    <LookupSelect
                      lookupKey="customer"
                      value={editingRecord.customer_id}
                      onChange={val => updateFormField('customer_id', val)}
                      placeholder={isCustomerDisabled ? '— Không áp dụng —' : '-- Tìm và chọn khách hàng --'}
                      disabled={isCustomerDisabled}
                      onQuickAdd={() => setIsAddCustomerOpen(true)}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: '12px', fontWeight: 600, color: isProjectDisabled ? 'rgba(156,163,175,0.35)' : 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>
                      Công trình/Hạng mục {isProjectDisabled && <span style={{ fontWeight: 400, fontSize: '11px', color: 'rgba(156,163,175,0.5)' }}>(không theo dõi)</span>}
                    </label>
                    <LookupSelect
                      lookupKey="project_item"
                      value={editingRecord.project_item_id}
                      onChange={val => updateFormField('project_item_id', val)}
                      placeholder={isProjectDisabled ? '— Không áp dụng —' : '-- Tìm và chọn hạng mục --'}
                      disabled={isProjectDisabled}
                      onQuickAdd={() => setIsAddProjectOpen(true)}
                    />
                  </div>
                </div>

                {/* Col 3: Số dư */}
                <div style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '16px', padding: '24px'
                }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(16,185,129,0.15)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>3</span>
                    Số dư đầu kỳ
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div className="form-group">
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'block' }}>Dư Nợ</label>
                      <input type="number" className="input-glass" placeholder="0" min="0"
                        value={editingRecord.debit_balance}
                        onChange={e => updateFormField('debit_balance', e.target.value)}
                        style={{ textAlign: 'right', padding: '10px 14px' }}
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'block' }}>Dư Có</label>
                      <input type="number" className="input-glass" placeholder="0" min="0"
                        value={editingRecord.credit_balance}
                        onChange={e => updateFormField('credit_balance', e.target.value)}
                        style={{ textAlign: 'right', padding: '10px 14px' }}
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'block' }}>Dư Nợ đầu năm</label>
                      <input type="number" className="input-glass" placeholder="0" min="0"
                        value={editingRecord.debit_balance_ytd}
                        onChange={e => updateFormField('debit_balance_ytd', e.target.value)}
                        style={{ textAlign: 'right', padding: '10px 14px' }}
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#fca5a5', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'block' }}>Dư Có đầu năm</label>
                      <input type="number" className="input-glass" placeholder="0" min="0"
                        value={editingRecord.credit_balance_ytd}
                        onChange={e => updateFormField('credit_balance_ytd', e.target.value)}
                        style={{ textAlign: 'right', padding: '10px 14px' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Error */}
              {message && messageType === 'error' && (
                <div style={{ marginTop: '20px', padding: '12px 16px', borderRadius: '10px', fontSize: '13px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', maxWidth: '1400px' }}>
                  ⚠️ {message}
                </div>
              )}
            </div>

            {/* ── Footer ── */}
            <div style={{
              padding: '16px 40px', borderTop: '1px solid rgba(255,255,255,0.07)',
              display: 'flex', gap: '12px', justifyContent: 'flex-end', alignItems: 'center',
              flexShrink: 0, background: 'rgba(0,0,0,0.25)'
            }}>
              <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-muted)' }}>
                💡 Nhấn <kbd style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>Lưu số dư</kbd> để xác nhận thay đổi
              </span>
              <button className="btn-secondary" onClick={closePanel} style={{ padding: '11px 28px', fontSize: '14px', background: 'transparent' }}>
                Hủy bỏ
              </button>
              <button
                className="btn-primary"
                style={{ width: 'auto', padding: '11px 32px', fontSize: '14px', background: 'linear-gradient(135deg, var(--primary-color), var(--primary-hover))', border: 'none', fontWeight: 600 }}
                onClick={handlePanelSave}
                disabled={saving}
              >
                {saving ? '⏳ Đang lưu...' : '💾 Lưu số dư'}
              </button>
            </div>
          </div>
        </div>
      ), document.body)}

      {/* ── Quick Add Modals ──────────────────────────────────────────── */}
      <QuickAddCustomerModal
        isOpen={isAddCustomerOpen}
        onClose={() => setIsAddCustomerOpen(false)}
        onSuccess={handleAddCustomerSuccess}
      />
      <QuickAddProjectModal
        isOpen={isAddProjectOpen}
        onClose={() => setIsAddProjectOpen(false)}
        onSuccess={handleAddProjectSuccess}
        type="Hạng mục"
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
      `}</style>
    </div>
  );
}
