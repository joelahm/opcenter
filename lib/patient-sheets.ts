export interface ImportedPatient {
  name: string
  email: string
}

export interface ExistingPatient {
  email: string
}

export interface PatientSyncResult {
  added: number
  removed: number
}

export interface PatientSheetMapping {
  name?: string
  email?: string
}

export interface PatientSheetPreview {
  headers: string[]
  rows: string[][]
  totalRows: number
}

export function csvExportUrl(sheetLink: string) {
  const url = new URL(sheetLink)

  if (url.protocol !== 'https:' || url.hostname !== 'docs.google.com' || url.username || url.password) {
    throw new Error('Use a valid https://docs.google.com Google Sheet link')
  }

  if (url.pathname.includes('/export') || url.searchParams.get('output') === 'csv') {
    return url.toString()
  }

  const match = url.pathname.match(/\/spreadsheets\/d\/([^/]+)/)
  if (!match) {
    throw new Error('Use a valid Google Sheet link')
  }

  const gid = url.searchParams.get('gid') || url.hash.match(/gid=([^&]+)/)?.[1] || '0'
  return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${gid}`
}

function parseCsv(csv: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i]
    const next = csv[i + 1]

    if (char === '"' && quoted && next === '"') {
      cell += '"'
      i += 1
      continue
    }

    if (char === '"') {
      quoted = !quoted
      continue
    }

    if (char === ',' && !quoted) {
      row.push(cell)
      cell = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i += 1
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      continue
    }

    cell += char
  }

  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }

  return rows
}

async function fetchSheetRows(sheetLink: string) {
  const response = await fetch(csvExportUrl(sheetLink), { cache: 'no-store' })

  if (!response.ok) {
    throw new Error('Unable to fetch the Google Sheet. Make sure it is shared publicly or published.')
  }

  const responseHost = new URL(response.url).hostname
  if (responseHost !== 'docs.google.com' && !responseHost.endsWith('.googleusercontent.com')) {
    throw new Error('Google Sheet export redirected to an unexpected host')
  }

  const contentLength = Number(response.headers.get('content-length') || 0)
  if (contentLength > 10 * 1024 * 1024) {
    throw new Error('Google Sheet export is larger than 10 MB')
  }

  const csv = await response.text()
  if (Buffer.byteLength(csv, 'utf8') > 10 * 1024 * 1024) {
    throw new Error('Google Sheet export is larger than 10 MB')
  }
  if (/^\s*</.test(csv)) {
    throw new Error('Google returned a web page instead of CSV. Check the sheet sharing settings.')
  }

  return parseCsv(csv).filter(row => row.some(cell => cell.trim()))
}

function findColumnIndex(headers: string[], mappingValue: string | undefined, fallbacks: string[]) {
  const normalized = headers.map(header => header.trim().toLowerCase())
  const mapped = mappingValue?.trim().toLowerCase()

  if (mapped) {
    const mappedIndex = normalized.findIndex(header => header === mapped)
    if (mappedIndex !== -1) return mappedIndex
  }

  return normalized.findIndex(header => fallbacks.includes(header))
}

export async function previewPatientSheet(sheetLink: string): Promise<PatientSheetPreview> {
  const rows = await fetchSheetRows(sheetLink)
  const [headers, ...dataRows] = rows

  return {
    headers: headers?.map(header => header.trim()) ?? [],
    rows: dataRows.slice(0, 5),
    totalRows: dataRows.length,
  }
}

export async function fetchPatientsFromSheet(sheetLink: string, mapping: PatientSheetMapping = {}): Promise<ImportedPatient[]> {
  const rows = await fetchSheetRows(sheetLink)
  const [headers, ...dataRows] = rows

  if (!headers) return []

  const nameIndex = findColumnIndex(headers, mapping.name, ['name', 'patient name', 'full name'])
  const emailIndex = findColumnIndex(headers, mapping.email, ['email', 'email address', 'e-mail'])

  if (nameIndex === -1 || emailIndex === -1) {
    throw new Error('Map the sheet columns for patient name and email address')
  }

  const seen = new Set<string>()

  return dataRows
    .map(row => ({
      name: (row[nameIndex] || '').trim(),
      email: (row[emailIndex] || '').trim().toLowerCase(),
    }))
    .filter(patient => {
      if (!patient.name || !patient.email || seen.has(patient.email)) return false
      seen.add(patient.email)
      return true
    })
}

export function getPatientSyncPlan(patients: ImportedPatient[], existingPatients: ExistingPatient[]) {
  const sheetEmails = new Set(patients.map(patient => patient.email.toLowerCase()))
  const existingEmails = new Set(existingPatients.map(patient => patient.email.toLowerCase()))

  return {
    sheetEmails,
    existingEmails,
    removedEmails: Array.from(existingEmails).filter(email => !sheetEmails.has(email)),
  }
}

export function patientsToCsv(patients: ImportedPatient[]) {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`
  return [
    'Name,email',
    ...patients.map(patient => `${escape(patient.name)},${escape(patient.email)}`),
  ].join('\n')
}
