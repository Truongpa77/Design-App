"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMenu, MenuNode } from '@/components/MenuProvider';

export default function Sidebar({ user }: { user: any }) {
  const pathname = usePathname() || '';
  const { 
    menuTree, 
    loading, 
    openContextMenu,
    activeLayoutId,
    setActiveLayoutId,
    layouts,
    refreshLayouts
  } = useMenu();
  
  const [openNodeIds, setOpenNodeIds] = useState<{ [key: number]: boolean }>({});

  // Layout selection & creation states
  const [isLayoutPopupOpen, setIsLayoutPopupOpen] = useState(false);
  const [isAddLayoutModalOpen, setIsAddLayoutModalOpen] = useState(false);
  const [newLayoutId, setNewLayoutId] = useState('');
  const [newLayoutName, setNewLayoutName] = useState('');
  const [newLayoutIcon, setNewLayoutIcon] = useState('📋');
  const [layoutError, setLayoutError] = useState('');

  // Close popup on click outside
  useEffect(() => {
    if (!isLayoutPopupOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.layout-selector-wrapper')) {
        setIsLayoutPopupOpen(false);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [isLayoutPopupOpen]);

  const activeLayout = layouts.find(l => l.id === activeLayoutId) || {
    id: 'admin',
    name: 'Admin',
    icon: '🔑',
    is_system: true
  };

  const isNodeOpen = (id: number) => {
    return !!openNodeIds[id];
  };

  const toggleNode = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenNodeIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Auto-expand parents based on active route
  useEffect(() => {
    if (!pathname || pathname === '/' || menuTree.length === 0) {
      if (menuTree.length > 0 && Object.keys(openNodeIds).length === 0) {
        const defaultOpen: { [key: number]: boolean } = {};
        menuTree.slice(0, 2).forEach(node => {
          defaultOpen[node.id] = true;
        });
        setOpenNodeIds(defaultOpen);
      }
      return;
    }

    const openAncestors: { [key: number]: boolean } = {};
    
    const findAndOpenAncestors = (nodes: MenuNode[]): boolean => {
      for (const node of nodes) {
        if (node.path && pathname.startsWith(node.path)) {
          return true;
        }
        if (node.children && node.children.length > 0) {
          const found = findAndOpenAncestors(node.children);
          if (found) {
            openAncestors[node.id] = true;
            return true;
          }
        }
      }
      return false;
    };

    findAndOpenAncestors(menuTree);
    if (Object.keys(openAncestors).length > 0) {
      setOpenNodeIds(prev => ({ ...prev, ...openAncestors }));
    }
  }, [pathname, menuTree]);

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  const handleDeleteLayout = async (layoutIdToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Bạn có chắc chắn muốn xóa layout "${layoutIdToDelete}"? Tất cả menu/phân hệ thuộc layout này sẽ bị xóa.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/system/layouts?id=${layoutIdToDelete}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        await refreshLayouts();
        if (activeLayoutId === layoutIdToDelete) {
          setActiveLayoutId('admin');
        }
      } else {
        const errData = await res.json();
        alert(errData.error || 'Lỗi khi xóa layout');
      }
    } catch (err) {
      console.error(err);
      alert('Không thể kết nối máy chủ');
    }
  };

  const handleCreateLayout = async (e: React.FormEvent) => {
    e.preventDefault();
    setLayoutError('');

    const trimmedId = newLayoutId.trim().toLowerCase();
    const trimmedName = newLayoutName.trim();

    if (!trimmedId || !trimmedName) {
      setLayoutError('Vui lòng điền đầy đủ Mã và Tên layout');
      return;
    }

    if (!/^[a-z0-9_]+$/.test(trimmedId)) {
      setLayoutError('Mã layout chỉ gồm ký tự thường, số và dấu gạch dưới');
      return;
    }

    try {
      const res = await fetch('/api/system/layouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: trimmedId,
          name: trimmedName,
          icon: newLayoutIcon
        })
      });

      const data = await res.json();
      if (res.ok) {
        await refreshLayouts();
        setActiveLayoutId(trimmedId);
        setIsAddLayoutModalOpen(false);
        setIsLayoutPopupOpen(false);
        setNewLayoutId('');
        setNewLayoutName('');
        setNewLayoutIcon('📋');
      } else {
        setLayoutError(data.error || 'Lỗi khi tạo layout');
      }
    } catch (err) {
      console.error(err);
      setLayoutError('Lỗi kết nối máy chủ');
    }
  };

  // Recursive render function for sidebar tree
  const renderSidebarNodes = (nodes: MenuNode[], depth: number = 0) => {
    return nodes.map((node) => {
      if (node.path && node.path.startsWith('#separator')) {
        return (
          <hr 
            key={node.id} 
            className="sidebar-menu-separator" 
            onContextMenu={(e) => openContextMenu(e, node.id)}
          />
        );
      }

      const isFolder = !node.path || node.path.startsWith('#header');
      const isOpen = isNodeOpen(node.id);
      const hasChildren = node.children && node.children.length > 0;

      if (isFolder) {
        const isRoot = node.parent_id === null;
        
        return (
          <div className={isRoot ? "nav-group" : "nav-sub-group"} key={node.id} style={{ marginTop: isRoot ? '12px' : '4px' }}>
            <div
              className="nav-group-title"
              onClick={(e) => toggleNode(node.id, e)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                userSelect: 'none',
                padding: '10px 16px',
                paddingLeft: isRoot ? '16px' : `${16 + depth * 12}px`,
                borderRadius: '6px',
                transition: 'background 0.2s, color 0.2s',
                color: isOpen ? 'var(--primary-color)' : 'var(--text-muted)',
                fontSize: isRoot ? '11px' : '13px',
                fontWeight: isRoot ? 700 : 500,
                textTransform: isRoot ? 'uppercase' : 'none',
                letterSpacing: isRoot ? '0.05em' : 'normal',
                opacity: isRoot ? 0.7 : 0.9,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              onContextMenu={(e) => openContextMenu(e, node.id)}
            >
              <span>{node.icon} {node.title}</span>
              {hasChildren && (
                <span style={{
                  fontSize: '8px',
                  transition: 'transform 0.25s ease',
                  transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                }}>▶</span>
              )}
            </div>

            {hasChildren && isOpen && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}>
                {renderSidebarNodes(node.children!, depth + 1)}
              </div>
            )}
          </div>
        );
      } else {
        return (
          <Link
            key={node.path}
            href={node.path!}
            className={`nav-item ${depth > 0 ? 'sub-item' : ''} ${isActive(node.path!) ? 'active' : ''}`}
            style={{
              paddingLeft: `${16 + depth * 14}px`,
              fontSize: '14px',
            }}
            onContextMenu={(e) => openContextMenu(e, node.id)}
          >
            {node.icon} {node.title}
          </Link>
        );
      }
    });
  };

  return (
    <aside className="sidebar glass-panel">
      <div className="sidebar-header">
        <div className="logo-icon">🛋️</div>
        <h2>ProDure</h2>
      </div>
      <nav className="sidebar-nav">
        <Link href="/" className={`nav-item ${isActive('/') ? 'active' : ''}`}>
          🏠 Tổng quan
        </Link>

        {loading ? (
          <div style={{ padding: '20px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
            Đang tải menu...
          </div>
        ) : (
          renderSidebarNodes(menuTree)
        )}
      </nav>
      <div className="sidebar-footer">
        {/* Layout Selector */}
        <div className="layout-selector-wrapper">
          <button 
            type="button" 
            className="layout-selector-trigger"
            onClick={() => setIsLayoutPopupOpen(!isLayoutPopupOpen)}
          >
            <div className="layout-selector-trigger-content">
              <span>{activeLayout.icon}</span>
              <span>{activeLayout.name}</span>
            </div>
            <span className="layout-selector-arrow">
              {isLayoutPopupOpen ? '▲' : '▼'}
            </span>
          </button>

          {isLayoutPopupOpen && (
            <div className="layout-popup">
              {layouts.map((l) => (
                <div 
                  key={l.id} 
                  className={`layout-popup-item ${activeLayoutId === l.id ? 'active' : ''}`}
                  onClick={() => {
                    setActiveLayoutId(l.id);
                    setIsLayoutPopupOpen(false);
                  }}
                >
                  <div className="layout-popup-item-left">
                    <span>{l.icon}</span>
                    <span>{l.name}</span>
                  </div>
                  {!l.is_system && (
                    <button 
                      type="button" 
                      className="layout-popup-delete-btn"
                      title="Xóa layout"
                      onClick={(e) => handleDeleteLayout(l.id, e)}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              ))}
              <div className="layout-popup-divider" />
              <button 
                type="button" 
                className="layout-popup-add-btn"
                onClick={() => setIsAddLayoutModalOpen(true)}
              >
                ➕ Tạo Layout mới...
              </button>
            </div>
          )}
        </div>

        <div className="user-info">
          <span className="user-avatar">👤</span>
          <div>
            <p className="user-name">{user?.username || 'Guest'}</p>
            <p className="user-role">{user?.role === 'admin' ? 'Quản trị viên' : 'Nhân viên'}</p>
          </div>
        </div>
        <form action="/api/auth/logout" method="POST">
          <button type="submit" className="btn-logout">Đăng xuất</button>
        </form>
      </div>

      {/* Add Layout Modal Overlay */}
      {isAddLayoutModalOpen && (
        <div className="layout-add-modal-overlay">
          <form className="layout-add-modal" onSubmit={handleCreateLayout}>
            <h3 className="layout-add-modal-title">Tạo Layout Mới</h3>
            
            {layoutError && (
              <div style={{ color: 'var(--danger)', fontSize: '12px', marginBottom: '8px' }}>
                ❌ {layoutError}
              </div>
            )}

            <div className="layout-add-field">
              <label>Mã Layout (slug)</label>
              <input 
                type="text" 
                className="layout-add-input"
                placeholder="vd: marketing_dept"
                value={newLayoutId}
                onChange={(e) => setNewLayoutId(e.target.value)}
                required
              />
            </div>

            <div className="layout-add-field">
              <label>Tên hiển thị</label>
              <input 
                type="text" 
                className="layout-add-input"
                placeholder="vd: Phòng Marketing"
                value={newLayoutName}
                onChange={(e) => setNewLayoutName(e.target.value)}
                required
              />
            </div>

            <div className="layout-add-field">
              <label>Icon (Emoji)</label>
              <input 
                type="text" 
                className="layout-add-input"
                placeholder="vd: 📢"
                value={newLayoutIcon}
                onChange={(e) => setNewLayoutIcon(e.target.value)}
                maxLength={2}
              />
            </div>

            <div className="layout-add-actions">
              <button 
                type="button" 
                className="layout-add-btn-cancel"
                onClick={() => {
                  setIsAddLayoutModalOpen(false);
                  setLayoutError('');
                }}
              >
                Hủy bỏ
              </button>
              <button type="submit" className="layout-add-btn-submit">
                Tạo mới
              </button>
            </div>
          </form>
        </div>
      )}
    </aside>
  );
}
