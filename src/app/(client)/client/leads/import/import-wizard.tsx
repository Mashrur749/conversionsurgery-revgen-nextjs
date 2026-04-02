'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, AlertCircle, CheckCircle2, X } from 'lucide-react';

interface ParsedRow {
  name?: string;
  phone: string;
  email?: string;
  projectType?: string;
  status?: string;
}

interface ImportResult {
  imported: number;
  skipped: number;
  total: number;
  errors?: Array<{ row: number; phone?: string; error: string }>;
}

function parseCSV(text: string): { rows: ParsedRow[]; parseErrors: string[] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) {
    return { rows: [], parseErrors: ['CSV must have a header row and at least one data row'] };
  }

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, ''));
  const parseErrors: string[] = [];
  const rows: ParsedRow[] = [];

  // Map header aliases
  const colIndex = (names: string[]) => names.map((n) => header.indexOf(n)).find((i) => i >= 0) ?? -1;

  const nameIdx = colIndex(['name', 'fullname', 'customername']);
  const phoneIdx = colIndex(['phone', 'phonenumber', 'mobile', 'cell']);
  const emailIdx = colIndex(['email', 'emailaddress']);
  const projectTypeIdx = colIndex(['projecttype', 'project', 'service', 'jobtype']);
  const statusIdx = colIndex(['status']);

  if (phoneIdx === -1) {
    return { rows: [], parseErrors: ['CSV must include a "phone" column'] };
  }

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const phone = phoneIdx >= 0 ? cols[phoneIdx] : '';
    if (!phone) {
      parseErrors.push(`Row ${i + 1}: missing phone number`);
      continue;
    }

    const ALLOWED = ['new', 'contacted', 'estimate_sent'];
    const rawStatus = statusIdx >= 0 ? cols[statusIdx] : '';
    const status = ALLOWED.includes(rawStatus) ? rawStatus : undefined;

    rows.push({
      name: nameIdx >= 0 ? cols[nameIdx] || undefined : undefined,
      phone,
      email: emailIdx >= 0 ? cols[emailIdx] || undefined : undefined,
      projectType: projectTypeIdx >= 0 ? cols[projectTypeIdx] || undefined : undefined,
      status,
    });
  }

  return { rows, parseErrors };
}

export function ImportWizard() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[] | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  function reset() {
    setFileName(null);
    setParsedRows(null);
    setParseErrors([]);
    setResult(null);
    setImportError(null);
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
      const { rows, parseErrors: errs } = parseCSV(text);
      setParsedRows(rows);
      setParseErrors(errs);
      setResult(null);
      setImportError(null);
    };
    reader.readAsText(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, []);

  async function handleImport() {
    if (!parsedRows || parsedRows.length === 0) return;
    setImporting(true);
    setImportError(null);
    try {
      const res = await fetch('/api/client/leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsedRows }),
      });
      const data: ImportResult & { error?: string } = await res.json();
      if (!res.ok) {
        setImportError(data.error ?? 'Import failed. Please try again.');
        return;
      }
      setResult(data);
      router.refresh();
    } catch {
      setImportError('Network error. Please try again.');
    } finally {
      setImporting(false);
    }
  }

  // --- Success state ---
  if (result) {
    return (
      <Card>
        <CardContent className="py-8 flex flex-col items-center gap-4">
          <CheckCircle2 className="h-10 w-10 text-[#3D7A50]" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">Import complete</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {result.imported} lead{result.imported !== 1 ? 's' : ''} imported
              {result.skipped > 0 ? `, ${result.skipped} skipped (already exist)` : ''}
            </p>
          </div>
          {result.errors && result.errors.length > 0 && (
            <div className="w-full bg-[#FDEAE4] rounded p-3 text-sm space-y-1">
              <p className="font-medium text-terracotta">Row errors ({result.errors.length}):</p>
              {result.errors.slice(0, 10).map((e, i) => (
                <p key={i} className="text-muted-foreground">
                  {e.row > 0 ? `Row ${e.row}: ` : ''}{e.phone ? `${e.phone} — ` : ''}{e.error}
                </p>
              ))}
              {result.errors.length > 10 && (
                <p className="text-muted-foreground">...and {result.errors.length - 10} more</p>
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
      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          dragging ? 'border-[#D4754A] bg-[#FFF3E0]' : 'border-muted-foreground/30 hover:border-[#D4754A]/60'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
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
            <p className="text-sm font-medium">Drop your CSV here, or click to select</p>
            <p className="text-xs text-muted-foreground mt-1">Accepts .csv files up to 1,000 rows</p>
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

      {/* Parse errors */}
      {parseErrors.length > 0 && (
        <div className="bg-[#FDEAE4] rounded p-3 flex gap-2 items-start text-sm">
          <AlertCircle className="h-4 w-4 text-terracotta shrink-0 mt-0.5" />
          <div className="space-y-1">
            {parseErrors.map((e, i) => <p key={i}>{e}</p>)}
          </div>
        </div>
      )}

      {/* Preview */}
      {parsedRows && parsedRows.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Preview — {parsedRows.length} row{parsedRows.length !== 1 ? 's' : ''} found
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={reset} aria-label="Clear file">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {/* Header row */}
            <div className="hidden sm:grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground border-b pb-2">
              <span>Name</span>
              <span>Phone</span>
              <span>Project type</span>
              <span>Status</span>
            </div>
            {parsedRows.slice(0, 5).map((row, i) => (
              <div key={i} className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm py-1 border-b last:border-0">
                <span className="truncate">{row.name || <span className="text-muted-foreground">—</span>}</span>
                <span className="truncate font-mono text-xs">{row.phone}</span>
                <span className="truncate hidden sm:block">{row.projectType || <span className="text-muted-foreground">—</span>}</span>
                <span className="hidden sm:block">
                  {row.status ? (
                    <Badge className="bg-[#FFF3E0] text-terracotta text-xs">{row.status}</Badge>
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
      )}

      {/* Import error */}
      {importError && (
        <div className="bg-[#FDEAE4] rounded p-3 flex gap-2 items-start text-sm">
          <AlertCircle className="h-4 w-4 text-terracotta shrink-0 mt-0.5" />
          <p>{importError}</p>
        </div>
      )}

      {/* Actions */}
      {parsedRows && parsedRows.length > 0 && (
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={reset} disabled={importing}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={importing || parsedRows.length === 0}
            className="bg-[#1B2F26] hover:bg-[#1B2F26]/90 text-white"
          >
            <FileText className="h-4 w-4 mr-2" />
            {importing ? 'Importing...' : `Import ${parsedRows.length} lead${parsedRows.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      )}
    </div>
  );
}
