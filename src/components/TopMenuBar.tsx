"use client";

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMenu, MenuNode } from '@/components/MenuProvider';

export default function TopMenuBar() {
  const pathname = usePathname() || '';
  const { submenuTree, loading, openContextMenu } = useMenu();
  const [openGroupId, setOpenGroupId] = useState<number | null>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setOpenGroupId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Đóng dropdown khi chuyển trang
  useEffect(() => {
    setOpenGroupId(null);
  }, [pathname]);

  // Kiểm tra xem phân hệ có đang active không (dựa trên route hiện tại)
  const isGroupActive = (group: MenuNode): boolean => {
    const checkActiveRecursively = (node: MenuNode): boolean => {
      if (node.path && pathname.startsWith(node.path)) {
        return true;
      }
      if (node.children && node.children.length > 0) {
        return node.children.some(checkActiveRecursively);
      }
      return false;
    };
    return checkActiveRecursively(group);
  };

  const isItemActive = (path: string) => {
    return pathname.startsWith(path);
  };

  const toggleGroup = (groupId: number) => {
    setOpenGroupId(openGroupId === groupId ? null : groupId);
  };

  // Hàm render đệ quy các node trong dropdown của TopMenuBar
  const renderDropdownNodes = (nodes: MenuNode[], depth: number = 0): React.ReactNode => {
    return nodes.map((node) => {
      // 1. Kiểm tra xem có phải là Separator hay không
      if (node.path && node.path.startsWith('#separator')) {
        return (
          <hr 
            key={node.id} 
            className="top-menu-separator" 
            onContextMenu={(e) => openContextMenu(e, node.id)}
          />
        );
      }

      const isFolder = !node.path || node.path.startsWith('#header');
      const hasChildren = node.children && node.children.length > 0;

      if (isFolder) {
        return (
          <div key={node.id} style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Header của Folder / Nhóm con */}
            <div 
              className="top-menu-folder-header"
              style={{ 
                padding: '8px 14px',
                paddingLeft: `${14 + depth * 16}px`,
                fontWeight: '600',
                color: 'var(--text-muted)',
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: 0.8,
                marginTop: depth > 0 ? '4px' : '0',
                cursor: 'context-menu'
              }}
              onContextMenu={(e) => openContextMenu(e, node.id)}
            >
              <span>{node.icon}</span>
              <span>{node.title}</span>
            </div>
            {/* Render các con của folder */}
            {hasChildren && renderDropdownNodes(node.children!, depth + 1)}
          </div>
        );
      } else {
        // Link chức năng
        return (
          <Link
            key={node.id}
            href={node.path!}
            className={`top-menu-item ${isItemActive(node.path!) ? 'active' : ''}`}
            style={{
              paddingLeft: `${14 + depth * 16}px`,
            }}
            onContextMenu={(e) => openContextMenu(e, node.id)}
          >
            <span className="top-menu-item-icon">{node.icon}</span>
            <span>{node.title}</span>
          </Link>
        );
      }
    });
  };

  return (
    <div className="top-menu-bar" ref={menuBarRef}>
      {/* Phần menu các phân hệ */}
      <div className="top-menu-groups">
        {loading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '8px 14px' }}>
            Đang tải...
          </div>
        ) : (
          submenuTree.map((group, index) => (
            <div className="top-menu-group" key={group.id}>
              {/* Nút phân hệ trên thanh menu */}
              <button
                className={`top-menu-trigger ${isGroupActive(group) ? 'active' : ''} ${openGroupId === group.id ? 'open' : ''}`}
                onClick={() => toggleGroup(group.id)}
                onContextMenu={(e) => openContextMenu(e, group.id)}
              >
                <span className="top-menu-trigger-id">{index + 1}.</span>
                <span>{group.title}</span>
                {group.children && group.children.length > 0 && (
                  <span className={`top-menu-arrow ${openGroupId === group.id ? 'rotated' : ''}`}>▾</span>
                )}
              </button>

              {/* Dropdown menu */}
              {group.children && group.children.length > 0 && (
                <div className={`top-menu-dropdown ${openGroupId === group.id ? 'visible' : ''}`}>
                  {renderDropdownNodes(group.children)}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Nút chuông và thiết lập — nằm cuối bên phải */}
      <div className="top-menu-actions">
        <button className="btn-icon" title="Thông báo">🔔</button>
        <Link href="/system/settings" title="Thiết lập hệ thống">
          <button className="btn-icon" style={{ cursor: "pointer" }}>⚙️</button>
        </Link>
      </div>
    </div>
  );
}
