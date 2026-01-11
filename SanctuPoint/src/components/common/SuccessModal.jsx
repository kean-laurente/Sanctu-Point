import { useEffect } from 'react'

const SuccessModal = ({ message, isOpen, onClose, autoCloseDuration = 3000 }) => {
  useEffect(() => {
    if (isOpen && autoCloseDuration) {
      const timer = setTimeout(onClose, autoCloseDuration)
      return () => clearTimeout(timer)
    }
  }, [isOpen, autoCloseDuration, onClose])

  if (!isOpen) return null

  return (
    <div className="success-modal-overlay" onClick={onClose}>
      <div className="success-modal" onClick={(e) => e.stopPropagation()}>
        <div className="success-modal-icon">✓</div>
        <p className="success-modal-message">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className="success-modal-close"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}

export default SuccessModal
