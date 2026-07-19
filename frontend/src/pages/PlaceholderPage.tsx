/**
 * PlaceholderPage — página temporária usada até as páginas reais serem implementadas.
 * Será removida quando as tasks 9-11 forem completadas.
 */

interface PlaceholderPageProps {
  title: string
}

export default function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <div className="placeholder-page">
      <div className="placeholder-content">
        <i className="ph ph-code" />
        <h2>{title}</h2>
        <p>Esta página será implementada em breve.</p>
      </div>
    </div>
  )
}
