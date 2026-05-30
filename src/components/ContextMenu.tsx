"use client";

import React, { useRef, useEffect } from 'react';
import { useMenu } from './MenuProvider';
import { useRouter } from 'next/navigation';

export default function ContextMenu() {
  const { contextMenuState, closeContextMenu, openSettingsModal, allNodes } = useMenu();
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeContextMenu();
      }
    };

    if (contextMenuState.isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [contextMenuState.isOpen, closeContextMenu]);

  if (!contextMenuState.isOpen) return null;

  const targetNode = allNodes.find(n => n.id === contextMenuState.nodeId);

  const handleConfigureMenu = () => {
    closeContextMenu();
    if (contextMenuState.nodeId !== null) {
      openSettingsModal(contextMenuState.nodeId);
    }
  };

  const handleOpenLink = () => {
    closeContextMenu();
    if (targetNode && targetNode.path) {
      router.push(targetNode.path);
    }
  };

  return (
    <div 
      ref={menuRef}
      className="windows-context-menu"
      style={{
        top: `${contextMenuState.y}px`,
        left: `${contextMenuState.x}px`,
      }}
    >
      {/* Real functional items */}
      <div className="windows-context-menu-item" onClick={handleConfigureMenu}>
        <div className="windows-context-menu-item-left">
          <span className="windows-context-menu-item-icon">🛠️</span>
          <span>Thiết lập chức năng</span>
        </div>
        <span className="windows-context-menu-item-shortcut">Ctrl+M</span>
      </div>

      {targetNode && targetNode.path && (
        <div className="windows-context-menu-item" onClick={handleOpenLink}>
          <div className="windows-context-menu-item-left">
            <span className="windows-context-menu-item-icon">📁</span>
            <span>Mở chức năng</span>
          </div>
        </div>
      )}

      <hr className="windows-context-menu-separator" />

      {/* Windows 11 Mock items to match the user's reference image */}
      <div className="windows-context-menu-item" style={{ opacity: 0.6 }}>
        <div className="windows-context-menu-item-left">
          <span className="windows-context-menu-item-icon">👀</span>
          <span>Xem chi tiết</span>
        </div>
      </div>

      <div className="windows-context-menu-item" onClick={() => { closeContextMenu(); window.location.reload(); }}>
        <div className="windows-context-menu-item-left">
          <span className="windows-context-menu-item-icon">🔄</span>
          <span>Làm mới trang</span>
        </div>
        <span className="windows-context-menu-item-shortcut">F5</span>
      </div>

      <hr className="windows-context-menu-separator" />

      <div className="windows-context-menu-item" style={{ opacity: 0.6 }}>
        <div className="windows-context-menu-item-left">
          <span className="windows-context-menu-item-icon">💻</span>
          <span>Mở trong Terminal</span>
        </div>
      </div>

      <div className="windows-context-menu-item" style={{ opacity: 0.6 }}>
        <div className="windows-context-menu-item-left">
          <span className="windows-context-menu-item-icon">ℹ️</span>
          <span>Thuộc tính</span>
        </div>
      </div>
    </div>
  );
}
