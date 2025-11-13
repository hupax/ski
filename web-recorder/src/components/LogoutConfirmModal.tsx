import { X } from 'lucide-react'

interface LogoutConfirmModalProps {
  isOpen: boolean
  userEmail: string
  onConfirm: () => void
  onCancel: () => void
}

export function LogoutConfirmModal({ isOpen, userEmail, onConfirm, onCancel }: LogoutConfirmModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 backdrop-blur-[0.5px] flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-lg border w-full max-w-[388px] mx-4 relative" style={{ borderColor: 'rgb(229, 229, 229)' }}>
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10"
        >
          <X size={20} />
        </button>

        <div className="px-7 py-10">
          <div className="text-center px-4">
            <h2 className="text-3xl font-normal text-gray-900 mb-3">
              Are you sure you want to log out?
            </h2>
            <p className="text-gray-600 text-base mb-8 leading-relaxed">
              Log out of Skiuo as {userEmail}?
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={onConfirm}
              className="w-full py-3 bg-black text-white rounded-full font-medium hover:bg-gray-800 transition-colors text-base"
            >
              Log out
            </button>
            <button
              onClick={onCancel}
              className="w-full py-3 bg-white text-gray-700 border border-gray-300 rounded-full font-medium hover:bg-gray-50 transition-colors text-base"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
