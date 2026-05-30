"use client";

import React, { useState, useEffect } from 'react';
import { useMenu, MenuNode, buildTree } from '@/components/MenuProvider';
import './menu-config.css';

export default function MenuConfigClient() {
  const { menuTree, allNodes, loading, error, refreshMenu } = useMenu();

  // State management
  const [expandedNodes, setExpandedNodes] = useState<{ [key: number]: boolean }>({});
  const [draggedNodeId, setDraggedNodeId] = useState<number | null>(null);
  const [dragOverNodeId, setDragOverNodeId] = useState<number | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'before' | 'inside' | 'after' | null>(null);

  // Edit/Add modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<MenuNode | null>(null);
  const [editFormData, setEditFormData] = useState({
    title: '',
    icon: '📁',
    path: '',
    is_active: true
  });

  // Create form states (quick add in sidebar)
  const [createFormData, setCreateFormData] = useState({
    title: '',
    icon: '📁',
    path: '',
    parent_id: '' // empty string = Root
  });

  // Notifications
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Show notification toast
  const showNotification = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Expand all nodes by default when they load
  useEffect(() => {
    if (allNodes.length > 0) {
      const initialExpanded: { [key: number]: boolean } = {};
      allNodes.forEach(node => {
        // Only expand folders/groups (nodes without paths)
        if (!node.path) {
          initialExpanded[node.id] = true;
        }
      });
      setExpandedNodes(prev => ({ ...initialExpanded, ...prev }));
    }
  }, [allNodes]);

  // Check if target is a descendant of node
  const isDescendant = (nodeId: number, targetId: number): boolean => {
    if (nodeId === targetId) return true;
    const targetNode = allNodes.find(n => n.id === targetId);
    if (!targetNode || targetNode.parent_id === null) return false;
    return isDescendant(nodeId, targetNode.parent_id);
  };

  // Toggle node expansion
  const toggleExpand = (nodeId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  // ------------------------------------------------------------------
  // HTML5 Drag and Drop handlers
  // ------------------------------------------------------------------
  const handleDragStart = (e: React.DragEvent, nodeId: number) => {
    setDraggedNodeId(nodeId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', nodeId.toString());
  };

  const handleDragOver = (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    if (draggedNodeId === null || draggedNodeId === targetId) return;

    // Prevent loop: cannot drop inside itself or its descendant
    if (isDescendant(draggedNodeId, targetId)) {
      e.dataTransfer.dropEffect = 'none';
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const height = rect.height;
    
    let position: 'before' | 'inside' | 'after' = 'inside';
    
    // If it's a folder, allow dropping 'inside'.
    // If it's a link node, dropping 'inside' might make it a subnode, which is allowed by "vô hạn cấp".
    // Let's divide Y range into: Top 30% = before, bottom 30% = after, middle 40% = inside
    if (relativeY < height * 0.3) {
      position = 'before';
    } else if (relativeY > height * 0.7) {
      position = 'after';
    }

    setDragOverNodeId(targetId);
    setDragOverPosition(position);
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragLeave = () => {
    setDragOverNodeId(null);
    setDragOverPosition(null);
  };

  const handleDragEnd = () => {
    setDraggedNodeId(null);
    setDragOverNodeId(null);
    setDragOverPosition(null);
  };

  const handleDrop = async (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    const sourceId = draggedNodeId;
    const position = dragOverPosition;
    
    // Clear drag over states immediately
    setDraggedNodeId(null);
    setDragOverNodeId(null);
    setDragOverPosition(null);

    if (sourceId === null || sourceId === targetId || !position) return;
    if (isDescendant(sourceId, targetId)) return;

    const sourceNode = allNodes.find(n => n.id === sourceId);
    const targetNode = allNodes.find(n => n.id === targetId);
    if (!sourceNode || !targetNode) return;

    let newParentId: number | null = null;
    let updatedNodes: { id: number; parent_id: number | null; sort_order: number }[] = [];

    if (position === 'inside') {
      newParentId = targetId;
      // Get current children of target node
      const children = allNodes
        .filter(n => n.parent_id === targetId && n.id !== sourceId)
        .sort((a, b) => a.sort_order - b.sort_order);

      updatedNodes = [
        { id: sourceId, parent_id: newParentId, sort_order: children.length + 1 }
      ];
    } else {
      // 'before' or 'after'
      newParentId = targetNode.parent_id;
      // Get all siblings in new parent (excluding dragged node)
      const siblings = allNodes
        .filter(n => n.parent_id === newParentId && n.id !== sourceId)
        .sort((a, b) => a.sort_order - b.sort_order);

      const targetIndex = siblings.findIndex(s => s.id === targetId);
      const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
      
      // Insert source node into list
      siblings.splice(insertIndex, 0, sourceNode);

      // Reassign sort orders
      updatedNodes = siblings.map((node, index) => ({
        id: node.id,
        parent_id: newParentId,
        sort_order: index + 1
      }));
    }

    // Call reorder API
    try {
      const res = await fetch('/api/system/menu/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes: updatedNodes })
      });
      const data = await res.json();
      if (!res.ok) {
        showNotification('error', data.error || 'Có lỗi xảy ra khi di chuyển node');
      } else {
        showNotification('success', 'Đã cập nhật vị trí menu thành công!');
        await refreshMenu();
      }
    } catch (err) {
      showNotification('error', 'Không thể kết nối đến máy chủ');
    }
  };

  // ------------------------------------------------------------------
  // CRUD actions handlers
  // ------------------------------------------------------------------
  const handleCreateNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createFormData.title.trim()) {
      showNotification('error', 'Vui lòng nhập tên hiển thị');
      return;
    }

    setSubmitting(true);
    try {
      const parentIdVal = createFormData.parent_id ? parseInt(createFormData.parent_id, 10) : null;
      const bodyData = {
        title: createFormData.title.trim(),
        icon: createFormData.icon || '📁',
        path: createFormData.path.trim() || null,
        parent_id: parentIdVal
      };

      const res = await fetch('/api/system/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });

      const data = await res.json();
      if (!res.ok) {
        showNotification('error', data.error || 'Lỗi khi tạo menu mới');
      } else {
        showNotification('success', `Đã thêm "${createFormData.title}" thành công!`);
        setCreateFormData({
          title: '',
          icon: '📁',
          path: '',
          parent_id: ''
        });
        await refreshMenu();
      }
    } catch (err) {
      showNotification('error', 'Lỗi kết nối máy chủ');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (node: MenuNode) => {
    setEditingNode(node);
    setEditFormData({
      title: node.title,
      icon: node.icon || '📁',
      path: node.path || '',
      is_active: node.is_active
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNode) return;
    if (!editFormData.title.trim()) {
      showNotification('error', 'Vui lòng nhập tên hiển thị');
      return;
    }

    setSubmitting(true);
    try {
      const bodyData = {
        title: editFormData.title.trim(),
        icon: editFormData.icon || '📁',
        path: editFormData.path.trim() || null,
        is_active: editFormData.is_active
      };

      const res = await fetch(`/api/system/menu/${editingNode.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });

      const data = await res.json();
      if (!res.ok) {
        showNotification('error', data.error || 'Lỗi khi cập nhật menu');
      } else {
        showNotification('success', 'Đã cập nhật thông tin menu thành công!');
        setIsEditModalOpen(false);
        setEditingNode(null);
        await refreshMenu();
      }
    } catch (err) {
      showNotification('error', 'Lỗi kết nối máy chủ');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteNode = async (node: MenuNode) => {
    // Count total descendant children recursively
    const getDescendantsCount = (nodeId: number): number => {
      let count = 0;
      const children = allNodes.filter(n => n.parent_id === nodeId);
      count += children.length;
      children.forEach(c => {
        count += getDescendantsCount(c.id);
      });
      return count;
    };

    const childCount = getDescendantsCount(node.id);
    let confirmMsg = `Bạn có chắc chắn muốn xóa "${node.title}"?`;
    if (childCount > 0) {
      confirmMsg = `⚠️ CẢNH BÁO: Nhóm "${node.title}" chứa ${childCount} nhóm con/chức năng bên trong. Xóa nhóm này sẽ xóa vĩnh viễn TOÀN BỘ các nhóm con đó. Bạn có chắc chắn muốn tiếp tục?`;
    }

    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/system/menu/${node.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) {
        showNotification('error', data.error || 'Lỗi khi xóa menu');
      } else {
        showNotification('success', `Đã xóa menu thành công!`);
        await refreshMenu();
      }
    } catch (err) {
      showNotification('error', 'Lỗi kết nối máy chủ');
    }
  };

  // Helper: Open quick add with pre-selected parent
  const handleAddSubnodeClick = (parentNode: MenuNode) => {
    setCreateFormData(prev => ({
      ...prev,
      parent_id: parentNode.id.toString(),
      icon: '📁' // reset to default folder
    }));
    // Scroll to the sidebar form if needed
    const formEl = document.getElementById('quick-add-form');
    if (formEl) {
      formEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // ------------------------------------------------------------------
  // Recursive Tree Rendering
  // ------------------------------------------------------------------
  const renderTreeNodes = (nodes: MenuNode[], depth: number = 0) => {
    return nodes.map((node) => {
      const isExpanded = expandedNodes[node.id] !== false; // default to true
      const hasChildren = node.children && node.children.length > 0;
      const isFolder = !node.path;

      // Determine badges
      let typeBadge = <span className="node-type-badge badge-link">Liên kết</span>;
      if (node.parent_id === null) {
        typeBadge = <span className="node-type-badge badge-root">Phân hệ gốc</span>;
      } else if (isFolder) {
        typeBadge = <span className="node-type-badge badge-folder">Nhóm con</span>;
      }

      // Drag over styles
      let dragOverClass = '';
      if (dragOverNodeId === node.id) {
        dragOverClass = `drag-over-${dragOverPosition}`;
      }

      return (
        <div 
          key={node.id} 
          className={`menu-node-row-container ${dragOverClass}`}
          style={{ paddingLeft: `${depth * 24}px` }}
        >
          {depth > 0 && (
            <div 
              className="tree-indent-line" 
              style={{ left: `${(depth - 0.5) * 24 + 10}px` }}
            />
          )}

          <div
            className={`menu-node-row ${draggedNodeId === node.id ? 'dragging' : ''}`}
            draggable={true}
            onDragStart={(e) => handleDragStart(e, node.id)}
            onDragOver={(e) => handleDragOver(e, node.id)}
            onDragLeave={handleDragLeave}
            onDragEnd={handleDragEnd}
            onDrop={(e) => handleDrop(e, node.id)}
          >
            <div className="node-left-content">
              <span className="node-drag-handle" title="Kéo thả để sắp xếp">☰</span>
              
              {isFolder ? (
                <button 
                  className="node-collapse-btn" 
                  onClick={(e) => toggleExpand(node.id, e)}
                  title={isExpanded ? 'Thu gọn' : 'Mở rộng'}
                >
                  {isExpanded ? '▼' : '▶'}
                </button>
              ) : (
                <span style={{ width: '20px' }} />
              )}

              <span className="node-icon">{node.icon}</span>
              <span className="node-title" style={{ opacity: node.is_active ? 1 : 0.4 }}>
                {node.title} {!node.is_active && <span style={{ fontSize: '11px', color: 'var(--danger)' }}>(Ẩn)</span>}
              </span>

              {node.path && (
                <span className="node-path-badge" title={node.path}>{node.path}</span>
              )}
              {typeBadge}
            </div>

            <div className="node-actions">
              {/* Button to add child node directly */}
              <button 
                className="node-action-btn btn-add-sub" 
                onClick={() => handleAddSubnodeClick(node)}
                title={`Thêm nhóm hoặc chức năng con vào "${node.title}"`}
              >
                ➕
              </button>
              
              {/* Edit button */}
              <button 
                className="node-action-btn" 
                onClick={() => openEditModal(node)}
                title="Sửa thông tin"
              >
                ✏️
              </button>

              {/* Delete button */}
              <button 
                className="node-action-btn btn-delete" 
                onClick={() => handleDeleteNode(node)}
                title="Xóa vĩnh viễn"
              >
                🗑️
              </button>
            </div>
          </div>

          {/* Render children if expanded */}
          {hasChildren && isExpanded && (
            <div style={{ marginTop: '4px' }}>
              {renderTreeNodes(node.children!, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  // Filter list of folders for parent_id selection dropdown
  // We want to avoid listing link-only nodes to keep dropdown simple, or listing all
  const folderNodes = allNodes.filter(n => !n.path);

  return (
    <>
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed', top: '24px', right: '24px', zIndex: 10000,
          background: toast.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(16, 185, 129, 0.95)', 
          color: '#fff',
          padding: '12px 24px', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)',
          borderLeft: toast.type === 'error' ? '4px solid #b91c1c' : '4px solid #047857', 
          fontWeight: 500, backdropFilter: 'blur(4px)'
        }}>
          {toast.type === 'error' ? '❌ ' : '✔️ '}{toast.message}
        </div>
      )}

      <div className="menu-config-container">
        
        {/* LEFT PANEL: Quick action controls */}
        <div className="glass-panel menu-sidebar-panel">
          <div className="panel-header">
            <h2>🛠️ Thao Tác Nhanh</h2>
          </div>

          <form id="quick-add-form" onSubmit={handleCreateNode} className="quick-action-card">
            <h3>➕ Thêm Node Menu Mới</h3>
            
            <div className="form-field">
              <label>Tên hiển thị (Tiêu đề) *</label>
              <input 
                type="text"
                required
                className="input-glass"
                placeholder="Ví dụ: Danh mục vật tư, Báo cáo mới"
                value={createFormData.title}
                onChange={e => setCreateFormData({ ...createFormData, title: e.target.value })}
              />
            </div>

            <div className="form-row">
              <div className="form-field" style={{ flex: 1 }}>
                <label>Emoji Icon</label>
                <input 
                  type="text"
                  className="input-glass"
                  placeholder="📁, 🧱, 📊"
                  value={createFormData.icon}
                  onChange={e => setCreateFormData({ ...createFormData, icon: e.target.value })}
                />
              </div>

              <div className="form-field" style={{ flex: 2 }}>
                <label>Nhóm cha (Vị trí)</label>
                <select 
                  className="select-glass"
                  value={createFormData.parent_id}
                  onChange={e => setCreateFormData({ ...createFormData, parent_id: e.target.value })}
                >
                  <option value="">[Root - Phân hệ gốc]</option>
                  {folderNodes.map(folder => (
                    <option key={folder.id} value={folder.id}>
                      {folder.parent_id ? '📁 ' : '📋 '} {folder.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-field">
              <label>Đường dẫn (Path) - Để trống nếu là Thư mục/Nhóm</label>
              <input 
                type="text"
                className="input-glass"
                placeholder="Ví dụ: /materials, /reports/inventory"
                value={createFormData.path}
                onChange={e => setCreateFormData({ ...createFormData, path: e.target.value })}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                * Nếu điền đường dẫn, node sẽ hoạt động như link điều hướng. Nếu để trống, node hoạt động như một nhóm chứa con.
              </span>
            </div>

            <button 
              type="submit" 
              className="btn-primary" 
              disabled={submitting}
              style={{ marginTop: '8px' }}
            >
              {submitting ? 'Đang thêm...' : '➕ Thêm Menu'}
            </button>
          </form>

          <div className="quick-action-card" style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
            <h3>💡 Hướng Dẫn Sử Dụng</h3>
            <ul style={{ paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li><strong>Kéo thả:</strong> Nhấp và giữ biểu tượng <span style={{ fontWeight: 'bold' }}>☰</span> để di chuyển menu đến vị trí khác.</li>
              <li><strong>Tạo nhóm con:</strong> Để trống ô <span style={{ fontStyle: 'italic' }}>Đường dẫn</span> khi thêm menu mới.</li>
              <li><strong>Cấp độ:</strong> Hệ thống hỗ trợ <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>vô hạn cấp</span>, bạn có thể tạo cây thư mục sâu bao nhiêu tuỳ thích.</li>
              <li><strong>Ẩn/Hiện:</strong> Click biểu tượng sửa <span style={{ fontStyle: 'italic' }}>✏️</span> để tạm thời ẩn menu khỏi Sidebar/Topbar.</li>
            </ul>
          </div>
        </div>

        {/* RIGHT PANEL: The Tree View */}
        <div className="glass-panel menu-tree-panel">
          <div className="panel-header">
            <h2>📋 Cấu Trúc Menu Hệ Thống</h2>
            <button 
              className="btn-primary"
              style={{ width: 'auto', padding: '8px 16px', fontSize: '13px' }}
              onClick={async () => {
                await refreshMenu();
                showNotification('success', 'Đã làm mới sơ đồ menu!');
              }}
            >
              🔄 Làm mới
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              Đang tải sơ đồ menu từ cơ sở dữ liệu...
            </div>
          ) : error && menuTree.length === 0 ? (
            <div className="empty-tree-state">
              ❌ Lỗi tải menu: {error}. Đang hiển thị menu fallback mặc định.
            </div>
          ) : menuTree.length === 0 ? (
            <div className="empty-tree-state">
              📂 Chưa có cấu trúc menu nào. Hãy dùng form bên trái để thêm Phân hệ gốc đầu tiên!
            </div>
          ) : (
            <div className="menu-nodes-tree">
              {renderTreeNodes(menuTree)}
            </div>
          )}
        </div>

      </div>

      {/* MODAL: Sửa thông tin node menu */}
      {isEditModalOpen && editingNode && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel animate-fade-in" style={{ maxWidth: '480px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#60a5fa', marginBottom: '20px' }}>
              ✏️ Sửa Thông Tin Menu: {editingNode.title}
            </h2>
            <form onSubmit={handleUpdateNode}>
              
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label>Tên hiển thị (Tiêu đề) *</label>
                <input 
                  type="text"
                  required
                  className="input-glass"
                  value={editFormData.title}
                  onChange={e => setEditFormData({ ...editFormData, title: e.target.value })}
                />
              </div>

              <div className="form-row" style={{ marginBottom: '16px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Emoji Icon</label>
                  <input 
                    type="text"
                    className="input-glass"
                    value={editFormData.icon}
                    onChange={e => setEditFormData({ ...editFormData, icon: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ flex: 2, display: 'flex', alignItems: 'center', paddingLeft: '16px', paddingTop: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
                    <input 
                      type="checkbox"
                      checked={editFormData.is_active}
                      onChange={e => setEditFormData({ ...editFormData, is_active: e.target.checked })}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span>Kích hoạt (Hiển thị)</span>
                  </label>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label>Đường dẫn (Path) - Để trống nếu là Thư mục/Nhóm</label>
                <input 
                  type="text"
                  className="input-glass"
                  placeholder="Ví dụ: /materials, /reports/inventory"
                  value={editFormData.path}
                  onChange={e => setEditFormData({ ...editFormData, path: e.target.value })}
                />
              </div>

              <div className="modal-actions" style={{ marginTop: '24px' }}>
                <button type="button" className="btn-secondary" onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingNode(null);
                }}>
                  Hủy
                </button>
                <button type="submit" className="btn-primary" disabled={submitting} style={{ width: 'auto' }}>
                  {submitting ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
