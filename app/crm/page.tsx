import { CrmMount } from '@/components/CrmMount'

export default function CrmPage() {
  const archivePw = process.env.NEXT_PUBLIC_CRM_ARCHIVE_ADMIN_PASSWORD?.trim() ?? ''

  return <CrmMount archiveAdminPassword={archivePw} />
}
