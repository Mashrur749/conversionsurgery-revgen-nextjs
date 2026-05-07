'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAdmin } from '@/lib/admin-context';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  IntakeModeSelector,
  INTAKE_MODES,
  type IntakeMode,
} from '@/components/leads/intake-mode-selector';

interface ImportLeadsDialogProps {
  onImported: () => void;
}

interface ParsedRow {
  name?: string;
  phone: string;
  email?: string;
  address?: string;
  projectType?: string;
  notes?: string;
  status?: string;
  inquiryDate?: string;
  expressConsentEvidence?: string;
  transactionDate?: string;
}

interface ImportResult {
  imported: number;
  skipped: number;
  total: number;
  errors?: Array<{ row: number; phone?: string; error: string }>;
}

type Step = 'mode' | 'upload' | 'preview' | 'importing' | 'done';

const CASL_IMPLIED_CONSENT_DAYS = 180;
const EXISTING_CUSTOMER_WINDOW_DAYS = 730;
const MIN_EXPRESS_CONSENT_EVIDENCE_LENGTH = 10;

// Canonical fields the API expects.
const STANDARD_FIELDS = [
  'name',
  'phone',
  'email',
  'address',
  'projectType',
  'notes',
  'status',
  'inquiryDate',
  'expressConsentEvidence',
  'transactionDate',
] as const;

const HEADER_ALIASES: Record<string, string> = {
  // Name
  'first name': 'name',
  'first_name': 'name',
  'firstname': 'name',
  'full name': 'name',
  'full_name': 'name',
  'fullname': 'name',
  'contact name': 'name',
  'contact': 'name',
  'customer name': 'name',
  // Phone
  'phone number': 'phone',
  'phone_number': 'phone',
  'phonenumber': 'phone',
  'mobile': 'phone',
  'cell': 'phone',
  'telephone': 'phone',
  'tel': 'phone',
  // Email
  'email address': 'email',
  'email_address': 'email',
  'e-mail': 'email',
  'emailaddress': 'email',
  // Address
  'street': 'address',
  'street address': 'address',
  'location': 'address',
  'city': 'address',
  // Project type
  'project type': 'projectType',
  'project_type': 'projectType',
  'projecttype': 'projectType',
  'service': 'projectType',
  'service type': 'projectType',
  'type': 'projectType',
  'job type': 'projectType',
  // Notes / customer notes
  'note': 'notes',
  'comment': 'notes',
  'comments': 'notes',
  'description': 'notes',
  'customer notes': 'notes',
  'customernotes': 'notes',
  // Status
  'lead status': 'status',
  'lead_status': 'status',
  'stage': 'status',
  'pipeline stage': 'status',
  'pipeline_stage': 'status',
  // Inquiry date
  'inquiry date': 'inquiryDate',
  'inquiry_date': 'inquiryDate',
  'inquirydate': 'inquiryDate',
  'date of inquiry': 'inquiryDate',
  'dateofinquiry': 'inquiryDate',
  'inquired': 'inquiryDate',
  // Express consent evidence
  'express consent evidence': 'expressConsentEvidence',
  'express_consent_evidence': 'expressConsentEvidence',
  'expressconsentevidence': 'expressConsentEvidence',
  'consent evidence': 'expressConsentEvidence',
  'consentevidence': 'expressConsentEvidence',
  'evidence': 'expressConsentEvidence',
  'consent notes': 'expressConsentEvidence',
  'consentnotes': 'expressConsentEvidence',
  // Transaction date
  'transaction date': 'transactionDate',
  'transaction_date': 'transactionDate',
  'transactiondate': 'transactionDate',
  'date of service': 'transactionDate',
  'dateofservice': 'transactionDate',
  'paid': 'transactionDate',
  'closed date': 'transactionDate',
  'closeddate': 'transactionDate',
};

function normalizeHeader(header: string): string | null {
  const lower = header.trim().toLowerCase();
  if ((STANDARD_FIELDS as readonly string[]).includes(lower)) return lower;
  return HEADER_ALIASES[lower] || null;
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(parseRow);

  return { headers, rows };
}

function daysAgo(dateStr: string, now: Date): number | null {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

interface ModeValidation {
  rowErrors: Array<{ row: number; phone?: string; error: string }>;
}

function validateRowsForMode(
  rows: ParsedRow[],
  mode: IntakeMode
): ModeValidation {
  const now = new Date();
  const rowErrors: ModeValidation['rowErrors'] = [];

  rows.forEach((row, idx) => {
    const rowNum = idx + 2; // header is row 1

    if (mode === 'standard') {
      if (!row.inquiryDate) {
        rowErrors.push({
          row: rowNum,
          phone: row.phone,
          error:
            'inquiry_date is required for standard mode — add the column or switch mode',
        });
        return;
      }
      const age = daysAgo(row.inquiryDate, now);
      if (age === null) {
        rowErrors.push({
          row: rowNum,
          phone: row.phone,
          error: `inquiry_date "${row.inquiryDate}" is not a valid date`,
        });
        return;
      }
      if (age >= CASL_IMPLIED_CONSENT_DAYS) {
        rowErrors.push({
          row: rowNum,
          phone: row.phone,
          error: `inquiry_date is ${age} days old — switch to express_consent mode or remove this row`,
        });
      }
    }

    if (mode === 'express_consent') {
      if (!row.inquiryDate) {
        rowErrors.push({
          row: rowNum,
          phone: row.phone,
          error: 'inquiry_date is required for express_consent mode',
        });
        return;
      }
      const evidence = (row.expressConsentEvidence ?? '').trim();
      if (evidence.length < MIN_EXPRESS_CONSENT_EVIDENCE_LENGTH) {
        rowErrors.push({
          row: rowNum,
          phone: row.phone,
          error: `express_consent_evidence is required (>= ${MIN_EXPRESS_CONSENT_EVIDENCE_LENGTH} chars) describing how consent was obtained`,
        });
      }
    }

    if (mode === 'existing_customer') {
      if (!row.transactionDate) {
        rowErrors.push({
          row: rowNum,
          phone: row.phone,
          error:
            'transaction_date is required for existing_customer mode — add the column or switch mode',
        });
        return;
      }
      const age = daysAgo(row.transactionDate, now);
      if (age === null) {
        rowErrors.push({
          row: rowNum,
          phone: row.phone,
          error: `transaction_date "${row.transactionDate}" is not a valid date`,
        });
        return;
      }
      if (age >= EXISTING_CUSTOMER_WINDOW_DAYS) {
        rowErrors.push({
          row: rowNum,
          phone: row.phone,
          error: `transaction_date is ${age} days old — CASL §10(2) only covers prior paid relationships within 24 months (730 days)`,
        });
      }
    }
  });

  return { rowErrors };
}

export function ImportLeadsDialog({ onImported }: ImportLeadsDialogProps) {
  const { selectedClient } = useAdmin();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('mode');
  const [intakeMode, setIntakeMode] = useState<IntakeMode>('standard');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [columnMap, setColumnMap] = useState<Record<number, string>>({});
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rowErrors, setRowErrors] = useState<
    Array<{ row: number; phone?: string; error: string }>
  >([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep('mode');
    setIntakeMode('standard');
    setParsedRows([]);
    setColumnMap({});
    setRawHeaders([]);
    setRowErrors([]);
    setResult(null);
    setError(null);
  }, []);

  const selectedModeMeta = INTAKE_MODES.find((m) => m.value === intakeMode);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.name.endsWith('.csv')) {
        setError('Please select a CSV file');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setError('File too large (max 5MB)');
        return;
      }

      setError(null);

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const { headers, rows: rawRows } = parseCSV(text);

        if (headers.length === 0 || rawRows.length === 0) {
          setError('CSV file is empty or has no data rows');
          return;
        }

        const map: Record<number, string> = {};
        headers.forEach((h, i) => {
          const normalized = normalizeHeader(h);
          if (normalized) {
            map[i] = normalized;
          }
        });

        const mappedFields = Object.values(map);
        const hasPhone = mappedFields.includes('phone');
        if (!hasPhone) {
          setError(
            'CSV must have a "phone" column (or "phone number", "mobile", "cell")'
          );
          return;
        }

        // Mode-specific required-column gate (clear, actionable).
        if (intakeMode === 'standard' && !mappedFields.includes('inquiryDate')) {
          setError(
            'Standard mode requires an "inquiry_date" column — your CSV doesn\'t have it. Switch mode or add the column.'
          );
          return;
        }
        if (intakeMode === 'express_consent') {
          if (!mappedFields.includes('inquiryDate')) {
            setError(
              'Express-consent mode requires an "inquiry_date" column — your CSV doesn\'t have it.'
            );
            return;
          }
          if (!mappedFields.includes('expressConsentEvidence')) {
            setError(
              'Express-consent mode requires an "express_consent_evidence" column — your CSV doesn\'t have it.'
            );
            return;
          }
        }
        if (
          intakeMode === 'existing_customer' &&
          !mappedFields.includes('transactionDate')
        ) {
          setError(
            'Existing-customer mode requires a "transaction_date" column — your CSV doesn\'t have it. Switch mode or add the column.'
          );
          return;
        }

        setRawHeaders(headers);
        setColumnMap(map);

        const mapped: ParsedRow[] = rawRows
          .filter((row) => row.some((cell) => cell.trim()))
          .map((row) => {
            const obj: Record<string, string> = {};
            Object.entries(map).forEach(([colIdx, field]) => {
              const value = row[parseInt(colIdx)]?.trim();
              if (value) {
                obj[field] = value;
              }
            });
            return obj as unknown as ParsedRow;
          })
          .filter((row) => row.phone);

        if (mapped.length === 0) {
          setError('No valid rows found (each row must have a phone number)');
          return;
        }

        if (mapped.length > 1000) {
          setError(
            `Too many rows (${mapped.length}). Maximum is 1,000 per import.`
          );
          return;
        }

        // For existing_customer mode, the API expects inquiryDate to mirror
        // transactionDate (so dormant-reengagement keeps working). Surface
        // that to the operator via a normalized payload prepared at submit;
        // here we keep the raw values as-entered for transparent preview.

        const validation = validateRowsForMode(mapped, intakeMode);

        setParsedRows(mapped);
        setRowErrors(validation.rowErrors);
        setStep('preview');
      };

      reader.readAsText(file);
    },
    [intakeMode]
  );

  const handleImport = async () => {
    setStep('importing');
    setError(null);

    try {
      // Map per-mode payload. For existing_customer the API contract takes
      // transactionDate + optional notes; the backend mirrors transactionDate
      // into inquiry_date internally for dormant-reengagement continuity.
      const payloadRows = parsedRows.map((row) => {
        if (intakeMode === 'existing_customer') {
          return {
            ...row,
            // Drop standard-mode fields the server doesn't need for this mode.
            inquiryDate: undefined,
            expressConsentEvidence: undefined,
          };
        }
        if (intakeMode === 'standard') {
          return { ...row, expressConsentEvidence: undefined, transactionDate: undefined };
        }
        // express_consent
        return { ...row, transactionDate: undefined };
      });

      const res = await fetch('/api/leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: payloadRows,
          intakeMode,
          consentAttested: true,
        }),
      });

      const data: ImportResult & { error?: string } = await res.json();

      if (!res.ok) {
        setError(data.error || 'Import failed');
        setStep('preview');
        return;
      }

      setResult(data);
      setStep('done');
      onImported();
    } catch (err) {
      console.error('[ImportLeads] Import request failed:', err);
      setError('Network error. Please try again.');
      setStep('preview');
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) reset();
      }}
    >
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4 mr-1" />
        Import CSV
      </Button>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Leads from CSV</DialogTitle>
          <DialogDescription>
            {selectedClient ? (
              <>
                Importing leads for{' '}
                <strong>{selectedClient.businessName}</strong>. Choose how
                consent was obtained, then upload your CSV.
              </>
            ) : (
              'Choose how consent was obtained, then upload your CSV.'
            )}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div
            className="flex items-start gap-2 p-3 bg-[#FDEAE4] text-sienna rounded-md text-sm"
            role="alert"
          >
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {step === 'mode' && (
          <div className="space-y-4">
            <IntakeModeSelector value={intakeMode} onChange={setIntakeMode} />
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
              >
                Cancel
              </Button>
              <Button onClick={() => setStep('upload')}>
                Continue to upload
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'upload' && (
          <div className="space-y-4">
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3 space-y-1">
              <p className="font-medium text-foreground">
                Mode: {selectedModeMeta?.label}
              </p>
              <p>
                Required columns:{' '}
                <span className="font-mono text-foreground">
                  {selectedModeMeta?.requiredColumns.join(', ')}
                </span>
              </p>
              <a
                href={selectedModeMeta?.sampleCsv}
                download
                className="inline-block text-olive hover:underline"
              >
                Download sample CSV for this mode
              </a>
            </div>

            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-olive transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="font-medium">Click to select a CSV file</p>
              <p className="text-sm text-muted-foreground mt-1">
                Max 1,000 rows, 5MB file size
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileSelect}
            />
            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                Common column aliases are supported (e.g.,{' '}
                <span className="font-mono">Phone Number</span>,{' '}
                <span className="font-mono">Mobile</span>,{' '}
                <span className="font-mono">First Name</span>,{' '}
                <span className="font-mono">Service Type</span>,{' '}
                <span className="font-mono">Date of Inquiry</span>,{' '}
                <span className="font-mono">Date of Service</span>).
              </p>
              <p>
                Optional <span className="font-mono">status</span> column:{' '}
                <code className="bg-muted px-1 rounded">new</code>,{' '}
                <code className="bg-muted px-1 rounded">contacted</code>,{' '}
                <code className="bg-muted px-1 rounded">estimate_sent</code>.
                Defaults to <code className="bg-muted px-1 rounded">new</code>.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('mode')}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="text-sm space-y-1">
              <p className="font-medium">
                {parsedRows.length} rows ready to review
                {rowErrors.length > 0 && (
                  <span className="text-sienna">
                    {' '}
                    ({rowErrors.length} with issues)
                  </span>
                )}
              </p>
              <p className="text-muted-foreground text-xs">
                Mode:{' '}
                <span className="text-foreground font-medium">
                  {selectedModeMeta?.label}
                </span>{' '}
                · Mapped columns:{' '}
                <span className="font-mono">
                  {Object.values(columnMap).join(', ')}
                </span>
                {rawHeaders.some((h) => !normalizeHeader(h)) && (
                  <span className="text-sienna">
                    {' '}
                    (skipped:{' '}
                    {rawHeaders.filter((h) => !normalizeHeader(h)).join(', ')})
                  </span>
                )}
              </p>
            </div>

            {rowErrors.length > 0 && (
              <div
                className="bg-[#FDEAE4] rounded-md p-3 text-sm space-y-1"
                role="alert"
              >
                <p className="font-medium text-sienna flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Per-row issues for{' '}
                  <span className="font-normal">
                    {selectedModeMeta?.label}
                  </span>{' '}
                  mode
                </p>
                <div className="max-h-[160px] overflow-auto space-y-0.5">
                  {rowErrors.slice(0, 25).map((e, i) => (
                    <p key={i} className="text-xs text-foreground">
                      <span className="font-mono">Row {e.row}</span>
                      {e.phone ? ` (${e.phone})` : ''}: {e.error}
                    </p>
                  ))}
                  {rowErrors.length > 25 && (
                    <p className="text-xs text-muted-foreground">
                      ...and {rowErrors.length - 25} more
                    </p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground pt-1">
                  Fix in your CSV and re-upload, or change the consent basis
                  above to match this data.
                </p>
              </div>
            )}

            <div className="border rounded-md overflow-auto max-h-[260px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    {Object.values(columnMap).map((field) => (
                      <TableHead key={field}>{field}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.slice(0, 5).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground">
                        {i + 1}
                      </TableCell>
                      {Object.values(columnMap).map((field) => (
                        <TableCell
                          key={field}
                          className="max-w-[200px] truncate"
                        >
                          {(row as unknown as Record<string, string>)[field] ||
                            '—'}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {parsedRows.length > 5 && (
              <p className="text-xs text-muted-foreground">
                Showing first 5 of {parsedRows.length} rows
              </p>
            )}

            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setStep('upload');
                  setParsedRows([]);
                  setRowErrors([]);
                  setColumnMap({});
                  setRawHeaders([]);
                }}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Re-upload
              </Button>
              <Button
                onClick={handleImport}
                disabled={rowErrors.length > 0}
                title={
                  rowErrors.length > 0
                    ? 'Fix per-row issues before importing'
                    : undefined
                }
              >
                Import {parsedRows.length} Leads
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'importing' && (
          <div className="py-8 text-center">
            <div className="animate-spin h-8 w-8 border-2 border-olive border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-muted-foreground">
              Importing {parsedRows.length} leads...
            </p>
          </div>
        )}

        {step === 'done' && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-[#E8F5E9] rounded-md">
              <CheckCircle className="h-6 w-6 text-[#3D7A50]" />
              <div>
                <p className="font-medium text-[#3D7A50]">
                  {result.imported} leads imported successfully
                </p>
                {result.skipped > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {result.skipped} skipped (already exist)
                  </p>
                )}
              </div>
            </div>

            {result.errors && result.errors.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-sienna">
                  {result.errors.length} rows had issues:
                </p>
                <div className="border rounded-md overflow-auto max-h-[200px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Issue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.errors.slice(0, 20).map((err, i) => (
                        <TableRow key={i}>
                          <TableCell>{err.row || '—'}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {err.phone || '—'}
                          </TableCell>
                          <TableCell className="text-sm">{err.error}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
