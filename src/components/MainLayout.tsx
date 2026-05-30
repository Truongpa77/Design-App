"use client";

import React, { useEffect } from 'react';
import Sidebar from './Sidebar';
import TopMenuBar from './TopMenuBar';
import { MenuProvider, useMenu } from './MenuProvider';
import MenuSettingsModal from './MenuSettingsModal';
import ContextMenu from './ContextMenu';
import '../app/dashboard.css';

function MainLayoutInner({ children, user, title }: { children: React.ReactNode, user: any, title: string }) {
  const { headerActions } = useMenu();

  return (
    <div className="dashboard-layout">
      <Sidebar user={user} />
      <main className="main-content">
        <TopMenuBar />
        <header className="top-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingRight: '32px' }}>
          <h1>{title}</h1>
          {headerActions && <div className="header-actions">{headerActions}</div>}
        </header>
        <div className="dashboard-content">
          {children}
        </div>
      </main>
    </div>
  );
}

export default function MainLayout({ children, user, title }: { children: React.ReactNode, user: any, title: string }) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedColor = localStorage.getItem('theme-primary-color');
      const savedHover = localStorage.getItem('theme-primary-hover');
      const savedBgColor = localStorage.getItem('theme-bg-color');
      const savedCardBg = localStorage.getItem('theme-card-bg');
      const savedCardBorder = localStorage.getItem('theme-card-border');

      if (savedColor) {
        document.documentElement.style.setProperty('--primary-color', savedColor);
        
        // Convert hex to rgb components
        const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
        const fullHex = savedColor.replace(shorthandRegex, (_, r, g, b) => r + r + g + g + b + b);
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
        const rgb = result
          ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
          : "59, 130, 246";
        document.documentElement.style.setProperty('--primary-color-rgb', rgb);
      }
      if (savedHover) {
        document.documentElement.style.setProperty('--primary-hover', savedHover);
      }
      if (savedBgColor) {
        document.documentElement.style.setProperty('--bg-color', savedBgColor);
      }
      if (savedCardBg) {
        document.documentElement.style.setProperty('--card-bg', savedCardBg);
      }
      if (savedCardBorder) {
        document.documentElement.style.setProperty('--card-border', savedCardBorder);
      }
    }
  }, []);

  return (
    <MenuProvider>
      <MainLayoutInner children={children} user={user} title={title} />
      <MenuSettingsModal />
      <ContextMenu />
    </MenuProvider>
  );
}
