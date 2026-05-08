'use client'

import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    __CRM_ARCHIVE_ADMIN_PW?: string
  }
}

type Props = {
  archiveAdminPassword: string
}

export function CrmMount({ archiveAdminPassword }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.__CRM_ARCHIVE_ADMIN_PW = archiveAdminPassword

    let cancelled = false

    async function bootstrap() {
      const root = ref.current
      if (!root) return

      const bodyHtml = await fetch('/crm/body.html').then((r) => r.text())
      if (cancelled) return

      if (!document.querySelector('link[data-tb-crm-css]')) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = '/crm/crm.css'
        link.setAttribute('data-tb-crm-css', '1')
        document.head.appendChild(link)
      }

      root.innerHTML = bodyHtml

      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script')
        script.src = '/crm/crm-app.js'
        script.async = true
        script.onload = () => resolve()
        script.onerror = () => reject(new Error('crm-app script failed'))
        root.appendChild(script)
      }).catch(console.error)
    }

    void bootstrap()

    return () => {
      cancelled = true
      delete window.__CRM_ARCHIVE_ADMIN_PW
    }
  }, [archiveAdminPassword])

  return <div ref={ref} suppressHydrationWarning />
}
