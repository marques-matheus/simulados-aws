/**
 * Formata texto de questões e explicações para renderização HTML.
 * Migrado do `app.js` original.
 *
 * - Escapa HTML entities
 * - Destaca recursos AWS (AWS::Service::Resource)
 * - Destaca ações IAM (s3:PutObject)
 * - Converte \n para <br>
 */
export function formatText(text: string | undefined | null): string {
  if (!text) return ''

  // Escape HTML
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Highlight AWS resources like AWS::ApiGateway::RestApi
  html = html.replace(
    /\b(AWS::[A-Za-z0-9]+::[A-Za-z0-9]+)\b/g,
    '<code class="aws-resource">$1</code>'
  )

  // Highlight IAM actions (e.g., s3:PutObject)
  html = html.replace(/\b([a-z0-9A-Z]+:[a-zA-Z0-9*]+)\b/g, (match) => {
    if (match.startsWith('http') || match.startsWith('urn')) return match
    return `<code class="aws-action">${match}</code>`
  })

  // Convert newlines to breaks
  html = html.replace(/\n/g, '<br>')

  return html
}
