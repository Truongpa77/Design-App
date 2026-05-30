"use client";

import React, { useState, useEffect } from 'react';
import { useMenu, MenuNode, buildTree } from './MenuProvider';

// Helper to check if a node is descendant of another
const isDescendant = (nodeId: number, targetId: number, nodes: MenuNode[]): boolean => {
  if (nodeId === targetId) return true;
  const targetNode = nodes.find(n => n.id === targetId);
  if (!targetNode || targetNode.parent_id === null) return false;
  return isDescendant(nodeId, targetNode.parent_id, nodes);
};

const isActionPath = (path: string | null): boolean => {
  if (!path) return false;
  return path.endsWith('/create') || path.endsWith('/edit') || path.endsWith('/delete');
};

const getActionTypeFromPath = (path: string): string => {
  if (path.endsWith('/create')) return 'action-create';
  if (path.endsWith('/edit')) return 'action-edit';
  if (path.endsWith('/delete')) return 'action-delete';
  return '';
};

const resolveActionPath = (actionType: string, parentNode: MenuNode | undefined): string => {
  if (!parentNode || !parentNode.path) return `#action-${actionType}-temp`;
  const basePath = parentNode.path.split('#')[0];
  if (actionType === 'action-create') return `${basePath}/create`;
  if (actionType === 'action-edit') return `${basePath}/edit`;
  if (actionType === 'action-delete') return `${basePath}/delete`;
  return `#action-${actionType}-temp`;
};

const deleteNodeAndDescendants = (nodeId: number, nodes: MenuNode[]): MenuNode[] => {
  const children = nodes.filter(n => n.parent_id === nodeId);
  let updatedNodes = nodes.filter(n => n.id !== nodeId);
  for (const child of children) {
    updatedNodes = deleteNodeAndDescendants(child.id, updatedNodes);
  }
  return updatedNodes;
};

export default function MenuSettingsModal() {
  const { 
    isSettingsModalOpen, 
    closeSettingsModal, 
    allNodes, 
    refreshMenu, 
    settingsHighlightNodeId,
    activeLayoutId,
    masterFeatures,
    refreshMasterFeatures
  } = useMenu();

  // Local state for layout editing
  const [localNodes, setLocalNodes] = useState<MenuNode[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<{ [key: number]: boolean }>({});
  
  // Drag & drop state variables
  const [dragOverNodeId, setDragOverNodeId] = useState<number | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'before' | 'inside' | 'after' | null>(null);
  const [isLeftDragOver, setIsLeftDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Header inline editing states
  const [editingHeaderId, setEditingHeaderId] = useState<number | null>(null);
  const [editingHeaderText, setEditingHeaderText] = useState('');

  // Master features management sub-modal state
  const [isManageFeaturesOpen, setIsManageFeaturesOpen] = useState(false);
  const [mFeatureTitle, setMFeatureTitle] = useState('');
  const [mFeatureIcon, setMFeatureIcon] = useState('📋');
  const [mFeaturePath, setMFeaturePath] = useState('');
  const [editingMFeatureId, setEditingMFeatureId] = useState<number | null>(null);
  const [mFeatureError, setMFeatureError] = useState('');
  const [submittingMFeature, setSubmittingMFeature] = useState(false);

  // Toast notification
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  // Initialize local copy of nodes when modal opens
  useEffect(() => {
    if (isSettingsModalOpen) {
      // Deep clone allNodes
      const cloned = JSON.parse(JSON.stringify(allNodes)) as MenuNode[];
      setLocalNodes(cloned);
      setSearchTerm('');
      setEditingHeaderId(null);
      
      // Auto-expand all folders
      const initialExpanded: { [key: number]: boolean } = {};
      cloned.forEach(node => {
        if (!node.path) {
          initialExpanded[node.id] = true;
        }
      });

      // Ancestor expansion for right-clicked node
      if (settingsHighlightNodeId) {
        let current = cloned.find(n => n.id === settingsHighlightNodeId);
        while (current) {
          if (current.parent_id !== null) {
            initialExpanded[current.parent_id] = true;
          }
          current = cloned.find(n => n.id === current?.parent_id);
        }
      }
      setExpandedNodes(initialExpanded);
    }
  }, [isSettingsModalOpen, allNodes, settingsHighlightNodeId]);

  if (!isSettingsModalOpen) return null;

  // Toggle node expansion
  const toggleExpand = (id: number) => {
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Drag handlers for Left Pane (source of features/templates)
  const handleLeftDragStart = (e: React.DragEvent, nodeData: any) => {
    e.dataTransfer.effectAllowed = 'copyMove';
    e.dataTransfer.setData('application/json', JSON.stringify({ source: 'left', node: nodeData }));
  };

  // Left Pane dropzone: handles removing items from the menu
  const handleLeftDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsLeftDragOver(true);
  };

  const handleLeftDragLeave = () => {
    setIsLeftDragOver(false);
  };

  const handleLeftDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsLeftDragOver(false);
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data.source === 'right') {
        const nodeId = data.id;
        setLocalNodes(prev => deleteNodeAndDescendants(nodeId, prev));
        showToast('success', 'Đã gỡ chức năng khỏi menu');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Drag handlers for Right Pane (the active menu structure)
  const handleRightDragStart = (e: React.DragEvent, nodeId: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify({ source: 'right', id: nodeId }));
  };

  const handleRightDragOver = (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const height = rect.height;
    
    const targetNode = localNodes.find(n => n.id === targetId);
    if (!targetNode) return;
    
    // Thư mục (path là null) hoặc mục nhóm mẹ (path bắt đầu bằng #header) được coi là Folder chứa con
    const isFolder = !targetNode.path || targetNode.path.startsWith('#header');
    
    let position: 'before' | 'inside' | 'after' = 'inside';
    if (!isFolder) {
      // For links/separators/headers, we can only drop before or after
      position = relativeY < height * 0.5 ? 'before' : 'after';
    } else {
      // For folder groups, we can drop before, after, or inside (middle region)
      if (relativeY < height * 0.3) {
        position = 'before';
      } else if (relativeY > height * 0.7) {
        position = 'after';
      } else {
        position = 'inside';
      }
    }
    
    setDragOverNodeId(targetId);
    setDragOverPosition(position);
  };

  const handleRightDragLeave = () => {
    setDragOverNodeId(null);
    setDragOverPosition(null);
  };

  const handleRightDrop = (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    const overNodeId = targetId;
    const overPos = dragOverPosition;
    
    setDragOverNodeId(null);
    setDragOverPosition(null);
    
    if (!overPos) return;

    try {
      const dragData = JSON.parse(e.dataTransfer.getData('application/json'));
      let sourceNode: MenuNode | null = null;
      
      // A. Draggng from LEFT to RIGHT (Adding)
      if (dragData.source === 'left') {
        if (dragData.node.isVirtual) {
          // Virtual items (Separator, Header, or CRUD Actions)
          const tempId = -Math.floor(Math.random() * 1000000) - 1;
          const isSeparator = dragData.node.type === 'separator';
          
          let title = 'Nhóm mẹ mới';
          let icon = '📁';
          let path = `#header-temp-${tempId}`;
          
          if (isSeparator) {
            title = '<Mục phân cách>';
            icon = '➖';
            path = `#separator-temp-${tempId}`;
          } else if (dragData.node.type === 'action-create') {
            title = 'Thêm mới';
            icon = '➕';
            path = `#action-create-temp-${tempId}`;
          } else if (dragData.node.type === 'action-edit') {
            title = 'Sửa';
            icon = '✏️';
            path = `#action-edit-temp-${tempId}`;
          } else if (dragData.node.type === 'action-delete') {
            title = 'Xóa';
            icon = '🗑️';
            path = `#action-delete-temp-${tempId}`;
          }

          sourceNode = {
            id: tempId,
            parent_id: null,
            sort_order: 999,
            title,
            icon,
            path,
            is_active: true,
            show_in_menu: true,
            show_in_submenu: true
          };
        } else {
          // Master features from catalog
          const feature = dragData.node.feature;
          // Check if there is an existing inactive/active node with the same path in localNodes
          const existingNode = localNodes.find(n => n.path === feature.path);
          if (existingNode) {
            sourceNode = {
              ...existingNode,
              is_active: true
            };
          } else {
            const tempId = -Math.floor(Math.random() * 1000000) - 1;
            sourceNode = {
              id: tempId,
              parent_id: null,
              sort_order: 999,
              title: feature.title,
              icon: feature.icon,
              path: feature.path,
              is_active: true,
              show_in_menu: true,
              show_in_submenu: true
            };
          }
        }
      } 
      // B. Dragging internally in RIGHT pane (Reordering)
      else if (dragData.source === 'right') {
        const existingNode = localNodes.find(n => n.id === dragData.id);
        if (existingNode) {
          sourceNode = existingNode;
        }
      }
      
      if (!sourceNode) return;
      
      // Prevent loop drop
      if (dragData.source === 'right' && isDescendant(sourceNode.id, targetId, localNodes)) {
        return;
      }
      
      const targetNode = localNodes.find(n => n.id === targetId);
      if (!targetNode) return;
      
      let newParentId: number | null = null;
      
      if (overPos === 'inside') {
        newParentId = targetId;
        
        // Resolve action path based on new parent
        if (sourceNode.path && sourceNode.path.startsWith('#action-')) {
          const actionType = dragData.node.type;
          sourceNode.path = resolveActionPath(actionType, targetNode);
        } else if (isActionPath(sourceNode.path)) {
          const actionType = getActionTypeFromPath(sourceNode.path!);
          sourceNode.path = resolveActionPath(actionType, targetNode);
        }

        const children = localNodes
          .filter(n => n.parent_id === targetId && n.id !== sourceNode!.id && n.is_active)
          .sort((a, b) => a.sort_order - b.sort_order);
        
        const updatedSourceNode = { ...sourceNode, parent_id: newParentId, sort_order: children.length + 1 };
        
        setLocalNodes(prev => {
          const filtered = prev.filter(n => n.id !== sourceNode!.id);
          return [...filtered, updatedSourceNode];
        });
        showToast('success', 'Đã thêm chức năng vào nhóm');
      } else {
        // 'before' or 'after'
        newParentId = targetNode.parent_id;
        const parentNode = localNodes.find(n => n.id === newParentId);
        
        // Resolve action path based on new parent
        if (sourceNode.path && sourceNode.path.startsWith('#action-')) {
          const actionType = dragData.node.type;
          sourceNode.path = resolveActionPath(actionType, parentNode);
        } else if (isActionPath(sourceNode.path)) {
          const actionType = getActionTypeFromPath(sourceNode.path!);
          sourceNode.path = resolveActionPath(actionType, parentNode);
        }

        const siblings = localNodes
          .filter(n => n.parent_id === newParentId && n.id !== sourceNode!.id && n.is_active)
          .sort((a, b) => a.sort_order - b.sort_order);
          
        const targetIndex = siblings.findIndex(s => s.id === targetId);
        const insertIndex = overPos === 'before' ? targetIndex : targetIndex + 1;
        
        const updatedSourceNode = { ...sourceNode, parent_id: newParentId };
        siblings.splice(insertIndex, 0, updatedSourceNode);
        
        const updatedSiblings = siblings.map((node, index) => ({
          ...node,
          sort_order: index + 1
        }));
        
        setLocalNodes(prev => {
          const siblingIds = new Set(siblings.map(s => s.id));
          const filtered = prev.filter(n => !siblingIds.has(n.id) && n.id !== sourceNode!.id);
          return [...filtered, ...updatedSiblings];
        });
        showToast('success', 'Đã sắp xếp lại thứ tự');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Save layout back to DB via API
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/system/menu/save-layout?layout=${activeLayoutId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes: localNodes })
      });
      const data = await res.json();
      if (!res.ok) {
        showToast('error', data.error || 'Lỗi khi lưu sơ đồ menu');
      } else {
        showToast('success', 'Đã lưu thiết lập menu thành công!');
        await refreshMenu();
        setTimeout(() => {
          closeSettingsModal();
        }, 800);
      }
    } catch (err) {
      showToast('error', 'Lỗi kết nối máy chủ');
    } finally {
      setSaving(false);
    }
  };

  // Header Title Inline Editor handlers
  const startEditHeader = (node: MenuNode) => {
    setEditingHeaderId(node.id);
    setEditingHeaderText(node.title);
  };

  const saveHeaderTitle = (nodeId: number) => {
    if (editingHeaderText.trim()) {
      setLocalNodes(prev => prev.map(n => n.id === nodeId ? { ...n, title: editingHeaderText.trim() } : n));
    }
    setEditingHeaderId(null);
  };

  // Left Pane Features Pool (all system features from master catalog)
  const filteredMasterFeatures = masterFeatures.filter(feature => {
    if (searchTerm.trim() === '') return true;
    return feature.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
           feature.path.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Re-build active tree from local state nodes
  const activeTree = buildTree(localNodes.filter(n => n.is_active));

  // Recursive render function for right tree nodes
  const renderRightTree = (nodes: MenuNode[], depth: number = 0): React.ReactNode => {
    return nodes.map((node) => {
      const isSeparator = node.path && node.path.startsWith('#separator');
      const isHeader = node.path && node.path.startsWith('#header');
      const isFolder = !node.path || isHeader; // Cả thư mục thường và nhóm mẹ đều là Folder chứa con
      const hasChildren = node.children && node.children.length > 0;
      const isExpanded = expandedNodes[node.id] !== false; // Default expanded

      // Check drag over states
      let dragOverClass = '';
      if (dragOverNodeId === node.id && dragOverPosition) {
        if (dragOverPosition === 'before') dragOverClass = 'menu-right-drag-over-line-before';
        else if (dragOverPosition === 'after') dragOverClass = 'menu-right-drag-over-line-after';
        else if (dragOverPosition === 'inside') dragOverClass = 'menu-right-drag-over-inside';
      }

      // Check highlight state
      const isHighlighted = settingsHighlightNodeId === node.id;

      return (
        <div key={node.id} style={{ paddingLeft: `${depth * 20}px` }}>
          <div
            className={`menu-right-tree-row ${dragOverClass} ${isHighlighted ? 'menu-right-node-highlighted' : ''}`}
            draggable={true}
            onDragStart={(e) => handleRightDragStart(e, node.id)}
            onDragOver={(e) => handleRightDragOver(e, node.id)}
            onDragLeave={handleRightDragLeave}
            onDrop={(e) => handleRightDrop(e, node.id)}
          >
            <div className="menu-right-tree-node-info">
              {isFolder ? (
                <div className="menu-right-tree-toggle" onClick={() => toggleExpand(node.id)}>
                  {isExpanded ? '−' : '+'}
                </div>
              ) : (
                <div style={{ width: '12px' }} />
              )}

              <span className="menu-right-tree-icon">
                {isSeparator ? '➖' : isHeader ? '📌' : node.icon}
              </span>

              <div className="menu-right-tree-title">
                {editingHeaderId === node.id ? (
                  <input
                    type="text"
                    value={editingHeaderText}
                    onChange={(e) => setEditingHeaderText(e.target.value)}
                    onBlur={() => saveHeaderTitle(node.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveHeaderTitle(node.id);
                      if (e.key === 'Escape') setEditingHeaderId(null);
                    }}
                    autoFocus
                  />
                ) : (
                  <span className={`
                    ${isFolder ? 'root-group' : ''} 
                    ${isHeader ? 'custom-header' : ''} 
                    ${isSeparator ? 'separator' : ''}
                  `}>
                    {isSeparator ? '--- Separator ---' : node.title}
                  </span>
                )}
              </div>
            </div>

            <div className="menu-right-tree-visibility-toggles" style={{ display: 'flex', gap: '12px', marginRight: '16px', alignItems: 'center' }}>
              <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: '#475569', userSelect: 'none' }}>
                <input 
                  type="checkbox" 
                  checked={node.show_in_menu !== false} 
                  onChange={(e) => {
                    setLocalNodes(prev => prev.map(n => n.id === node.id ? { ...n, show_in_menu: e.target.checked } : n));
                  }}
                  style={{ cursor: 'pointer' }}
                />
                Hiện Menu
              </label>
              <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: '#475569', userSelect: 'none' }}>
                <input 
                  type="checkbox" 
                  checked={node.show_in_submenu !== false} 
                  onChange={(e) => {
                    setLocalNodes(prev => prev.map(n => n.id === node.id ? { ...n, show_in_submenu: e.target.checked } : n));
                  }}
                  style={{ cursor: 'pointer' }}
                />
                Hiện Phân hệ
              </label>
            </div>

            <div className="menu-right-tree-actions">
              {isHeader && (
                <button
                  type="button"
                  className="menu-right-tree-action-btn"
                  title="Sửa tên nhãn phụ"
                  onClick={() => startEditHeader(node)}
                >
                  ✏️
                </button>
              )}
              <button
                type="button"
                className="menu-right-tree-action-btn"
                title="Gỡ khỏi menu"
                onClick={() => {
                  setLocalNodes(prev => deleteNodeAndDescendants(node.id, prev));
                  showToast('success', 'Đã gỡ chức năng');
                }}
              >
                ❌
              </button>
            </div>
          </div>

          {isFolder && isExpanded && hasChildren && (
            <div>
              {renderRightTree(node.children!, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="menu-settings-modal-overlay">
      {/* Toast Messages */}
      {toast && (
        <div style={{
          position: 'fixed', top: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 100000,
          background: toast.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(16, 185, 129, 0.95)', 
          color: '#fff', padding: '12px 24px', borderRadius: '8px', 
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)', fontWeight: 500
        }}>
          {toast.type === 'error' ? '❌ ' : '✔️ '}{toast.message}
        </div>
      )}

      <div className="menu-settings-modal-content">
        {/* Header Bar */}
        <div className="menu-settings-modal-header">
          <span>Thiết lập chức năng</span>
          <button 
            type="button" 
            className="menu-settings-modal-close-btn"
            onClick={closeSettingsModal}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="menu-settings-modal-body">
          
          {/* LEFT COLUMN: Features Pool */}
          <div 
            className={`menu-settings-panel-left ${isLeftDragOver ? 'menu-settings-left-dropzone-active' : ''}`}
            onDragOver={handleLeftDragOver}
            onDragLeave={handleLeftDragLeave}
            onDrop={handleLeftDrop}
          >
            <div className="menu-search-wrapper" style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="menu-search-input"
                placeholder="Tìm kiếm chức năng"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                title="Quản lý danh mục tính năng gốc"
                onClick={() => setIsManageFeaturesOpen(true)}
                style={{
                  padding: '8px 10px',
                  background: '#a78bfa',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'background 0.2s',
                  whiteSpace: 'nowrap'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#8b5cf6'}
                onMouseOut={(e) => e.currentTarget.style.background = '#a78bfa'}
              >
                ⚙️ QL tính năng
              </button>
            </div>
            
            <div className="menu-settings-scrollable-content">
              {/* Special virtual items */}
              <div 
                className="menu-left-item special-node"
                draggable={true}
                onDragStart={(e) => handleLeftDragStart(e, { isVirtual: true, type: 'separator' })}
              >
                <span className="menu-left-item-icon">➕</span>
                <span>&lt;Mục phân cách&gt;</span>
              </div>
              <div 
                className="menu-left-item special-node"
                draggable={true}
                onDragStart={(e) => handleLeftDragStart(e, { isVirtual: true, type: 'header' })}
              >
                <span className="menu-left-item-icon">➕</span>
                <span>&lt;Mục nhóm mẹ&gt;</span>
              </div>
              <div 
                className="menu-left-item special-node"
                draggable={true}
                onDragStart={(e) => handleLeftDragStart(e, { isVirtual: true, type: 'action-create' })}
              >
                <span className="menu-left-item-icon">➕</span>
                <span>Thêm mới</span>
              </div>
              <div 
                className="menu-left-item special-node"
                draggable={true}
                onDragStart={(e) => handleLeftDragStart(e, { isVirtual: true, type: 'action-edit' })}
              >
                <span className="menu-left-item-icon">✏️</span>
                <span>Sửa</span>
              </div>
              <div 
                className="menu-left-item special-node"
                draggable={true}
                onDragStart={(e) => handleLeftDragStart(e, { isVirtual: true, type: 'action-delete' })}
              >
                <span className="menu-left-item-icon">🗑️</span>
                <span>Xóa</span>
              </div>
              
              <div style={{ height: '8px', borderBottom: '1px solid #e2e8f0', marginBottom: '8px' }} />

              {/* Functional features list */}
              {filteredMasterFeatures.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                  Không tìm thấy chức năng nào
                </div>
              ) : (
                filteredMasterFeatures.map(feature => {
                  const isUsed = localNodes.some(n => n.path === feature.path && n.is_active);
                  return (
                    <div
                      key={feature.id}
                      className={`menu-left-item ${isUsed ? 'menu-left-item-used' : ''}`}
                      draggable={!isUsed}
                      onDragStart={(e) => {
                        if (!isUsed) {
                          handleLeftDragStart(e, { isVirtual: false, feature });
                        } else {
                          e.preventDefault();
                        }
                      }}
                      style={isUsed ? { 
                        opacity: 0.5, 
                        cursor: 'not-allowed', 
                        background: '#f1f5f9', 
                        borderColor: '#cbd5e1',
                        userSelect: 'none'
                      } : {}}
                      title={isUsed ? "Chức năng này đã được thêm vào menu" : "Kéo thả chức năng này vào menu"}
                    >
                      <span className="menu-left-item-icon">{feature.icon}</span>
                      <span style={isUsed ? { color: '#94a3b8' } : {}}>{feature.title}</span>
                      {isUsed && (
                        <span style={{ 
                          marginLeft: 'auto', 
                          fontSize: '11px', 
                          color: '#10b981', 
                          fontWeight: 600,
                          background: 'rgba(16, 185, 129, 0.1)',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}>
                          Đã thêm
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Active Menu Structure */}
          <div className="menu-settings-panel-right">
            <div className="menu-settings-panel-header">
              Menu hoặc phân hệ
            </div>
            <div className="menu-settings-scrollable-content">
              {activeTree.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                  Sơ đồ menu rỗng. Hãy kéo thả chức năng vào đây.
                </div>
              ) : (
                renderRightTree(activeTree)
              )}
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="menu-settings-modal-footer">
          <button 
            type="button" 
            className="menu-settings-btn-cancel"
            onClick={closeSettingsModal}
            disabled={saving}
          >
            Hủy bỏ
          </button>
          <button 
            type="button" 
            className="menu-settings-btn-save"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>

      {/* Sub-modal: Master Features Catalog Manager */}
      {isManageFeaturesOpen && (
        <div className="menu-settings-modal-overlay" style={{ zIndex: 11000, background: 'rgba(8, 10, 15, 0.8)' }}>
          <div className="menu-settings-modal-content" style={{ width: '700px', height: '580px' }}>
            <div className="menu-settings-modal-header" style={{ background: '#4f46e5' }}>
              <span>Quản lý danh mục tính năng hệ thống</span>
              <button 
                type="button" 
                className="menu-settings-modal-close-btn"
                onClick={() => {
                  setIsManageFeaturesOpen(false);
                  setEditingMFeatureId(null);
                  setMFeatureTitle('');
                  setMFeaturePath('');
                  setMFeatureIcon('📋');
                  setMFeatureError('');
                }}
              >
                ✕
              </button>
            </div>
            
            <div className="menu-settings-modal-body" style={{ gridTemplateColumns: '1fr', background: '#f1f5f9', display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', overflowY: 'auto' }}>
              
              {/* Form Section */}
              <form onSubmit={async (e) => {
                e.preventDefault();
                setMFeatureError('');
                const trimmedTitle = mFeatureTitle.trim();
                const trimmedPath = mFeaturePath.trim();
                if (!trimmedTitle || !trimmedPath) {
                  setMFeatureError('Vui lòng nhập đầy đủ tên và đường dẫn');
                  return;
                }
                if (!trimmedPath.startsWith('/')) {
                  setMFeatureError('Đường dẫn phải bắt đầu bằng ký tự /');
                  return;
                }
                
                setSubmittingMFeature(true);
                try {
                  const url = editingMFeatureId 
                    ? `/api/system/features/${editingMFeatureId}` 
                    : '/api/system/features';
                  const method = editingMFeatureId ? 'PUT' : 'POST';
                  
                  const res = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      title: trimmedTitle,
                      icon: mFeatureIcon,
                      path: trimmedPath
                    })
                  });
                  const data = await res.json();
                  if (!res.ok) {
                    setMFeatureError(data.error || 'Lỗi khi lưu tính năng');
                  } else {
                    showToast('success', editingMFeatureId ? 'Cập nhật tính năng thành công' : 'Thêm tính năng mới thành công');
                    await refreshMasterFeatures();
                    
                    // Reset form
                    setEditingMFeatureId(null);
                    setMFeatureTitle('');
                    setMFeaturePath('');
                    setMFeatureIcon('📋');
                  }
                } catch (err) {
                  setMFeatureError('Lỗi kết nối máy chủ');
                } finally {
                  setSubmittingMFeature(false);
                }
              }} 
              style={{ background: 'white', padding: '16px', borderRadius: '6px', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontWeight: 600, fontSize: '14px', color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                  {editingMFeatureId ? 'Cập nhật tính năng' : 'Thêm tính năng hệ thống mới'}
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '0.4fr 1fr 1.2fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Icon</label>
                    <input 
                      type="text" 
                      value={mFeatureIcon} 
                      onChange={(e) => setMFeatureIcon(e.target.value)}
                      style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'center', fontSize: '16px' }}
                      placeholder="📋"
                    />
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Tên hiển thị</label>
                    <input 
                      type="text" 
                      value={mFeatureTitle} 
                      onChange={(e) => setMFeatureTitle(e.target.value)}
                      style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', color: '#1e293b' }}
                      placeholder="Ví dụ: Khách hàng"
                    />
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Đường dẫn (Path)</label>
                    <input 
                      type="text" 
                      value={mFeaturePath} 
                      onChange={(e) => setMFeaturePath(e.target.value)}
                      style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', color: '#1e293b' }}
                      placeholder="Ví dụ: /customers"
                    />
                  </div>
                </div>

                {mFeatureError && (
                  <div style={{ color: '#ef4444', fontSize: '12px', fontWeight: 500 }}>
                    ⚠️ {mFeatureError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                  {editingMFeatureId && (
                    <button 
                      type="button" 
                      onClick={() => {
                        setEditingMFeatureId(null);
                        setMFeatureTitle('');
                        setMFeaturePath('');
                        setMFeatureIcon('📋');
                        setMFeatureError('');
                      }}
                      style={{ padding: '6px 12px', background: '#94a3b8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
                    >
                      Hủy sửa
                    </button>
                  )}
                  <button 
                    type="submit" 
                    disabled={submittingMFeature}
                    style={{ padding: '6px 16px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
                  >
                    {submittingMFeature ? 'Đang xử lý...' : (editingMFeatureId ? 'Cập nhật' : 'Thêm mới')}
                  </button>
                </div>
              </form>

              {/* List Section */}
              <div style={{ flex: 1, background: 'white', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #cbd5e1', fontWeight: 600, fontSize: '13px', color: '#334155' }}>
                  Danh sách tính năng hệ thống ({masterFeatures.length})
                </div>
                
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b' }}>
                        <th style={{ padding: '8px', width: '60px' }}>Icon</th>
                        <th style={{ padding: '8px' }}>Tên tính năng</th>
                        <th style={{ padding: '8px' }}>Đường dẫn (Path)</th>
                        <th style={{ padding: '8px', width: '100px', textAlign: 'center' }}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {masterFeatures.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                            Chưa có tính năng nào trong danh mục
                          </td>
                        </tr>
                      ) : (
                        masterFeatures.map((f) => (
                          <tr key={f.id} style={{ borderBottom: '1px solid #f1f5f9', color: '#1e293b' }}>
                            <td style={{ padding: '8px', fontSize: '16px', textAlign: 'center' }}>{f.icon}</td>
                            <td style={{ padding: '8px', fontWeight: 500 }}>{f.title}</td>
                            <td style={{ padding: '8px', fontFamily: 'monospace', color: '#4f46e5' }}>{f.path}</td>
                            <td style={{ padding: '8px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                <button 
                                  type="button" 
                                  title="Sửa tính năng"
                                  onClick={() => {
                                    setEditingMFeatureId(f.id);
                                    setMFeatureTitle(f.title);
                                    setMFeatureIcon(f.icon);
                                    setMFeaturePath(f.path);
                                    setMFeatureError('');
                                  }}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}
                                >
                                  ✏️
                                </button>
                                <button 
                                  type="button" 
                                  title="Xóa tính năng"
                                  onClick={async () => {
                                    if (confirm(`Bạn có chắc muốn xóa tính năng "${f.title}" khỏi danh mục hệ thống? (Việc này không tự động xóa node khỏi menu nhưng sẽ khiến tính năng không hiển thị trong pool để kéo nữa)`)) {
                                      try {
                                        const res = await fetch(`/api/system/features/${f.id}`, { method: 'DELETE' });
                                        if (res.ok) {
                                          showToast('success', 'Đã xóa tính năng khỏi danh mục');
                                          await refreshMasterFeatures();
                                          if (editingMFeatureId === f.id) {
                                            setEditingMFeatureId(null);
                                            setMFeatureTitle('');
                                            setMFeaturePath('');
                                            setMFeatureIcon('📋');
                                          }
                                        } else {
                                          const data = await res.json();
                                          showToast('error', data.error || 'Lỗi khi xóa tính năng');
                                        }
                                      } catch (err) {
                                        showToast('error', 'Lỗi kết nối máy chủ');
                                      }
                                    }
                                  }}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
