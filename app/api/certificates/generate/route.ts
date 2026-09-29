import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { jsPDF } from 'jspdf'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { certificateId } = await request.json()
  if (!certificateId) return NextResponse.json({ error: 'Missing certificateId' }, { status: 400 })

  // Get certificate with user and course info
  const { data: cert } = await supabase
    .from('certificates')
    .select('*, user:profiles(name), course:courses(title)')
    .eq('id', certificateId)
    .single()

  if (!cert) return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })

  const userName = (cert.user as unknown as { name: string | null })?.name || 'Unknown'
  const courseTitle = (cert.course as unknown as { title: string })?.title || 'Unknown'

  // Generate PDF
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  // Border
  doc.setDrawColor(37, 99, 235)
  doc.setLineWidth(2)
  doc.rect(10, 10, 277, 190)
  doc.setLineWidth(0.5)
  doc.rect(15, 15, 267, 180)

  // Title
  doc.setFontSize(36)
  doc.setTextColor(37, 99, 235)
  doc.text('Certificate of Completion', 148.5, 50, { align: 'center' })

  // Subtitle
  doc.setFontSize(14)
  doc.setTextColor(107, 114, 128)
  doc.text('This certifies that', 148.5, 70, { align: 'center' })

  // Name
  doc.setFontSize(28)
  doc.setTextColor(17, 24, 39)
  doc.text(userName, 148.5, 90, { align: 'center' })

  // Course info
  doc.setFontSize(14)
  doc.setTextColor(107, 114, 128)
  doc.text('has successfully completed the course', 148.5, 108, { align: 'center' })

  doc.setFontSize(22)
  doc.setTextColor(17, 24, 39)
  doc.text(courseTitle, 148.5, 125, { align: 'center' })

  // Date and certificate number
  doc.setFontSize(11)
  doc.setTextColor(156, 163, 175)
  const dateStr = new Date(cert.issued_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
  doc.text(`Date: ${dateStr}`, 148.5, 155, { align: 'center' })
  doc.text(`Certificate No: ${cert.certificate_number}`, 148.5, 165, { align: 'center' })

  // pipon learning footer
  doc.setFontSize(12)
  doc.setTextColor(37, 99, 235)
  doc.text('pipon learning', 148.5, 185, { align: 'center' })

  // Convert to buffer and upload
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
  const filePath = `certificates/${cert.id}.pdf`

  const { error: uploadError } = await supabase.storage
    .from('assignment-files')
    .upload(filePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: urlData } = supabase.storage
    .from('assignment-files')
    .getPublicUrl(filePath)

  // Update certificate with PDF URL
  await supabase
    .from('certificates')
    .update({ pdf_url: urlData.publicUrl })
    .eq('id', cert.id)

  return NextResponse.json({ pdfUrl: urlData.publicUrl })
}
