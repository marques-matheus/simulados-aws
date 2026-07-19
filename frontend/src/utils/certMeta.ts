/**
 * Metadata das certificações AWS — cores e nomes para exibição no frontend.
 * Migrado do `app.js` original.
 */

export interface CertInfo {
  name: string
  color: string
  level: 'foundational' | 'associate' | 'specialty' | 'professional'
  icon: string  // Phosphor icon name
}

export const CERT_META: Record<string, CertInfo> = {
  'CLF-C02': {
    name: 'Cloud Practitioner',
    color: '#ff9900',
    level: 'foundational',
    icon: 'ph-cloud',
  },
  'SAA-C03': {
    name: 'Solutions Architect Associate',
    color: '#06b6d4',
    level: 'associate',
    icon: 'ph-buildings',
  },
  'DVA-C02': {
    name: 'Developer Associate',
    color: '#6366f1',
    level: 'associate',
    icon: 'ph-code',
  },
  'SOA-C02': {
    name: 'CloudOps Engineer',
    color: '#f59e0b',
    level: 'associate',
    icon: 'ph-gear',
  },
  'SCS-C02': {
    name: 'Security Specialty',
    color: '#22c55e',
    level: 'specialty',
    icon: 'ph-shield-check',
  },
  'SAP-C02': {
    name: 'Solutions Architect Professional',
    color: '#a855f7',
    level: 'professional',
    icon: 'ph-trophy',
  },
}

/** Lista ordenada de códigos de certificação */
export const CERT_CODES = Object.keys(CERT_META) as string[]
