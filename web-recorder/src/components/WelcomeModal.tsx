interface WelcomeModalProps {
  isOpen: boolean
  isFirstVisit: boolean
  onLogin: () => void
  onSignup: () => void
  onStayLoggedOut: () => void
}

export function WelcomeModal({ isOpen, isFirstVisit, onLogin, onSignup, onStayLoggedOut }: WelcomeModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 backdrop-blur-[0.5px] flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-lg border w-full max-w-[388px] mx-4" style={{ borderColor: 'rgb(229, 229, 229)' }}>
        <div className="px-7 py-10">
          <div className="text-center px-4">
            <h2 className="text-3xl font-normal text-gray-900 mb-3">
              {isFirstVisit ? 'Get started' : 'Welcome back'}
            </h2>
            <p className="text-gray-600 text-base mb-8 leading-relaxed">
              Log in or sign up to get smarter responses, upload files and images, and more.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={onLogin}
              className="w-full py-3 bg-black text-white rounded-full font-medium hover:bg-gray-800 transition-colors text-base"
            >
              Log in
            </button>
            <button
              onClick={onSignup}
              className="w-full py-3 bg-white text-gray-700 border border-gray-300 rounded-full font-medium hover:bg-gray-50 transition-colors text-base"
            >
              Sign up for free
            </button>
            <button
              onClick={onStayLoggedOut}
              className="text-base text-gray-600 hover:text-gray-900 transition-colors underline mt-4 w-full"
            >
              Stay logged out
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
