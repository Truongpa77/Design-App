"use client";

import React, { useState, useEffect, useRef } from 'react';

// ==========================================
// 1. REUSABLE SEARCHABLE SELECT COMPONENT
// ==========================================
interface LookupOption {
  value: string;
  label: string;
  sublabel?: string;
}

export function LookupSelect({
  lookupKey,
  value,
  onChange,
  placeholder = "-- Chọn --",
  onQuickAdd,
  disabled = false,
  parentVal,
  style = {},
  showValueOnly = false
}: {
  lookupKey: string;
  value: string | number;
  onChange: (val: string) => void;
  placeholder?: string;
  onQuickAdd?: () => void;
  disabled?: boolean;
  parentVal?: string | number;
  style?: React.CSSProperties;
  showValueOnly?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<LookupOption[]>([]);
  const [selectedLabel, setSelectedLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch selected label on mount / change
  useEffect(() => {
    if (!value) {
      setSelectedLabel('');
      return;
    }
    const fetchSelectedLabel = async () => {
      try {
        const res = await fetch(`/api/lookup?key=${lookupKey}&id=${value}`);
        if (res.ok) {
          const data = await res.json();
          if (data) {
            setSelectedLabel(data.sublabel ? `${data.label} [${data.sublabel}]` : data.label);
          } else {
            setSelectedLabel(value.toString());
          }
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchSelectedLabel();
  }, [value, lookupKey]);

  // Fetch search options when open
  useEffect(() => {
    if (!isOpen) return;

    const fetchOptions = async () => {
      setLoading(true);
      try {
        let url = `/api/lookup?key=${lookupKey}&q=${encodeURIComponent(search)}`;
        if (parentVal) {
          url += `&parent_val=${encodeURIComponent(parentVal.toString())}`;
        }
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setOptions(data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    const timeout = setTimeout(fetchOptions, 200);
    return () => clearTimeout(timeout);
  }, [isOpen, search, lookupKey, parentVal]);

  const displayVal = showValueOnly ? (value ? value.toString() : '') : (selectedLabel || (value ? value.toString() : ''));

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', ...style }}>
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className="input-glass"
        style={{ 
          padding: '8px 12px', 
          cursor: disabled ? 'not-allowed' : 'pointer', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          userSelect: 'none',
          background: disabled ? 'rgba(255,255,255,0.01)' : undefined,
          opacity: disabled ? 0.6 : 1,
          minHeight: '36px',
          fontSize: '13px'
        }}
      >
        <span style={{ 
          color: value ? 'var(--text-main)' : 'var(--text-muted)',
          textOverflow: 'ellipsis',
          overflow: 'hidden',
          whiteSpace: 'nowrap'
        }}>
          {value ? displayVal : placeholder}
        </span>
        <span style={{ fontSize: '8px', opacity: 0.6 }}>▼</span>
      </div>

      {isOpen && (
        <div 
          className="glass-panel" 
          style={{ 
            position: 'absolute', 
            top: 'calc(100% + 6px)', 
            left: 0, 
            right: 0, 
            zIndex: 9999, 
            maxHeight: '260px', 
            display: 'flex', 
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.6)',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(15, 23, 42, 0.96)',
            backdropFilter: 'blur(16px)',
            borderRadius: '8px',
            minWidth: '220px'
          }}
        >
          {/* Search Input */}
          <div style={{ padding: '6px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <input 
              type="text" 
              className="input-glass" 
              placeholder="Tìm kiếm nhanh..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
              style={{ width: '100%', padding: '6px 10px', fontSize: '12px' }}
              onClick={e => e.stopPropagation()}
            />
          </div>

          {/* Options list */}
          <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
            {loading && options.length === 0 ? (
              <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>⏳ Đang tải...</div>
            ) : options.map(o => (
              <div 
                key={o.value} 
                onClick={() => {
                  onChange(o.value);
                  setIsOpen(false);
                  setSearch('');
                }}
                style={{ 
                  padding: '8px 12px', 
                  cursor: 'pointer',
                  fontSize: '12.5px',
                  transition: 'background 0.1s',
                  background: o.value === value.toString() ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                  color: o.value === value.toString() ? 'var(--primary-color)' : 'var(--text-main)'
                }}
                onMouseEnter={e => { if (o.value !== value.toString()) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { if (o.value !== value.toString()) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ fontWeight: o.value === value.toString() ? 600 : 500 }}>
                  {showValueOnly ? `${o.value} - ${o.label}` : o.label}
                </div>
                {o.sublabel && !showValueOnly && (
                  <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'monospace' }}>
                    {o.sublabel}
                  </div>
                )}
              </div>
            ))}
            {!loading && options.length === 0 && (
              <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>Không có dữ liệu</div>
            )}
          </div>

          {/* Quick Add link */}
          {onQuickAdd && (
            <div 
              onClick={() => {
                onQuickAdd();
                setIsOpen(false);
              }}
              style={{ 
                padding: '8px 10px', 
                textAlign: 'center', 
                borderTop: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(59, 130, 246, 0.08)',
                color: '#60a5fa',
                fontWeight: 600,
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'background 0.1s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.08)'}
            >
              ➕ Thêm nhanh mới
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==========================================
// 2. QUICK ADD CUSTOMER MODAL
// ==========================================
export function QuickAddCustomerModal({
  isOpen,
  onClose,
  onSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (customer: any) => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return setError('Vui lòng nhập tên khách hàng');
    
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email, address })
      });
      const data = await res.json();
      if (res.ok) {
        onSuccess(data);
        setName('');
        setPhone('');
        setEmail('');
        setAddress('');
        onClose();
      } else {
        setError(data.error || 'Có lỗi xảy ra');
      }
    } catch (err) {
      setError('Lỗi kết nối máy chủ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 10000 }}>
      <div className="modal-content glass-panel animate-fade-in" style={{ maxWidth: '450px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#60a5fa', marginBottom: '16px' }}>Thêm Khách hàng mới</h3>
        {error && <div style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', marginBottom: '12px' }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px' }}>Tên khách hàng *</label>
            <input required className="input-glass" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px' }}>Số điện thoại</label>
            <input className="input-glass" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px' }}>Email</label>
            <input type="email" className="input-glass" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px' }}>Địa chỉ</label>
            <input className="input-glass" value={address} onChange={e => setAddress(e.target.value)} />
          </div>
          <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="btn-secondary" onClick={onClose} style={{ padding: '6px 14px', fontSize: '13px' }}>Hủy</button>
            <button type="submit" className="btn-primary" disabled={saving} style={{ width: 'auto', padding: '6px 16px', fontSize: '13px' }}>
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 3. QUICK ADD MATERIAL/PRODUCT MODAL
// ==========================================
export function QuickAddMaterialModal({
  isOpen,
  onClose,
  onSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (material: any) => void;
}) {
  const [formData, setFormData] = useState({
    material_code: '',
    name: '',
    type: 'Ván',
    unit: 'Tấm',
    unit_price: '',
    length: '',
    width: '',
    thickness: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.material_code) return setError('Vui lòng nhập Mã vật tư');
    if (!formData.name) return setError('Vui lòng nhập Tên vật tư/sản phẩm');
    if (!formData.unit_price) return setError('Vui lòng nhập Đơn giá');

    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          length: formData.length ? Number(formData.length) : null,
          width: formData.width ? Number(formData.width) : null,
          thickness: formData.thickness ? Number(formData.thickness) : null,
          unit_price: Number(formData.unit_price)
        })
      });
      const data = await res.json();
      if (res.ok) {
        onSuccess(data);
        setFormData({
          material_code: '',
          name: '',
          type: 'Ván',
          unit: 'Tấm',
          unit_price: '',
          length: '',
          width: '',
          thickness: ''
        });
        onClose();
      } else {
        setError(data.error || 'Có lỗi xảy ra');
      }
    } catch (err) {
      setError('Lỗi kết nối máy chủ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 10000 }}>
      <div className="modal-content glass-panel animate-fade-in" style={{ maxWidth: '500px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#60a5fa', marginBottom: '16px' }}>Thêm Sản phẩm / Vật tư mới</h3>
        {error && <div style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', marginBottom: '12px' }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginBottom: '12px' }}>
            <div className="form-group">
              <label style={{ fontSize: '12px' }}>Mã VT/SP *</label>
              <input required className="input-glass" placeholder="VT..." value={formData.material_code} onChange={e => setFormData({...formData, material_code: e.target.value})} />
            </div>
            <div className="form-group">
              <label style={{ fontSize: '12px' }}>Tên gọi *</label>
              <input required className="input-glass" placeholder="Tên..." value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div className="form-group">
              <label style={{ fontSize: '12px' }}>Phân loại *</label>
              <select className="input-glass" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                <option value="Ván">Ván</option>
                <option value="Phụ kiện">Phụ kiện</option>
                <option value="Sản phẩm">Sản phẩm (Bàn, Tủ...)</option>
              </select>
            </div>
            <div className="form-group">
              <label style={{ fontSize: '12px' }}>Đơn vị tính</label>
              <input className="input-glass" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} />
            </div>
          </div>

          {formData.type === 'Ván' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div className="form-group">
                <label style={{ fontSize: '12px' }}>Dài (mm)</label>
                <input type="number" className="input-glass" value={formData.length} onChange={e => setFormData({...formData, length: e.target.value})} />
              </div>
              <div className="form-group">
                <label style={{ fontSize: '12px' }}>Rộng (mm)</label>
                <input type="number" className="input-glass" value={formData.width} onChange={e => setFormData({...formData, width: e.target.value})} />
              </div>
              <div className="form-group">
                <label style={{ fontSize: '12px' }}>Dày (mm)</label>
                <input type="number" className="input-glass" value={formData.thickness} onChange={e => setFormData({...formData, thickness: e.target.value})} />
              </div>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px' }}>Đơn giá (VNĐ) *</label>
            <input type="number" required className="input-glass" placeholder="Giá..." value={formData.unit_price} onChange={e => setFormData({...formData, unit_price: e.target.value})} />
          </div>

          <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="btn-secondary" onClick={onClose} style={{ padding: '6px 14px', fontSize: '13px' }}>Hủy</button>
            <button type="submit" className="btn-primary" disabled={saving} style={{ width: 'auto', padding: '6px 16px', fontSize: '13px' }}>
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 4. QUICK ADD PROJECT / ITEM MODAL
// ==========================================
export function QuickAddProjectModal({
  isOpen,
  onClose,
  onSuccess,
  type = 'Công trình',
  parentId = null
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (project: any) => void;
  type?: 'Công trình' | 'Hạng mục';
  parentId?: string | number | null;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return setError('Vui lòng nhập Mã');
    if (!name) return setError('Vui lòng nhập Tên');

    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          name,
          type,
          parent_id: type === 'Hạng mục' ? (parentId ? Number(parentId) : null) : null,
          notes
        })
      });
      const data = await res.json();
      if (res.ok) {
        onSuccess(data);
        setCode('');
        setName('');
        setNotes('');
        onClose();
      } else {
        setError(data.error || 'Có lỗi xảy ra');
      }
    } catch (err) {
      setError('Lỗi kết nối máy chủ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 10000 }}>
      <div className="modal-content glass-panel animate-fade-in" style={{ maxWidth: '450px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#60a5fa', marginBottom: '16px' }}>
          Thêm {type} mới
        </h3>
        {error && <div style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', marginBottom: '12px' }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px' }}>Mã {type} *</label>
            <input required className="input-glass" placeholder="Mã..." value={code} onChange={e => setCode(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px' }}>Tên {type} *</label>
            <input required className="input-glass" placeholder="Tên gọi..." value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px' }}>Ghi chú</label>
            <input className="input-glass" placeholder="Ghi chú..." value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="btn-secondary" onClick={onClose} style={{ padding: '6px 14px', fontSize: '13px' }}>Hủy</button>
            <button type="submit" className="btn-primary" disabled={saving} style={{ width: 'auto', padding: '6px 16px', fontSize: '13px' }}>
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 5. QUICK ADD ACCOUNT MODAL
// ==========================================
export function QuickAddAccountModal({
  isOpen,
  onClose,
  onSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (account: any) => void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [parentCode, setParentCode] = useState('');
  const [trackDebt, setTrackDebt] = useState(false);
  const [trackCost, setTrackCost] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return setError('Vui lòng nhập Số hiệu tài khoản');
    if (!name) return setError('Vui lòng nhập Tên tài khoản');

    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_code: code,
          account_name: name,
          parent_code: parentCode || null,
          track_object_debt: trackDebt,
          track_project_cost: trackCost,
          is_active: true
        })
      });
      const data = await res.json();
      if (res.ok) {
        onSuccess(data);
        setCode('');
        setName('');
        setParentCode('');
        setTrackDebt(false);
        setTrackCost(false);
        onClose();
      } else {
        setError(data.error || 'Có lỗi xảy ra');
      }
    } catch (err) {
      setError('Lỗi kết nối máy chủ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 10000 }}>
      <div className="modal-content glass-panel animate-fade-in" style={{ maxWidth: '480px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#60a5fa', marginBottom: '16px' }}>Thêm Tài khoản mới</h3>
        {error && <div style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', marginBottom: '12px' }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '12px', marginBottom: '12px' }}>
            <div className="form-group">
              <label style={{ fontSize: '12px' }}>Số hiệu TK *</label>
              <input required className="input-glass" placeholder="Ví dụ: 1111" value={code} onChange={e => setCode(e.target.value)} />
            </div>
            <div className="form-group">
              <label style={{ fontSize: '12px' }}>Tên tài khoản *</label>
              <input required className="input-glass" placeholder="Tên..." value={name} onChange={e => setName(e.target.value)} />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px' }}>Tài khoản cha</label>
            <LookupSelect
              lookupKey="account"
              value={parentCode}
              onChange={val => setParentCode(val)}
              placeholder="-- Chọn tài khoản cha (Nếu có) --"
            />
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', cursor: 'pointer' }}>
                <input type="checkbox" checked={trackDebt} onChange={e => setTrackDebt(e.target.checked)} />
                Theo dõi công nợ đối tượng
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', cursor: 'pointer' }}>
                <input type="checkbox" checked={trackCost} onChange={e => setTrackCost(e.target.checked)} />
                Theo dõi chi tiết giá thành
              </label>
            </div>
          </div>

          <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="btn-secondary" onClick={onClose} style={{ padding: '6px 14px', fontSize: '13px' }}>Hủy</button>
            <button type="submit" className="btn-primary" disabled={saving} style={{ width: 'auto', padding: '6px 16px', fontSize: '13px' }}>
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================

// 5. DATE INPUT COMPONENT (DD/MM/YY FORMAT)
// ==========================================
export function DateInput({
  value,
  onChange,
  required = false,
  className = "input-glass",
  style = {}
}: {
  value: string;
  onChange: (val: string) => void;
  required?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const toDisplay = (val: string) => {
    if (!val) return "";
    const parts = val.split("-");
    if (parts.length === 3) {
      const y = parts[0].slice(-2); // YY
      const m = parts[1];
      const d = parts[2];
      return `${d}/${m}/${y}`;
    }
    return val;
  };

  const toValue = (txt: string) => {
    const clean = txt.replace(/[^0-9/]/g, '');
    const parts = clean.split("/");
    if (parts.length === 3) {
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      let y = parts[2];
      if (y.length === 2) {
        y = "20" + y;
      }
      if (y.length === 4) {
        const numD = parseInt(d);
        const numM = parseInt(m);
        const numY = parseInt(y);
        if (numD >= 1 && numD <= 31 && numM >= 1 && numM <= 12) {
          return `${y}-${m}-${d}`;
        }
      }
    }
    return "";
  };

  const [text, setText] = useState(toDisplay(value));

  useEffect(() => {
    setText(toDisplay(value));
  }, [value]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setText(val);
    const parsed = toValue(val);
    if (parsed) {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    const parsed = toValue(text);
    if (parsed) {
      onChange(parsed);
      setText(toDisplay(parsed));
    } else {
      setText(toDisplay(value));
    }
  };

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%', ...style }}>
      <input
        type="text"
        className={className}
        placeholder="DD/MM/YY"
        value={text}
        onChange={handleTextChange}
        onBlur={handleBlur}
        required={required}
        style={{ width: '100%', paddingRight: '36px' }}
      />
      <div style={{ position: 'absolute', right: '8px', display: 'flex', alignItems: 'center', height: '100%', cursor: 'pointer' }}>
        <input
          type="date"
          value={value || ""}
          onChange={e => {
            if (e.target.value) {
              onChange(e.target.value);
            }
          }}
          style={{
            position: 'absolute',
            opacity: 0,
            right: 0,
            width: '24px',
            height: '24px',
            cursor: 'pointer',
            zIndex: 2
          }}
        />
        <span style={{ fontSize: '16px', opacity: 0.7, pointerEvents: 'none' }}>📅</span>
      </div>
    </div>
  );
}
