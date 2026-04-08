import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase'
import ConfirmClient from './ConfirmClient'

export default async function ConfirmPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServerClient()
  const { data: pending } = await supabase
    .from('pending_comparisons')
    .select('*')
    .eq('id', id)
    .single()

  if (!pending) notFound()

  return (
    <main className="min-h-screen bg-[#0f0f13] px-7 py-10 max-w-3xl mx-auto">
      <h1 className="text-[18px] font-bold text-[#f9fafb] mb-1">Confirm the parts list</h1>
      <p className="text-sm text-[#6b7280] mb-8">We extracted these specs from the listing. Edit anything that looks wrong.</p>
      <ConfirmClient pendingId={id} parts={pending.extracted_parts} />
    </main>
  )
}
