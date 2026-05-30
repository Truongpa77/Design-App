"use client";

import { useState, useEffect } from "react";
import "../customers/customers.css"; // Reuse master layout styles
import { useMenu } from "@/components/MenuProvider";

interface Project {
  id: number;
  code: string;
  name: string;
  type: string;
  parent_id: number | null;
  parent_name: string | null;
  notes: string | null;
}

export default function ProjectsClient({ initialData }: { initialData: Project[] }) {
  const [projects, setProjects] = useState<Project[]>(initialData);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'project' | 'category'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: 'Công trình', // 'Công trình' | 'Hạng mục'
    parent_id: '',
    notes: ''
  });

  const [errorMessage, setErrorMessage] = useState('');

  // Extract parent options (which are only of type 'Công trình')
  const parentProjects = projects.filter(p => p.type === 'Công trình');

  const { setHeaderActions } = useMenu();

  const openAddModal = () => {
    setEditingId(null);
    setFormData({ code: '', name: '', type: 'Công trình', parent_id: '', notes: '' });
    setErrorMessage('');
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

  const openEditModal = (p: Project) => {
    setEditingId(p.id);
    setFormData({
      code: p.code,
      name: p.name,
      type: p.type,
      parent_id: p.parent_id ? p.parent_id.toString() : '',
      notes: p.notes || ''
    });
    setErrorMessage('');
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Bạn có chắc chắn muốn xóa công trình/hạng mục này? Hành động này sẽ tự động xóa tất cả hạng mục con thuộc về nó.")) {
      return;
    }

    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        // Cascade delete local items if parent project was deleted
        setProjects(projects.filter(p => p.id !== id && p.parent_id !== id));
      } else {
        const err = await res.json();
        alert(err.error || "Có lỗi xảy ra khi xóa");
      }
    } catch (e) {
      console.error(e);
      alert("Lỗi kết nối server");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (formData.type === 'Hạng mục' && !formData.parent_id) {
      setErrorMessage('Vui lòng chọn Công trình cha cho Hạng mục này');
      return;
    }

    try {
      const url = editingId ? `/api/projects/${editingId}` : '/api/projects';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: formData.code.trim(),
          name: formData.name.trim(),
          type: formData.type,
          parent_id: formData.type === 'Hạng mục' ? parseInt(formData.parent_id) : null,
          notes: formData.notes.trim()
        })
      });

      if (res.ok) {
        const savedProject = await res.json();
        if (editingId) {
          // If we edited a project name, update local parent name fields of child elements
          let updatedList = projects.map(p => p.id === editingId ? savedProject : p);
          if (savedProject.type === 'Công trình') {
            updatedList = updatedList.map(p => p.parent_id === editingId ? { ...p, parent_name: savedProject.name } : p);
          }
          setProjects(updatedList);
        } else {
          setProjects([savedProject, ...projects]);
        }
        setIsModalOpen(false);
      } else {
        const err = await res.json();
        setErrorMessage(err.error || "Có lỗi xảy ra khi lưu");
      }
    } catch (err) {
      console.error(err);
      setErrorMessage("Không thể kết nối đến máy chủ");
    }
  };

  // Filter based on tab
  const countAll = projects.length;
  const countProjects = projects.filter(p => p.type === 'Công trình').length;
  const countCategories = projects.filter(p => p.type === 'Hạng mục').length;

  const filteredProjects = projects.filter(p => {
    const matchesTab = 
      activeTab === 'all' ||
      (activeTab === 'project' && p.type === 'Công trình') ||
      (activeTab === 'category' && p.type === 'Hạng mục');
      
    const matchesSearch = 
      p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.notes && p.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      
    return matchesTab && matchesSearch;
  });

  return (
    <div className="customers-container">
      <div className="actions-bar" style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '8px' }}>
        <div className="tabs-container" style={{ display: 'flex', gap: '6px', background: 'rgba(15, 23, 42, 0.4)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <button 
            type="button"
            className={`tab-button ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            Tất cả <span className="tab-count">{countAll}</span>
          </button>
          <button 
            type="button"
            className={`tab-button ${activeTab === 'project' ? 'active' : ''}`}
            onClick={() => setActiveTab('project')}
          >
            Công trình <span className="tab-count">{countProjects}</span>
          </button>
          <button 
            type="button"
            className={`tab-button ${activeTab === 'category' ? 'active' : ''}`}
            onClick={() => setActiveTab('category')}
          >
            Hạng mục <span className="tab-count">{countCategories}</span>
          </button>
        </div>
      </div>

      <div className="glass-panel table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Mã</th>
              <th>Tên Công trình / Hạng mục</th>
              <th>Phân loại</th>
              <th>Công trình trực thuộc (Cha)</th>
              <th>Ghi chú</th>
              <th className="th-actions">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.map((p) => (
              <tr key={p.id}>
                <td className="font-medium" style={{ color: 'var(--primary-color)' }}>{p.code}</td>
                <td className="font-medium">{p.name}</td>
                <td>
                  <span style={{ 
                    padding: '4px 8px', 
                    borderRadius: '6px', 
                    fontSize: '12px',
                    fontWeight: 500,
                    background: p.type === 'Công trình' ? 'rgba(var(--primary-color-rgb), 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    color: p.type === 'Công trình' ? 'var(--primary-color)' : '#34d399'
                  }}>
                    {p.type}
                  </span>
                </td>
                <td style={{ color: 'var(--text-muted)' }}>
                  {p.type === 'Hạng mục' ? (p.parent_name || 'Chưa liên kết') : '-'}
                </td>
                <td>{p.notes || '-'}</td>
                <td>
                  <div className="action-btn-group">
                    <button 
                      className="action-btn-icon action-btn-edit" 
                      title="Sửa công trình / hạng mục" 
                      onClick={() => openEditModal(p)}
                    >
                      ✏️
                    </button>
                    <button 
                      className="action-btn-icon action-btn-delete" 
                      title="Xóa" 
                      onClick={() => handleDelete(p.id)}
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredProjects.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-muted">Chưa có dữ liệu</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel animate-fade-in">
            <h2>{editingId ? 'Sửa công trình / hạng mục' : 'Thêm công trình / hạng mục mới'}</h2>
            
            {errorMessage && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--danger)', color: '#f87171', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>
                ⚠️ {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>Mã *</label>
                  <input 
                    required 
                    className="input-glass" 
                    placeholder="Mã (Ví dụ: DA001, HM01)..." 
                    value={formData.code} 
                    onChange={e => setFormData({...formData, code: e.target.value})} 
                  />
                </div>
                <div className="form-group">
                  <label>Phân loại *</label>
                  <select 
                    className="input-glass" 
                    value={formData.type} 
                    onChange={e => setFormData({...formData, type: e.target.value, parent_id: e.target.value === 'Công trình' ? '' : formData.parent_id})}
                  >
                    <option value="Công trình">Công trình (Master)</option>
                    <option value="Hạng mục">Hạng mục (Sub-item)</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '16px' }}>
                <label>Tên gọi *</label>
                <input 
                  required 
                  className="input-glass" 
                  placeholder="Tên công trình hoặc hạng mục..." 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                />
              </div>

              {formData.type === 'Hạng mục' && (
                <div className="form-group" style={{ marginTop: '16px' }}>
                  <label>Công trình trực thuộc (Cha) *</label>
                  <select 
                    required 
                    className="input-glass" 
                    value={formData.parent_id} 
                    onChange={e => setFormData({...formData, parent_id: e.target.value})}
                  >
                    <option value="">-- Chọn công trình trực thuộc --</option>
                    {parentProjects.map(p => (
                      <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group" style={{ marginTop: '16px' }}>
                <label>Ghi chú / Mô tả</label>
                <textarea 
                  className="input-glass" 
                  rows={3} 
                  placeholder="Nhập ghi chú chi tiết nếu có..." 
                  style={{ resize: 'vertical' }}
                  value={formData.notes} 
                  onChange={e => setFormData({...formData, notes: e.target.value})} 
                />
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
