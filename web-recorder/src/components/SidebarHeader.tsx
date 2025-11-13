import { NewRecordingIcon, SearchIcon, MenuIcon, SettingsIcon } from './icons'

interface SidebarHeaderProps {
  onClose: () => void
  showSeparator: boolean
  onNewRecording: () => void
  onTest: () => void
}

interface MenuItem {
  icon: React.ComponentType<any>
  label: string
  action: () => void
  separator?: boolean
}

export function SidebarHeader({ onClose, showSeparator, onNewRecording, onTest }: SidebarHeaderProps) {
  const menuItems: MenuItem[] = [
    {
      icon: NewRecordingIcon,
      label: 'New Recording',
      action: () => {
        onNewRecording()
      },
    },
    {
      icon: SearchIcon,
      label: 'Search History',
      action: () => {
        console.log('Search History clicked')
        onClose()
      },
    },
    {
      icon: SettingsIcon,
      label: 'Test',
      action: () => {
        onTest()
      },
      separator: true,
    },
  ]

  return (
    <>
      {/* 侧边栏顶部 - 与导航栏平行的菜单图标 - 粘性定位 */}
      <div className="sticky top-0 bg-[rgb(249,249,249)] z-50 flex justify-end px-4 py-2">
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-transparent hover:bg-[rgb(239,239,239)] hover:border-gray-100 border-2 border-transparent transition-all duration-200 cursor-w-resize"
          style={{
            transform: 'rotate(90deg)',
            willChange: 'transform',
          }}
        >
          <MenuIcon width={18} height={18} className="text-black" />
        </button>
      </div>

      {/* 上方区域 - 固定不滚动 - 粘性定位 */}
      <div className="sticky top-12 bg-[rgb(249,249,249)] z-40 px-4 pb-0">
        <div className="space-y-1 pb-4">
          {menuItems.map(item => (
            <button
              key={item.label}
              onClick={item.action}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-transparent hover:bg-[rgb(239,239,239)] hover:border-gray-100 border-2 border-transparent text-gray-700 transition-all duration-200 cursor-pointer
                  ${item.separator ? 'mt-6' : ''}
                  `}
            >
              {item.icon && <item.icon className="w-5 h-5" />}
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          ))}
        </div>

        {/* 分隔线 - 移到 sticky 区域内部 */}
        <div
          className={`border-t border-gray-200 -mx-4 transition-opacity duration-200 ${
            showSeparator ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ marginTop: '-1px' }}
        />
      </div>
    </>
  )
}
