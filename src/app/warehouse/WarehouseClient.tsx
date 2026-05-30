"use client";

import { useState, useEffect } from "react";
import "../customers/customers.css";
import { useMenu } from "@/components/MenuProvider";

interface Warehouse {
  id: number;
  warehouse_code: string;
  warehouse_name: string;
  description: string | null;
  created_at: string;
}

export default function WarehouseClient({ initialData }: { initialData: Warehouse[] }) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>(initialData);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    warehouse_code: '',
    warehouse_name: '',
    description: '',
  });

  const { setHeaderActions } = useMenu();

  const openAddModal = () => {
    setEditingId(null);
    setFormData({ warehouse_code: '', warehouse_name: '', description: '' });
    setError('');
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
        <button className="btn-primary" style={{ width: 'auto', height: '38px', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={openAddModal}>
          ➕ Thêm mới
        </button>
      </div>
    );
    return () => setHeaderActions(null);
  }, [setHeaderActions, searchQuery]);

  const openEditModal = (w: Warehouse) => {
    setEditingId(w.id);
    setFormData({
      warehouse_code: w.warehouse_code,
      warehouse_name: w.warehouse_name,
      description: w.description || '',
    });
    setError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const url = editingId ? `/api/warehouses/${editingId}` : '/api/warehouses';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Co loi xay ra');
        return;
      }

      if (editingId) {
        setWarehouses(warehouses.map(w => w.id === editingId ? data : w));
      } else {
        setWarehouses([data, ...warehouses]);
      }
      setIsModalOpen(false);
    } catch (err) {
      setError('Khong the ket noi server');
      console.error(err);
    }
  };

  const handleDelete = async (id: number, code: string) => {
    if (!confirm(`Ban co chac muon xoa kho "${code}"?`)) return;
    try {
      const res = await fetch(`/api/warehouses/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setWarehouses(warehouses.filter(w => w.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredWarehouses = warehouses.filter(w => 
    w.warehouse_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.warehouse_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (w.description && w.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="customers-container">

      <div className="glass-panel table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '80px' }}>STT</th>
              <th style={{ width: '160px' }}>Ma Kho</th>
              <th>Ten Kho</th>
              <th>Mo ta</th>
              <th className="th-actions" style={{ width: '120px' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filteredWarehouses.map((w, idx) => (
              <tr key={w.id}>
                <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{idx + 1}</td>
                <td>
                  <span style={{
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    fontSize: '14px',
                    background: 'rgba(59,130,246,0.12)',
                    color: '#60a5fa',
                    padding: '3px 10px',
                    borderRadius: '6px',
                    letterSpacing: '0.05em',
                  }}>
                    {w.warehouse_code}
                  </span>
                </td>
                <td className="font-medium">{w.warehouse_name}</td>
                <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{w.description || '-'}</td>
                <td>
                  <div className="action-btn-group">
                    <button
                      className="action-btn-icon action-btn-edit"
                      onClick={() => openEditModal(w)}
                      title="Sửa"
                    >
                      ✏️
                    </button>
                    <button
                      className="action-btn-icon action-btn-delete"
                      onClick={() => handleDelete(w.id, w.warehouse_code)}
                      title="Xóa"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredWarehouses.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-muted">
                  Chua co danh muc kho nao
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel animate-fade-in" style={{ maxWidth: '480px' }}>
            <h2>{editingId ? 'Cap nhat Kho' : 'Them Kho moi'}</h2>
            {error && (
              <div style={{
                marginTop: '12px',
                padding: '10px 16px',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '8px',
                color: '#ef4444',
                fontSize: '14px',
              }}>
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="mt-4">
              <div className="form-group">
                <label>Ma Kho *</label>
                <input
                  required
                  className="input-glass"
                  placeholder="Vi du: KHO-01, KHO-HN..."
                  value={formData.warehouse_code}
                  style={{ textTransform: 'uppercase', fontFamily: 'monospace', letterSpacing: '0.05em' }}
                  onChange={e => setFormData({ ...formData, warehouse_code: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Ten Kho *</label>
                <input
                  required
                  className="input-glass"
                  placeholder="Vi du: Kho Hang Chinh, Kho Ha Noi..."
                  value={formData.warehouse_name}
                  onChange={e => setFormData({ ...formData, warehouse_name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Mo ta</label>
                <input
                  className="input-glass"
                  placeholder="Dia chi, ghi chu..."
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="modal-actions mt-6">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Huy
                </button>
                <button type="submit" className="btn-primary" style={{ width: 'auto' }}>
                  {editingId ? 'Cap nhat' : 'Luu kho'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
