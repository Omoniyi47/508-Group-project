# Transcript retrieval

The dashboard, Student Information and Transcript Requests link to the guided
collection screen at `/transcript-collection`.

1. A transcript officer or administrator selects the student and checks their details.
2. Choose **Online** (download) or **Manual** (printed transcript collected in person).
3. Review and submit the request. Another request is blocked while one is requested,
   verified or approved for that student.
4. A transcript officer verifies the records; the HOD or administrator approves them.
   Approval freezes the result snapshot. Existing result approval checks still apply.
5. For online retrieval, download the approved PDF or Excel. Successful generation
   and export processing marks it released; this is not proof of client receipt.
   Generation failures leave it approved for retry.
6. For manual retrieval, download for printing, verify the collector's identity,
   and hand over the transcript. The officer records the collector's name and a
   receipt/reference, then confirms collection. Printing alone does not release it.

## Result to transcript flow

Results can be entered one at a time or imported in bulk. Manual entries are
saved as drafts, then submitted and approved by the department. CSV and Excel
uploads are first previewed and validated, then confirmed into stored Result
records as submitted results. OCR uploads accept PDF, PNG, JPG, TIFF and WebP
scans; table text is extracted into a preview, matched to students by matric
number, and must be corrected or confirmed by staff before any Result record is
created. OCR never approves a result automatically.

Only approved Result records are included in the live transcript preview. The
official transcript request cannot be approved while any student result is
missing or still awaiting approval. When the request is approved, the system
freezes those approved results in the request snapshot, which is then used for
the official PDF or Excel transcript. A stored historical transcript scan is
kept separately for reference and does not create academic Result records.

The request detail URL includes its request ID, so older requests remain individually
accessible. Collection records include the acting officer and timestamp. HODs and
result officers cannot confirm physical handover. Department access restrictions
continue to apply. No payment requirement or delivery timetable is implied.

Existing requests default to online retrieval. Student mode of entry supports regular,
direct entry, part time, transfer, distance learning, sandwich and other. Existing
student records without this information display **Not recorded** until corrected.

Each session offers only **Harmattan** and **Rain**. Historical term references are
preserved, but are not selectable for new academic records. The two vacation-course
placements in the source catalogue remain available for review and are not relabelled.
