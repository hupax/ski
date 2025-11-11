import { useState } from 'react';
import type { ReactNode } from 'react';
import { IconBar } from './IconBar';
import type { SidebarType } from './IconBar';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  configContent: ReactNode;
  sessionsContent: ReactNode;
  recordingContent: ReactNode;
  mainContent: ReactNode;
}

export function Layout({
  configContent,
  sessionsContent,
  recordingContent,
  mainContent,
}: LayoutProps) {
  const [activeSidebar, setActiveSidebar] = useState<SidebarType>(null);

  const sidebarTitles: Record<Exclude<SidebarType, null>, string> = {
    config: 'Configuration',
    sessions: 'Sessions',
    recording: 'Recording',
  };

  const sidebarContent: Record<Exclude<SidebarType, null>, ReactNode> = {
    config: configContent,
    sessions: sessionsContent,
    recording: recordingContent,
  };

  const sidebarWidth = 320; // 320px sidebar width

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50">
      {/* Icon Bar - Always visible */}
      <IconBar
        activeSidebar={activeSidebar}
        onSidebarChange={setActiveSidebar}
      />

      {/* Collapsible Sidebar Container - Uses width animation like wrangler */}
      <div
        style={{
          width: activeSidebar !== null ? `${sidebarWidth}px` : '0px',
          transition: 'width 0.25s cubic-bezier(0.4, 0.0, 0.2, 1)',
          willChange: 'width',
        }}
        className="overflow-hidden"
      >
        <div style={{ width: `${sidebarWidth}px` }} className="h-full">
          <Sidebar
            isOpen={activeSidebar !== null}
            onClose={() => setActiveSidebar(null)}
            title={activeSidebar ? sidebarTitles[activeSidebar] : ''}
          >
            {activeSidebar && sidebarContent[activeSidebar]}
          </Sidebar>
        </div>
      </div>

      {/* Main Content Area - Gets pushed */}
      <main className="flex-1 overflow-hidden">
        {mainContent}
      </main>
    </div>
  );
}
