import React from 'react'

interface ModalProps {
  isOpen: boolean
  title: string
  message: React.ReactNode
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel?: () => void
  type?: 'danger' | 'warning' | 'info'
}

export default function Modal({
  isOpen,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
  type = 'info'
}: ModalProps) {
  if (!isOpen) return null

  return (
    <div className="modal-overlay">
      <div className="modal-container animate-slide-up">
        <div className={`modal-header ${type}`}>
          {type === 'danger' && <i className="ph ph-warning-circle" />}
          {type === 'warning' && <i className="ph ph-warning" />}
          {type === 'info' && <i className="ph ph-info" />}
          <h3>{title}</h3>
        </div>
        <div className="modal-body">
          {message}
        </div>
        <div className="modal-footer">
          {onCancel && (
            <button className="btn-outline" onClick={onCancel}>
              {cancelText}
            </button>
          )}
          <button className={`btn-primary ${type === 'danger' ? 'danger-btn' : ''}`} onClick={onConfirm} style={{ width: 'auto' }}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
