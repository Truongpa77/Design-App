"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { menuConfig } from '@/config/menuConfig';

export interface MenuNode {
  id: number;
  parent_id: number | null;
  sort_order: number;
  title: string;
  icon: string;
  path: string | null; // null = folder/group, non-null = item/action
  is_active: boolean;
  show_in_menu: boolean;
  show_in_submenu: boolean;
  children?: MenuNode[];
}

export interface LayoutNode {
  id: string;
  name: string;
  icon: string;
  is_system: boolean;
}

export interface MasterFeature {
  id: number;
  title: string;
  icon: string;
  path: string;
  created_at: string;
}

interface MenuContextType {
  menuTree: MenuNode[];
  submenuTree: MenuNode[];
  allNodes: MenuNode[];
  loading: boolean;
  error: string | null;
  refreshMenu: () => Promise<void>;
  isSettingsModalOpen: boolean;
  setIsSettingsModalOpen: (open: boolean) => void;
  settingsHighlightNodeId: number | null;
  setSettingsHighlightNodeId: (id: number | null) => void;
  openSettingsModal: (nodeId?: number) => void;
  closeSettingsModal: () => void;
  contextMenuState: { isOpen: boolean; x: number; y: number; nodeId: number | null };
  openContextMenu: (e: React.MouseEvent, nodeId: number) => void;
  closeContextMenu: () => void;
  headerActions: React.ReactNode | null;
  setHeaderActions: (actions: React.ReactNode | null) => void;
  activeLayoutId: string;
  setActiveLayoutId: (id: string) => void;
  layouts: LayoutNode[];
  refreshLayouts: () => Promise<void>;
  masterFeatures: MasterFeature[];
  refreshMasterFeatures: () => Promise<void>;
}

const MenuContext = createContext<MenuContextType | undefined>(undefined);

export function buildTree(flatNodes: MenuNode[]): MenuNode[] {
  const nodeMap: { [key: number]: MenuNode } = {};
  const roots: MenuNode[] = [];

  // Clone all nodes to avoid mutating state directly and initialize children
  flatNodes.forEach(node => {
    nodeMap[node.id] = { ...node, children: [] };
  });

  // Build tree
  flatNodes.forEach(node => {
    const mappedNode = nodeMap[node.id];
    if (node.parent_id === null) {
      roots.push(mappedNode);
    } else {
      const parent = nodeMap[node.parent_id];
      if (parent) {
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(mappedNode);
      } else {
        // Fallback: if parent not found, treat as root
        roots.push(mappedNode);
      }
    }
  });

  // Sort children by sort_order
  const sortTreeNodes = (nodes: MenuNode[]) => {
    nodes.sort((a, b) => a.sort_order - b.sort_order);
    nodes.forEach(node => {
      if (node.children && node.children.length > 0) {
        sortTreeNodes(node.children);
      }
    });
  };

  sortTreeNodes(roots);
  return roots;
}

// Convert old static config to MenuNode hierarchy as fallback
function getFallbackMenuTree(): MenuNode[] {
  const fallbackNodes: MenuNode[] = [];
  let itemCounter = 1;

  menuConfig.forEach(group => {
    const groupNodeId = -group.id; // negative to avoid collision
    const groupNode: MenuNode = {
      id: groupNodeId,
      parent_id: null,
      sort_order: group.id,
      title: group.title,
      icon: '📁',
      path: null,
      is_active: true,
      show_in_menu: true,
      show_in_submenu: true,
      children: []
    };

    group.items.forEach((item, index) => {
      const itemNode: MenuNode = {
        id: -(1000 + itemCounter++),
        parent_id: groupNodeId,
        sort_order: index + 1,
        title: item.label,
        icon: item.icon,
        path: item.path,
        is_active: true,
        show_in_menu: true,
        show_in_submenu: true,
        children: []
      };
      groupNode.children!.push(itemNode);
    });

    fallbackNodes.push(groupNode);
  });

  return fallbackNodes;
}

export function MenuProvider({ children }: { children: ReactNode }) {
  const [allNodes, setAllNodes] = useState<MenuNode[]>([]);
  const [menuTree, setMenuTree] = useState<MenuNode[]>([]);
  const [submenuTree, setSubmenuTree] = useState<MenuNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [headerActions, setHeaderActions] = useState<React.ReactNode | null>(null);

  const [activeLayoutId, setActiveLayoutIdState] = useState<string>('admin');
  const [layouts, setLayouts] = useState<LayoutNode[]>([]);
  const [masterFeatures, setMasterFeatures] = useState<MasterFeature[]>([]);
  const [isClient, setIsClient] = useState(false);

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsHighlightNodeId, setSettingsHighlightNodeId] = useState<number | null>(null);

  const [contextMenuState, setContextMenuState] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    nodeId: number | null;
  }>({
    isOpen: false,
    x: 0,
    y: 0,
    nodeId: null,
  });

  const openSettingsModal = (nodeId?: number) => {
    if (nodeId !== undefined) {
      setSettingsHighlightNodeId(nodeId);
    }
    setIsSettingsModalOpen(true);
  };

  const closeSettingsModal = () => {
    setIsSettingsModalOpen(false);
    setSettingsHighlightNodeId(null);
  };

  const openContextMenu = (e: React.MouseEvent, nodeId: number) => {
    e.preventDefault();
    setContextMenuState({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      nodeId,
    });
  };

  const closeContextMenu = () => {
    setContextMenuState(prev => ({ ...prev, isOpen: false }));
  };

  const setActiveLayoutId = (id: string) => {
    setActiveLayoutIdState(id);
    localStorage.setItem('activeLayoutId', id);
  };

  const fetchLayouts = async () => {
    try {
      const res = await fetch('/api/system/layouts');
      if (res.ok) {
        const data = await res.json();
        setLayouts(data);
      }
    } catch (err) {
      console.error('Error fetching layouts:', err);
    }
  };

  const fetchMasterFeatures = async () => {
    try {
      const res = await fetch('/api/system/features');
      if (res.ok) {
        const data = await res.json();
        setMasterFeatures(data);
      }
    } catch (err) {
      console.error('Error fetching master features:', err);
    }
  };

  const fetchMenu = async (layoutId: string = activeLayoutId) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/system/menu?layout=${layoutId}`);
      if (!res.ok) {
        throw new Error('Không thể tải dữ liệu menu từ server');
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setAllNodes(data);
        const isActionNode = (node: MenuNode) => 
          node.path && (node.path.endsWith('/create') || node.path.endsWith('/edit') || node.path.endsWith('/delete'));
        
        // Lọc bỏ các hành động CRUD khỏi menu điều hướng lề trái
        const activeMenuNodes = data.filter(node => node.is_active && node.show_in_menu !== false && !isActionNode(node));
        setMenuTree(buildTree(activeMenuNodes));

        // Lọc bỏ các hành động CRUD khỏi menu phân hệ ở thanh đầu trang
        const activeSubmenuNodes = data.filter(node => node.is_active && node.show_in_submenu !== false && !isActionNode(node));
        setSubmenuTree(buildTree(activeSubmenuNodes));
        setError(null);
      } else {
        throw new Error('Dữ liệu không đúng định dạng');
      }
    } catch (err: any) {
      console.warn('⚠️ Lỗi load menu động, chuyển sang fallback static config:', err);
      setError(err.message || 'Lỗi server');
      const fallbackTree = getFallbackMenuTree();
      
      const mappedFallbackTree = fallbackTree.map(n => ({
        ...n,
        show_in_menu: true,
        show_in_submenu: true,
        children: n.children ? n.children.map(c => ({ ...c, show_in_menu: true, show_in_submenu: true } as MenuNode)) : []
      })) as MenuNode[];
      
      setMenuTree(mappedFallbackTree);
      setSubmenuTree(mappedFallbackTree);
      
      // Flatten fallback tree for allNodes state if fallback is active
      const flatFallback: MenuNode[] = [];
      const flatten = (nodes: MenuNode[]) => {
        nodes.forEach(n => {
          const { children, ...rest } = n;
          flatFallback.push({ ...rest, show_in_menu: true, show_in_submenu: true } as MenuNode);
          if (children) flatten(children);
        });
      };
      flatten(fallbackTree);
      setAllNodes(flatFallback);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setIsClient(true);
    const saved = localStorage.getItem('activeLayoutId');
    if (saved) {
      setActiveLayoutIdState(saved);
    }
    fetchLayouts();
    fetchMasterFeatures();
  }, []);

  useEffect(() => {
    if (isClient) {
      fetchMenu(activeLayoutId);
    }
  }, [activeLayoutId, isClient]);

  const refreshMenu = () => fetchMenu(activeLayoutId);

  return (
    <MenuContext.Provider value={{ 
      menuTree,
      submenuTree,
      allNodes, 
      loading, 
      error, 
      refreshMenu,
      isSettingsModalOpen,
      setIsSettingsModalOpen,
      settingsHighlightNodeId,
      setSettingsHighlightNodeId,
      openSettingsModal,
      closeSettingsModal,
      contextMenuState,
      openContextMenu,
      closeContextMenu,
      headerActions,
      setHeaderActions,
      activeLayoutId,
      setActiveLayoutId,
      layouts,
      refreshLayouts: fetchLayouts,
      masterFeatures,
      refreshMasterFeatures: fetchMasterFeatures
    }}>
      {children}
    </MenuContext.Provider>
  );
}

export function useMenu() {
  const context = useContext(MenuContext);
  if (context === undefined) {
    throw new Error('useMenu must be used within a MenuProvider');
  }
  return context;
}
