import { SettingsIcon, HistoryIcon, VideoIcon } from '../icons';

export type SidebarType = 'config' | 'sessions' | 'recording' | null;

interface IconBarProps {
  activeSidebar: SidebarType;
  onSidebarChange: (sidebar: SidebarType) => void;
}

export function IconBar({ activeSidebar, onSidebarChange }: IconBarProps) {
  const iconButtonClass = (isActive: boolean) =>
    `w-12 h-12 flex items-center justify-center rounded-lg transition-all duration-150 ${
      isActive
        ? 'bg-gray-900 text-white'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }`;

  const handleIconClick = (sidebar: SidebarType) => {
    // Toggle: if clicking the same icon, close the sidebar
    onSidebarChange(activeSidebar === sidebar ? null : sidebar);
  };

  return (
    <div className="w-16 h-screen bg-white border-r border-gray-200 flex flex-col items-center py-4 gap-2">
      {/* Config Icon */}
      <button
        onClick={() => handleIconClick('config')}
        className={iconButtonClass(activeSidebar === 'config')}
        title="Configuration"
      >
        <SettingsIcon className="w-6 h-6" />
      </button>

      {/* Sessions Icon */}
      <button
        onClick={() => handleIconClick('sessions')}
        className={iconButtonClass(activeSidebar === 'sessions')}
        title="Sessions"
      >
        <HistoryIcon className="w-6 h-6" />
      </button>

      {/* Recording Icon */}
      <button
        onClick={() => handleIconClick('recording')}
        className={iconButtonClass(activeSidebar === 'recording')}
        title="Recording"
      >
        <VideoIcon className="w-6 h-6" />
      </button>
    </div>
  );
}
