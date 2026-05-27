// Calls /api/generate-touchpoint with listing context + document refs.
// The API handler fetches the document bytes from Supabase Storage itself
// (using the same anon key), so we only send lightweight metadata here.
export async function generateTouchpoint({
  type,
  listing,
  weeklyLog,
  previousTouchpoint,
  documents = [],
}) {
  const res = await fetch('/api/generate-touchpoint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type,
      listing: {
        address: listing.address,
        vendor_names: listing.vendor_names,
        list_date: listing.list_date,
        campaign_type: listing.campaign_type,
      },
      weeklyLog: weeklyLog
        ? {
            week_ending: weeklyLog.week_ending,
            enquiry_count: weeklyLog.enquiry_count,
            inspection_count: weeklyLog.inspection_count,
            open_home_groups: weeklyLog.open_home_groups,
            offers_received: weeklyLog.offers_received,
            offer_amount: weeklyLog.offer_amount,
            price_feedback: weeklyLog.price_feedback,
            notes: weeklyLog.notes,
          }
        : null,
      previousTouchpoint: previousTouchpoint
        ? { generated_content: previousTouchpoint.generated_content }
        : null,
      documents: documents.map((d) => ({
        storage_path: d.storage_path,
        filename: d.filename,
        mime_type: d.mime_type,
        uploaded_at: d.uploaded_at,
      })),
    }),
  })

  if (!res.ok) {
    let msg
    try {
      const err = await res.json()
      msg = err.error || `HTTP ${res.status}`
    } catch {
      msg = `HTTP ${res.status}`
    }
    throw new Error(msg)
  }

  const data = await res.json()
  return data.content
}
