/**
 * CertBadge — badge colorido de certificação.
 */
import { CERT_META } from '../utils/certMeta'

interface CertBadgeProps {
  cert: string
  size?: 'sm' | 'md'
}

export default function CertBadge({ cert, size = 'sm' }: CertBadgeProps) {
  const meta = CERT_META[cert]
  const color = meta?.color ?? '#9ca3af'

  return (
    <span
      className={`cert-badge cert-badge-${size}`}
      style={{
        background: `${color}20`,
        color: color,
        borderColor: `${color}40`,
      }}
    >
      {cert}
    </span>
  )
}
