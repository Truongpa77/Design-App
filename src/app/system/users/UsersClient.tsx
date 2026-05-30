"use client";

import React, { useState, useEffect } from 'react';
import '../../customers/customers.css'; // Reuses modal and table styling
import { useMenu } from '@/components/MenuProvider';

interface User {
  id: number;
  username: string;
  role: string;
  created_at: string | null;
}

interface UsersClientProps {
  initialUsers: User[];
  currentUser: {
    id: number;
    username: string;
    role: string;
  };
}

export default function UsersClient({ initialUsers, currentUser }: UsersClientProps) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  const { setHeaderActions } = useMenu();

  const [formData, setFormData] = useState({
    username: '',
    role: 'user',
    password: '',
    confirmPassword: ''
  });

  const [passwordFormData, setPasswordFormData] = useState({
    newPassword: '',
    confirmNewPassword: ''
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/system/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (e) {
      console.error('Error fetching users:', e);
    }
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setError(type === 'error' ? message : '');
    setSuccess(type === 'success' ? message : '');
    setTimeout(() => {
      setError('');
      setSuccess('');
    }, 4000);
  };

  const openAddModal = () => {
    setEditingUser(null);
    setFormData({
      username: '',
      role: 'user',
      password: '',
      confirmPassword: ''
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
          style={{ width: 'auto', background: 'linear-gradient(135deg, var(--primary-color), var(--primary-hover))', border: 'none', height: '38px', display: 'flex', alignItems: 'center', gap: '6px' }}
          onClick={openAddModal}
        >
          ➕ Thêm mới
        </button>
      </div>
    );
    return () => setHeaderActions(null);
  }, [setHeaderActions, searchQuery]);

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      role: user.role,
      password: '',
      confirmPassword: ''
    });
    setIsModalOpen(true);
  };

  const openPasswordModal = (user: User) => {
    setEditingUser(user);
    setPasswordFormData({
      newPassword: '',
      confirmNewPassword: ''
    });
    setIsPasswordModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username.trim()) {
      showNotification('error', 'Vui lòng nhập tên đăng nhập');
      return;
    }

    if (!editingUser && !formData.password) {
      showNotification('error', 'Vui lòng nhập mật khẩu cho tài khoản mới');
      return;
    }

    if (!editingUser && formData.password !== formData.confirmPassword) {
      showNotification('error', 'Mật khẩu xác nhận không khớp');
      return;
    }

    setSaving(true);
    try {
      const url = editingUser ? `/api/system/users/${editingUser.id}` : '/api/system/users';
      const method = editingUser ? 'PUT' : 'POST';
      const bodyData = editingUser 
        ? { username: formData.username, role: formData.role }
        : { username: formData.username, role: formData.role, password: formData.password };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });

      const data = await res.json();
      if (!res.ok) {
        showNotification('error', data.error || 'Có lỗi xảy ra khi lưu thông tin');
        return;
      }

      showNotification('success', editingUser ? 'Cập nhật tài khoản thành công!' : 'Tạo tài khoản mới thành công!');
      setIsModalOpen(false);
      await fetchUsers();
    } catch (e) {
      showNotification('error', 'Lỗi kết nối máy chủ');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordFormData.newPassword) {
      showNotification('error', 'Vui lòng nhập mật khẩu mới');
      return;
    }

    if (passwordFormData.newPassword.length < 4) {
      showNotification('error', 'Mật khẩu phải có ít nhất 4 ký tự');
      return;
    }

    if (passwordFormData.newPassword !== passwordFormData.confirmNewPassword) {
      showNotification('error', 'Mật khẩu xác nhận không khớp');
      return;
    }

    if (!editingUser) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/system/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: editingUser.username,
          role: editingUser.role,
          password: passwordFormData.newPassword
        })
      });

      const data = await res.json();
      if (!res.ok) {
        showNotification('error', data.error || 'Có lỗi xảy ra khi đổi mật khẩu');
        return;
      }

      showNotification('success', `Đổi mật khẩu cho tài khoản "${editingUser.username}" thành công!`);
      setIsPasswordModalOpen(false);
    } catch (e) {
      showNotification('error', 'Lỗi kết nối máy chủ');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (user.id === currentUser.id) {
      showNotification('error', 'Bạn không thể tự xóa tài khoản của chính mình!');
      return;
    }

    if (!confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản "${user.username}" khỏi hệ thống không?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/system/users/${user.id}`, {
        method: 'DELETE'
      });

      const data = await res.json();
      if (res.ok) {
        showNotification('success', `Đã xóa tài khoản "${user.username}" thành công!`);
        await fetchUsers();
      } else {
        showNotification('error', data.error || 'Không thể xóa tài khoản này');
      }
    } catch (e) {
      showNotification('error', 'Lỗi kết nối máy chủ');
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <div className="customers-container animate-fade-in">
        {/* Toast Notifications */}

      {error && (
        <div style={{
          position: 'fixed', top: '24px', right: '24px', zIndex: 10000,
          background: 'rgba(239, 68, 68, 0.95)', color: '#fff',
          padding: '12px 24px', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)',
          borderLeft: '4px solid #b91c1c', fontWeight: 500, backdropFilter: 'blur(4px)'
        }}>
          ❌ {error}
        </div>
      )}
      {success && (
        <div style={{
          position: 'fixed', top: '24px', right: '24px', zIndex: 10000,
          background: 'rgba(16, 185, 129, 0.95)', color: '#fff',
          padding: '12px 24px', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)',
          borderLeft: '4px solid #047857', fontWeight: 500, backdropFilter: 'blur(4px)'
        }}>
          ✔️ {success}
        </div>
      )}

      {/* Users Table */}
      <div className="glass-panel table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '80px' }}>ID</th>
              <th>Tên đăng nhập</th>
              <th>Vai trò</th>
              <th>Ngày tạo</th>
              <th className="th-actions" style={{ width: '180px' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id} style={{ opacity: user.id === currentUser.id ? 1 : 0.9 }}>
                <td>{user.id}</td>
                <td style={{ fontWeight: 600, color: '#60a5fa' }}>
                  {user.username} {user.id === currentUser.id && <span style={{ fontSize: '11px', color: '#10b981', background: 'rgba(16,185,129,0.15)', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px' }}>(Bạn)</span>}
                </td>
                <td>
                  {user.role === 'admin' ? (
                    <span style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.12)', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>
                      🛡️ Quản trị viên
                    </span>
                  ) : (
                    <span style={{ color: '#a78bfa', background: 'rgba(167,139,250,0.12)', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>
                      👤 Nhân viên
                    </span>
                  )}
                </td>
                <td style={{ color: 'var(--text-muted)' }}>{formatDate(user.created_at)}</td>
                <td>
                  <div className="action-btn-group">
                    <button 
                      className="action-btn-icon action-btn-edit" 
                      title="Sửa thông tin" 
                      onClick={() => openEditModal(user)}
                    >
                      ✏️
                    </button>
                    <button 
                      className="action-btn-icon action-btn-secondary" 
                      title="Đổi mật khẩu" 
                      onClick={() => openPasswordModal(user)}
                    >
                      🔑
                    </button>
                    <button 
                      className="action-btn-icon action-btn-delete" 
                      onClick={() => handleDeleteUser(user)}
                      disabled={user.id === currentUser.id}
                      title={user.id === currentUser.id ? 'Bạn không thể tự xóa tài khoản của mình' : 'Xóa'}
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-muted">Chưa có người dùng nào được cấu hình</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>

      {/* Modal Thêm mới hoặc Sửa thông tin */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel animate-fade-in" style={{ maxWidth: '480px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#60a5fa', marginBottom: '20px' }}>
              {editingUser ? `Sửa thông tin tài khoản: ${editingUser.username}` : 'Thêm tài khoản người sử dụng mới'}
            </h2>
            <form onSubmit={handleSaveUser}>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label>Tên đăng nhập *</label>
                <input 
                  required 
                  className="input-glass" 
                  placeholder="Nhập tên đăng nhập viết liền không dấu" 
                  value={formData.username}
                  onChange={e => setFormData({ ...formData, username: e.target.value })}
                  disabled={!!editingUser} // Không cho phép đổi username nếu đang sửa (để tránh lỗi định danh, hoặc mở rộng sau)
                />
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label>Quyền hạn / Vai trò</label>
                <select 
                  className="input-glass" 
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                  style={{ width: '100%', padding: '10px' }}
                >
                  <option value="user">Nhân viên (User)</option>
                  <option value="admin">Quản trị viên (Admin)</option>
                </select>
              </div>

              {/* Chỉ hiển thị trường mật khẩu khi thêm mới */}
              {!editingUser && (
                <>
                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label>Mật khẩu tài khoản *</label>
                    <input 
                      type="password"
                      required 
                      className="input-glass" 
                      placeholder="Mật khẩu ít nhất 4 ký tự" 
                      value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: '20px' }}>
                    <label>Xác nhận mật khẩu *</label>
                    <input 
                      type="password"
                      required 
                      className="input-glass" 
                      placeholder="Nhập lại mật khẩu" 
                      value={formData.confirmPassword}
                      onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                    />
                  </div>
                </>
              )}

              <div className="modal-actions" style={{ marginTop: '24px' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Hủy</button>
                <button type="submit" className="btn-primary" disabled={saving} style={{ width: 'auto' }}>
                  {saving ? 'Đang xử lý...' : 'Lưu tài khoản'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Đổi mật khẩu độc lập */}
      {isPasswordModalOpen && editingUser && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel animate-fade-in" style={{ maxWidth: '450px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#f59e0b', marginBottom: '20px' }}>
              🔑 Đổi mật khẩu tài khoản: {editingUser.username}
            </h2>
            <form onSubmit={handleChangePassword}>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label>Mật khẩu mới *</label>
                <input 
                  type="password"
                  required 
                  className="input-glass" 
                  placeholder="Nhập mật khẩu mới (ít nhất 4 ký tự)" 
                  value={passwordFormData.newPassword}
                  onChange={e => setPasswordFormData({ ...passwordFormData, newPassword: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label>Xác nhận mật khẩu mới *</label>
                <input 
                  type="password"
                  required 
                  className="input-glass" 
                  placeholder="Nhập lại mật khẩu mới" 
                  value={passwordFormData.confirmNewPassword}
                  onChange={e => setPasswordFormData({ ...passwordFormData, confirmNewPassword: e.target.value })}
                />
              </div>

              <div className="modal-actions" style={{ marginTop: '24px' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsPasswordModalOpen(false)}>Hủy</button>
                <button type="submit" className="btn-primary" disabled={saving} style={{ width: 'auto', background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none' }}>
                  {saving ? 'Đang đổi mật khẩu...' : 'Cập nhật mật khẩu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

