"use client";

import { useState, useEffect } from "react";
import "./customers.css";
import { useMenu } from "@/components/MenuProvider";

export default function CustomersClient({ initialData }: { initialData: any[] }) {
  const [customers, setCustomers] = useState(initialData);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', address: '' });

  const { setHeaderActions } = useMenu();

  const openAddModal = () => {
    setEditingId(null);
    setFormData({ name: '', phone: '', email: '', address: '' });
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

  const openEditModal = (c: any) => {
    setEditingId(c.id);
    setFormData({ name: c.name, phone: c.phone || '', email: c.email || '', address: c.address || '' });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingId ? `/api/customers/${editingId}` : '/api/customers';
      const method = editingId ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        const updatedCustomer = await res.json();
        if (editingId) {
          setCustomers(customers.map(c => c.id === editingId ? updatedCustomer : c));
        } else {
          setCustomers([updatedCustomer, ...customers]);
        }
        setIsModalOpen(false);
        setFormData({ name: '', phone: '', email: '', address: '' });
        setEditingId(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.phone && c.phone.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (c.address && c.address.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="customers-container">
      <div className="glass-panel table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Tên khách hàng</th>
              <th>Số điện thoại</th>
              <th>Email</th>
              <th>Địa chỉ</th>
              <th className="th-actions">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.map((c) => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td className="font-medium">{c.name}</td>
                <td>{c.phone}</td>
                <td>{c.email}</td>
                <td>{c.address}</td>
                <td>
                  <div className="action-btn-group">
                    <button 
                      className="action-btn-icon action-btn-edit" 
                      title="Sửa khách hàng" 
                      onClick={() => openEditModal(c)}
                    >
                      ✏️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredCustomers.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-muted">Chưa có dữ liệu khách hàng</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel animate-fade-in">
            <h2>{editingId ? 'Sửa thông tin khách hàng' : 'Thêm khách hàng mới'}</h2>
            <form onSubmit={handleSubmit} className="mt-4">
              <div className="form-group">
                <label>Tên khách hàng *</label>
                <input required className="input-glass" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Số điện thoại</label>
                <input className="input-glass" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" className="input-glass" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Địa chỉ</label>
                <input className="input-glass" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
              </div>
              <div className="modal-actions mt-6">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Hủy</button>
                <button type="submit" className="btn-primary" style={{ width: 'auto' }}>Lưu thông tin</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
