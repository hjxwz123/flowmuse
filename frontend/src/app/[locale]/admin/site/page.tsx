import { redirect } from 'next/navigation'

export default function AdminSiteRedirect() {
  redirect('/admin/config/site')
}
