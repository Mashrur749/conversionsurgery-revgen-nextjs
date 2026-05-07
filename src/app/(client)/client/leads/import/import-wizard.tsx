'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  FileText,
  AlertCircle,
  CheckCircle2,
  X,
  ArrowLeft,
} from 'lucide-react';
import {
  IntakeModeSelector,
  INTAKE_MODES,
  type IntakeMode,
} from '@/components/leads/intake-mode-selector';

interface ParsedRow {
  name?: string;
  phone: string;
  email?: string;
  projectType?: string;
  status?: string;
  inquiryDate?: string;
  expressConsentEvidence?: string;
  transactionDate?: string;
  notes?: string;
}

interface ImportResult {
  imported: number;
  skipped: number;
  total: number;
  errors?: Array<{ row: number; phone?: string; error: string }>;
}

type Step = 'mode' | 'upload' | 'review' | 'done';

const CASL_IMPLIED_CONSENT_DAYS = 180;
const EXISTING_CUSTOMER_WINDOW_DAYS = 730;
const MIN_EXPRESS_CONSENT_EVIDENCE_LENGTH = 10;

interface ParseResult {
  rows: ParsedRow[];
  parseErrors: string[];
  rowErrors: Array<{ row: number; phone?: string; error: string }>;
  mappedFields: string[];
}

function parseCSV(text: string, mode: IntakeMode): ParseResult {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) {
    return {
      rows: [],
      parseErrors: ['CSV must have a header row and at least one data row'],
      rowErrors: [],
      mappedFields: [],
    };
  }

  const header = lines[0]
    .split(',')
    .map((h) => h.trim().toLowerCase().replace(/\s+/g, ''));
  const rows: ParsedRow[] = [];
  const parseErrors: string[] = [];
  const rowErrors: ParseResult['rowErrors'] = [];

  // colIndex finds the first column index whose normalized name matches one
  // of the supplied alias keys.
  const colIndex = (names: string[]): number =>
    names.map((n) => header.indexOf(n)).find((i) => i >= 0) ?? -1;

  const nameIdx = colIndex(['name', 'fullname', 'customername', 'firstname']);
  const phoneIdx = colIndex(['phone', 'phonenumber', 'mobile', 'cell']);
  const emailIdx = colIndex(['email', 'emailaddress']);
  const projectTypeIdx = colIndex([
    'projecttype',
    'project',
    'service',
    'jobtype',
    'servicetype',
    'type',
  ]);
  const statusIdx = colIndex(['status', 'leadstatus', 'stage']);
  const inquiryDateIdx = colIndex([
    'inquirydate',
    'inquiry_date',
    'dateofinquiry',
    'inquired',
  ]);
  const expressConsentIdx = colIndex([
    'expressconsentevidence',
    'express_consent_evidence',
    'consentevidence',
    'evidence',
    'consentnotes',
  ]);
  const transactionDateIdx = colIndex([
    'transactiondate',
    'transaction_date',
    'dateofservice',
    'paid',
    'closeddate',
  ]);
  const notesIdx = colIndex([
    'notes',
    'note',
    'customernotes',
    'comment',
    'comments',
  ]);

  if (phoneIdx === -1) {
    return {
      rows: [],
      parseErrors: ['CSV must include a "phone" column'],
      rowErrors: [],
      mappedFields: [],
    };
  }

  if (mode === 'standard' && inquiryDateIdx === -1) {
    return {
      rows: [],
      parseErrors: [
        'Standard mode requires an "inquiry_date" column — your CSV doesn\'t have it. Switch mode or add the column.',
      ],
      rowErrors: [],
      mappedFields: [],
    };
  }
  if (mode === 'express_consent') {
    if (inquiryDateIdx === -1) {
      return {
        rows: [],
        parseErrors: [
          'Express-consent mode requires an "inquiry_date" column.',
        ],
        rowErrors: [],
        mappedFields: [],
      };
    }
    if (expressConsentIdx === -1) {
      return {
        rows: [],
        parseErrors: [
          'Express-consent mode requires an "express_consent_evidence" column describing how consent was obtained.',
        ],
        rowErrors: [],
        mappedFields: [],
      };
    }
  }
  if (mode === 'existing_customer' && transactionDateIdx === -1) {
    return {
      rows: [],
      parseErrors: [
        'Existing-customer mode requires a "transaction_date" column — your CSV doesn\'t have it. Switch mode or add the column.',
      ],
      rowErrors: [],
      mappedFields: [],
    };
  }

  const ALLOWED_STATUSES = ['new', 'contacted', 'estimate_sent'];
  const now = new Date();

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]
      .split(',')
      .map((c) => c.trim().replace(/^"|"$/g, ''));
    const phone = phoneIdx >= 0 ? cols[phoneIdx] : '';
    const rowNum = i + 1; // header is row 1

    if (!phone) {
      parseErrors.push(`Row ${rowNum}: missing phone number`);
      continue;
    }

    const rawStatus = statusIdx >= 0 ? cols[statusIdx] : '';
    const status = ALLOWED_STATUSES.includes(rawStatus) ? rawStatus : undefined;
    const inquiryDate =
      inquiryDateIdx >= 0 ? cols[inquiryDateIdx] || undefined : undefined;
    const expressConsentEvidence =
      expressConsentIdx >= 0
        ? cols[expressConsentIdx] || undefined
        : undefined;
    const transactionDate =
      transactionDateIdx >= 0
        ? cols[transactionDateIdx] || undefined
        : undefined;
    const notes = notesIdx >= 0 ? cols[notesIdx] || undefined : undefined;

    const row: ParsedRow = {
      name: nameIdx >= 0 ? cols[nameIdx] || undefined : undefined,
      phone,
      email: emailIdx >= 0 ? cols[emailIdx] || undefined : undefined,
      projectType:
        projectTypeIdx >= 0 ? cols[projectTypeIdx] || undefined : undefined,
      status,
      inquiryDate,
      expressConsentEvidence,
      transactionDate,
      notes,
    };

    // Per-row validation by mode.
    if (mode === 'standard') {
      const dateStr = inquiryDate ?? '';
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) {
        rowErrors.push({
          row: rowNum,
          phone,
          error: `inquiry_date "${dateStr}" is not a valid date`,
        });
      } else {
        const age = Math.floor(
          (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (age >= CASL_IMPLIED_CONSENT_DAYS) {
          rowErrors.push({
            row: rowNum,
            phone,
            error: `inquiry_date is ${age} days old — switch to express_consent mode or remove this row`,
          });
        }
      }
    }

    if (mode === 'express_consent') {
      if (!inquiryDate) {
        rowErrors.push({
          row: rowNum,
          phone,
          error: 'inquiry_date is required',
        });
      }
      const evidence = (expressConsentEvidence ?? '').trim();
      if (evidence.length < MIN_EXPRESS_CONSENT_EVIDENCE_LENGTH) {
        rowErrors.push({
          row: rowNum,
          phone,
          error: `express_consent_evidence is required (>= ${MIN_EXPRESS_CONSENT_EVIDENCE_LENGTH} chars) describing how consent was obtained`,
        });
      }
    }

    if (mode === 'existing_customer') {
      const dateStr = transactionDate ?? '';
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) {
        rowErrors.push({
          row: rowNum,
          phone,
          error: `transaction_date "${dateStr}" is not a valid date`,
        });
      } else {
        const age = Math.floor(
          (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (age >= EXISTING_CUSTOMER_WINDOW_DAYS) {
          rowErrors.push({
            row: rowNum,
            phone,
            error: `transaction_date is ${age} days old — CASL §10(2) only covers prior paid relationships within 24 months (730 days)`,
          });
        }
      }
    }

    rows.push(row);
  }

  const mappedFields: string[] = ['phone'];
  if (nameIdx >= 0) mappedFields.push('name');
  if (emailIdx >= 0) mappedFields.push('email');
  if (projectTypeIdx >= 0) mappedFields.push('projectType');
  if (statusIdx >= 0) mappedFields.push('status');
  if (inquiryDateIdx >= 0) mappedFields.push('inquiryDate');
  if (expressConsentIdx >= 0) mappedFields.push('expressConsentEvidence');
  if (transactionDateIdx >= 0) mappedFields.push('transactionDate');
  if (notesIdx >= 0) mappedFields.push('notes');

  return { rows, parseErrors, rowErrors, mappedFields };
}

export function ImportWizard() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('mode');
  const [intakeMode, setIntakeMode] = useState<IntakeMode>('standard');
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[] | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [rowErrors, setRowErrors] = useState<
    Array<{ row: number; phone?: string; error: string }>
  >([]);
  const [mappedFields, setMappedFields] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [consentAttested, setConsentAttested] = useState(false);

  const selectedModeMeta = INTAKE_MODES.find((m) => m.value === intakeMode);

  function reset() {
    setStep('mode');
    setIntakeMode('standard');
    setFileName(null);
    setParsedRows(null);
    setParseErrors([]);
    setRowErrors([]);
    setMappedFields([]);
    setResult(null);
    setImportError(null);
    setConsentAttested(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function processFile(file: File) {
    if (!file.name.endsWith('.csv')) {
      setParseErrors(['Please upload a .csv file']);
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { rows, parseErrors: errs, rowErrors: rErrs, mappedFields: fields } =
        parseCSV(text, intakeMode);
      setParsedRows(rows);
      setParseErrors(errs);
      setRowErrors(rErrs);
      setMappedFields(fields);
      setResult(null);
      setImportError(null);
      if (errs.length === 0 && rows.length > 0) {
        setStep('review');
      }
    };
    reader.readAsText(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    // processFile depends on intakeMode but is stable within render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [intakeMode]
  );

  async function handleImport() {
    if (!parsedRows || parsedRows.length === 0) return;
    setImporting(true);
    setImportError(null);

    const payloadRows = parsedRows.map((row) => {
      if (intakeMode === 'existing_customer') {
        return {
          ...row,
          inquiryDate: undefined,
          expressConsentEvidence: undefined,
        };
      }
      if (intakeMode === 'standard') {
        return {
          ...row,
          expressConsentEvidence: undefined,
          transactionDate: undefined,
        };
      }
      return { ...row, transactionDate: undefined };
    });

    try {
      const res = await fetch('/api/client/leads/import', {
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
        setImportError(data.error ?? 'Import failed. Please try again.');
        return;
      }
      setResult(data);
      setStep('done');
      router.refresh();
    } catch {
      setImportError('Network error. Please try again.');
    } finally {
      setImporting(false);
    }
  }

  // Success state
  if (step === 'done' && result) {
    return (
      <Card>
        <CardContent className="py-8 flex flex-col items-center gap-4">
          <CheckCircle2 className="h-10 w-10 text-[#3D7A50]" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">Import complete</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {result.imported} lead{result.imported !== 1 ? 's' : ''} imported
              {result.skipped > 0
                ? `, ${result.skipped} skipped (already exist)`
                : ''}
            </p>
          </div>
          {result.errors && result.errors.length > 0 && (
            <div className="w-full bg-[#FDEAE4] rounded p-3 text-sm space-y-1">
              <p className="font-medium text-terracotta">
                Row errors ({result.errors.length}):
              </p>
              {result.errors.slice(0, 10).map((e, i) => (
                <p key={i} className="text-muted-foreground">
                  {e.row > 0 ? `Row ${e.row}: ` : ''}
                  {e.phone ? `${e.phone} — ` : ''}
                  {e.error}
                </p>
              ))}
              {result.errors.length > 10 && (
                <p className="text-muted-foreground">
                  ...and {result.errors.length - 10} more
                </p>
              )}
            </div>
          )}
          <Button variant="outline" onClick={reset}>
            Import another file
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Step 1: Mode selection */}
      {step === 'mode' && (
        <div className="space-y-4">
          <IntakeModeSelector value={intakeMode} onChange={setIntakeMode} />
          <div className="flex justify-end">
            <Button
              onClick={() => setStep('upload')}
              className="bg-[#1B2F26] hover:bg-[#1B2F26]/90 text-white"
            >
              Continue to upload
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Upload */}
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
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              dragging
                ? 'border-[#D4754A] bg-[#FFF3E0]'
                : 'border-muted-foreground/30 hover:border-[#D4754A]/60'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            aria-label="Upload CSV file"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            {fileName ? (
              <p className="text-sm font-medium">{fileName}</p>
            ) : (
              <>
                <p className="text-sm font-medium">
                  Drop your CSV here, or click to select
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Accepts .csv files up to 1,000 rows
                </p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {parseErrors.length > 0 && (
            <div
              className="bg-[#FDEAE4] rounded p-3 flex gap-2 items-start text-sm"
              role="alert"
            >
              <AlertCircle className="h-4 w-4 text-terracotta shrink-0 mt-0.5" />
              <div className="space-y-1">
                {parseErrors.map((e, i) => (
                  <p key={i}>{e}</p>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => {
                setStep('mode');
                setFileName(null);
                setParsedRows(null);
                setParseErrors([]);
                setRowErrors([]);
                setMappedFields([]);
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Review + import */}
      {step === 'review' && parsedRows && parsedRows.length > 0 && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">
                  Preview — {parsedRows.length} row
                  {parsedRows.length !== 1 ? 's' : ''} found
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={reset}
                  aria-label="Clear file"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                Mode:{' '}
                <span className="text-foreground font-medium">
                  {selectedModeMeta?.label}
                </span>{' '}
                · Mapped:{' '}
                <span className="font-mono">{mappedFields.join(', ')}</span>
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="hidden sm:grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground border-b pb-2">
                <span>Name</span>
                <span>Phone</span>
                <span>Project type</span>
                <span>Status</span>
              </div>
              {parsedRows.slice(0, 5).map((row, i) => (
                <div
                  key={i}
                  className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm py-1 border-b last:border-0"
                >
                  <span className="truncate">
                    {row.name || (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </span>
                  <span className="truncate font-mono text-xs">
                    {row.phone}
                  </span>
                  <span className="truncate hidden sm:block">
                    {row.projectType || (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </span>
                  <span className="hidden sm:block">
                    {row.status ? (
                      <Badge className="bg-[#FFF3E0] text-terracotta text-xs">
                        {row.status}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">new</span>
                    )}
                  </span>
                </div>
              ))}
              {parsedRows.length > 5 && (
                <p className="text-xs text-muted-foreground pt-1">
                  ...and {parsedRows.length - 5} more rows
                </p>
              )}
            </CardContent>
          </Card>

          {rowErrors.length > 0 && (
            <div
              className="bg-[#FDEAE4] rounded p-3 text-sm space-y-1"
              role="alert"
            >
              <p className="font-medium text-terracotta flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Per-row issues ({rowErrors.length})
              </p>
              <div className="max-h-[160px] overflow-auto space-y-0.5">
                {rowErrors.slice(0, 25).map((e, i) => (
                  <p key={i} className="text-xs">
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
                Fix in your CSV and re-upload, or change the consent basis to
                match this data.
              </p>
            </div>
          )}

          {importError && (
            <div
              className="bg-[#FDEAE4] rounded p-3 flex gap-2 items-start text-sm"
              role="alert"
            >
              <AlertCircle className="h-4 w-4 text-terracotta shrink-0 mt-0.5" />
              <p>{importError}</p>
            </div>
          )}

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consentAttested}
              onChange={(e) => setConsentAttested(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border border-input accent-[#1B2F26] cursor-pointer"
            />
            <span className="text-sm text-muted-foreground leading-snug">
              I confirm the contacts in this file qualify under the consent
              basis I selected ({selectedModeMeta?.label.toLowerCase()}) and I
              have the right to follow up with them under Canadian anti-spam
              law (CASL).
            </span>
          </label>

          <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setStep('upload');
                setParsedRows(null);
                setParseErrors([]);
                setRowErrors([]);
                setMappedFields([]);
                setFileName(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              disabled={importing}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Re-upload
            </Button>
            <Button
              onClick={handleImport}
              disabled={
                importing ||
                parsedRows.length === 0 ||
                !consentAttested ||
                rowErrors.length > 0
              }
              className="bg-[#1B2F26] hover:bg-[#1B2F26]/90 text-white"
              title={
                rowErrors.length > 0
                  ? 'Fix per-row issues before importing'
                  : undefined
              }
            >
              <FileText className="h-4 w-4 mr-2" />
              {importing
                ? 'Importing...'
                : `Import ${parsedRows.length} lead${parsedRows.length !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
