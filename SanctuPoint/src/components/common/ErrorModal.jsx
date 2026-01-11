import { useEffect } from 'react'

const ErrorModal = ({ isOpen, onClose, autoCloseDuration = 3000 }) => {
  useEffect(() => {
    if (isOpen && autoCloseDuration) {
      const t = setTimeout(onClose, autoCloseDuration)
      return () => clearTimeout(t)
    }
  }, [isOpen, autoCloseDuration, onClose])

  if (!isOpen) return null

  return (
    <div className="error-modal-overlay" onClick={onClose}>
      <div className="error-modal" onClick={(e) => e.stopPropagation()}>
        <div className="error-modal-icon">⚠️</div>
        <p className="error-modal-message">An error has occurred, please try again later.</p>
        <button type="button" onClick={onClose} className="error-modal-close">Dismiss</button>
      </div>
    </div>
  )
}

export default ErrorModal
