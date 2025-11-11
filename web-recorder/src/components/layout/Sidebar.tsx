import type { ReactNode } from 'react';
import { XIcon } from '../icons';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Sidebar({ onClose, title, children }: SidebarProps) {
  return (
    <div className="h-screen bg-white border-r border-gray-200 flex flex-col">
      {/* Sidebar Header */}
      <div className="h-14 border-b border-gray-200 flex items-center justify-between px-4 flex-shrink-0">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors duration-150"
        >
          <XIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Sidebar Content */}
      <div className="flex-1 overflow-y-auto openai-scrollbar">
        {children}
      </div>
    </div>
  );
}
