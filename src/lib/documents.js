import { supabase } from './supabase'

const BUCKET = 'listing-documents'

export const DOCUMENT_CATEGORIES = {
  open_home_report: 'Open Home Report',
  form_6: 'Form 6',
  building_pest: 'Building & Pest',
  contract: 'Contract',
  other: 'Other',
}

export async function listDocuments(listingId) {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('listing_id', listingId)
    .order('uploaded_at', { ascending: false })
  if (error) throw error
  return data
}

export async function uploadDocument(listingId, file, category) {
  // Unique random path inside the bucket. Filename is preserved separately
  // in the metadata row so users still see "open_home_2026-05-23.pdf".
  const ext = file.name.split('.').pop() || 'bin'
  const storagePath = `${listingId}/${crypto.randomUUID()}.${ext}`

  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })
  if (storageError) throw storageError

  const { data, error } = await supabase
    .from('documents')
    .insert({
      listing_id: listingId,
      category,
      filename: file.name,
      mime_type: file.type || null,
      storage_path: storagePath,
      size_bytes: file.size,
    })
    .select()
    .single()

  if (error) {
    // Best-effort: clean up orphan storage object if the row insert failed
    await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {})
    throw error
  }
  return data
}

export async function deleteDocument(doc) {
  // Storage delete is best-effort. Even if it fails, removing the metadata
  // row is the user's intent.
  await supabase.storage.from(BUCKET).remove([doc.storage_path]).catch((e) => {
    console.warn('Storage delete failed:', e)
  })
  const { error } = await supabase.from('documents').delete().eq('id', doc.id)
  if (error) throw error
}

// Signed, short-lived URL for opening/downloading a document.
//
// The listing-documents bucket is PRIVATE (set during the Phase 6 flip), so
// getPublicUrl() would 404. createSignedUrl() mints a time-limited URL that
// storage authorises against the storage RLS policies. 60s is ample to open
// the tab; the URL isn't persisted, it's fetched per click.
export async function getDocumentUrl(storagePath) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60)
  if (error) throw error
  return data.signedUrl
}
