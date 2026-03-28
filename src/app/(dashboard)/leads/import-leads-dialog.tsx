'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
}

interface ImportResult {
  imported: number;
  skipped: number;
  total: number;
  errors?: Array<{ row: number; phone?: string; error: string }>;
}

type Step = 'upload' | 'preview' | 'importing' | 'done';

const EXPECTED_HEADERS = ['name', 'phone', 'email', 'address', 'projectType', 'notes', 'status'];
const HEADER_ALIASES: Record<string, string> = {
  'first name': 'name',
  'first_name': 'name',
  'firstname': 'name',
  'full name': 'name',
  'full_name': 'name',
  'contact name': 'name',
  'contact': 'name',
  'phone number': 'phone',
  'phone_number': 'phone',
  'phonenumber': 'phone',
  'mobile': 'phone',
  'cell': 'phone',
  'telephone': 'phone',
  'tel': 'phone',
  'email address': 'email',
  'email_address': 'email',
  'e-mail': 'email',
  'street': 'address',
  'street address': 'address',
  'location': 'address',
  'city': 'address',
  'project type': 'projectType',
  'project_type': 'projectType',
  'service': 'projectType',
  'service type': 'projectType',
  'type': 'projectType',
  'job type': 'projectType',
  'note': 'notes',
  'comment': 'notes',
  'comments': 'notes',
  'description': 'notes',
  'lead status': 'status',
  'lead_status': 'status',
  'stage': 'status',
  'pipeline stage': 'status',
  'pipeline_stage': 'status',
};

function normalizeHeader(header: string): string | null {
  const lower = header.trim().toLowerCase();
  if (EXPECTED_HEADERS.includes(lower)) return lower;
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

export function ImportLeadsDialog({ onImported }: ImportLeadsDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('upload');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [columnMap, setColumnMap] = useState<Record<number, string>>({});
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep('upload');
    setParsedRows([]);
    setColumnMap({});
    setRawHeaders([]);
    setResult(null);
    setError(null);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
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

      // Auto-map columns
      const map: Record<number, string> = {};
      headers.forEach((h, i) => {
        const normalized = normalizeHeader(h);
        if (normalized) {
          map[i] = normalized;
        }
      });

      // Must have phone column
      const hasPhone = Object.values(map).includes('phone');
      if (!hasPhone) {
        setError('CSV must have a "phone" column (or "phone number", "mobile", "cell")');
        return;
      }

      setRawHeaders(headers);
      setColumnMap(map);

      // Map rows to objects
      const mapped: ParsedRow[] = rawRows
        .filter((row) => row.some((cell) => cell.trim())) // Skip empty rows
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
        .filter((row) => row.phone); // Must have phone

      if (mapped.length === 0) {
        setError('No valid rows found (each row must have a phone number)');
        return;
      }

      if (mapped.length > 1000) {
        setError(`Too many rows (${mapped.length}). Maximum is 1,000 per import.`);
        return;
      }

      setParsedRows(mapped);
      setStep('preview');
    };

    reader.readAsText(file);
  }, []);

  const handleImport = async () => {
    setStep('importing');
    setError(null);

    try {
      const res = await fetch('/api/leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsedRows }),
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
      <DialogTrigger className="inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md text-sm font-medium h-8 px-3 border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground">
        <Upload className="h-4 w-4" />
        Import CSV
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Leads from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file with lead contact information. Required column: phone.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-[#FDEAE4] text-sienna rounded-md text-sm" role="alert">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {step === 'upload' && (
          <div className="space-y-4">
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
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-1">Expected columns:</p>
              <p>phone (required), name, email, address, projectType, notes, status</p>
              <p className="mt-1">
                Common aliases are supported (e.g., &quot;Phone Number&quot;, &quot;Mobile&quot;, &quot;First Name&quot;, &quot;Service Type&quot;).
              </p>
              <p className="mt-1">
                Status values: <code className="text-xs bg-muted px-1 rounded">new</code>, <code className="text-xs bg-muted px-1 rounded">contacted</code>, <code className="text-xs bg-muted px-1 rounded">estimate_sent</code>. Defaults to <code className="text-xs bg-muted px-1 rounded">new</code> if not provided.
              </p>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="text-sm">
              <p className="font-medium">
                {parsedRows.length} rows ready to import
              </p>
              <p className="text-muted-foreground">
                Mapped columns: {Object.values(columnMap).join(', ')}
                {rawHeaders.some((h) => !normalizeHeader(h)) && (
                  <span className="text-sienna">
                    {' '}(skipped: {rawHeaders.filter((h) => !normalizeHeader(h)).join(', ')})
                  </span>
                )}
              </p>
            </div>

            <div className="border rounded-md overflow-auto max-h-[300px]">
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
                  {parsedRows.slice(0, 10).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      {Object.values(columnMap).map((field) => (
                        <TableCell key={field} className="max-w-[200px] truncate">
                          {(row as unknown as Record<string, string>)[field] || '—'}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {parsedRows.length > 10 && (
              <p className="text-sm text-muted-foreground">
                Showing first 10 of {parsedRows.length} rows
              </p>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={reset}>
                Cancel
              </Button>
              <Button onClick={handleImport}>
                Import {parsedRows.length} Leads
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'importing' && (
          <div className="py-8 text-center">
            <div className="animate-spin h-8 w-8 border-2 border-olive border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-muted-foreground">Importing {parsedRows.length} leads...</p>
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
                          <TableCell className="font-mono text-sm">{err.phone || '—'}</TableCell>
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
