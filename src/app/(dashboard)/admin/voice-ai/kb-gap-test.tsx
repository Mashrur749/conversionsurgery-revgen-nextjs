'use client';

import { useState } from 'react';
import { CheckCircle, AlertTriangle, XCircle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  clientId: string;
}

const KB_TEST_QUESTIONS = [
  'What services do you offer?',
  'How much does a typical project cost?',
  'What areas do you serve?',
  'Are you licensed and insured?',
  'How long does a project usually take?',
  'Do you offer financing?',
  'Can I see examples of your work?',
  'What warranties do you provide?',
  'How do I get a quote?',
  'Do you do emergency work?',
];

type ResultStatus = 'answered' | 'deferred' | 'gap';

interface TestResult {
  question: string;
  response: string;
  status: ResultStatus;
}

function classifyResponse(response: string): ResultStatus {
  if (!response || response.trim().length < 10) return 'gap';
  const lower = response.toLowerCase();
  if (
    lower.includes("get back to you") ||
    lower.includes("don't have") ||
    lower.includes("i'd want") ||
    lower.includes("let me have")
  ) {
    return 'deferred';
  }
  return 'answered';
}

function ResultRow({ result, clientId }: { result: TestResult; clientId: string }) {
  const [expanded, setExpanded] = useState(false);

  const icon =
    result.status === 'answered' ? (
      <CheckCircle className="h-4 w-4 text-[#3D7A50] shrink-0" />
    ) : result.status === 'deferred' ? (
      <AlertTriangle className="h-4 w-4 text-[#C15B2E] shrink-0" />
    ) : (
      <XCircle className="h-4 w-4 text-[#C15B2E] shrink-0" />
    );

  const label =
    result.status === 'answered'
      ? 'Answered'
      : result.status === 'deferred'
        ? 'Deferred'
        : 'Gap';

  return (
    <div
      className={cn(
        'rounded-md border text-sm',
        result.status === 'gap' && 'bg-[#FDEAE4] border-[#C15B2E]/30',
        result.status === 'deferred' && 'border-l-4 border-l-[#C15B2E] border-t border-r border-b border-border',
        result.status === 'answered' && 'border-border'
      )}
    >
      <button
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        {icon}
        <span className="flex-1 font-medium text-foreground">{result.question}</span>
        <span
          className={cn(
            'text-xs px-2 py-0.5 rounded-full',
            result.status === 'answered' && 'bg-[#E8F5E9] text-[#3D7A50]',
            result.status === 'deferred' && 'bg-[#FFF3E0] text-[#C15B2E]',
            result.status === 'gap' && 'bg-[#FDEAE4] text-[#C15B2E]'
          )}
        >
          {label}
        </span>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap border-t border-border/50 pt-2">
            {result.response || '(no response)'}
          </p>
          {result.status === 'gap' && (
            <a
              href={`/admin/clients/${clientId}/knowledge`}
              className="inline-flex items-center gap-1 text-xs text-[#6B7E54] hover:text-[#6B7E54]/80 font-medium"
            >
              <ExternalLink className="h-3 w-3" />
              Add to KB
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export function KbGapTest({ clientId }: Props) {
  const [results, setResults] = useState<(TestResult | null)[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  async function runTest() {
    setRunning(true);
    setProgress(0);
    setResults(new Array(KB_TEST_QUESTIONS.length).fill(null));

    for (let i = 0; i < KB_TEST_QUESTIONS.length; i++) {
      const question = KB_TEST_QUESTIONS[i];
      try {
        const res = await fetch(`/api/admin/clients/${clientId}/voice-simulate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: question, history: [] }),
        });
        const data = res.ok
          ? ((await res.json()) as { response: string })
          : { response: '' };

        const status = classifyResponse(data.response);
        setResults((prev) => {
          const updated = [...prev];
          updated[i] = { question, response: data.response, status };
          return updated;
        });
      } catch {
        setResults((prev) => {
          const updated = [...prev];
          updated[i] = { question, response: '', status: 'gap' };
          return updated;
        });
      }
      setProgress(i + 1);

      // Small delay between requests to avoid rate limits
      if (i < KB_TEST_QUESTIONS.length - 1) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    setRunning(false);
  }

  const completed = results.filter(Boolean) as TestResult[];
  const answered = completed.filter((r) => r.status === 'answered').length;
  const deferred = completed.filter((r) => r.status === 'deferred').length;
  const gaps = completed.filter((r) => r.status === 'gap').length;
  const isDone = !running && results.length > 0 && results.every(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Knowledge Base Coverage Test</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Runs {KB_TEST_QUESTIONS.length} standard homeowner questions through the voice AI
          </p>
        </div>
        <button
          onClick={() => void runTest()}
          disabled={running}
          className="h-9 px-4 rounded-md bg-[#1B2F26] text-white text-sm font-medium hover:bg-[#1B2F26]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer shrink-0"
        >
          {running ? `Testing... ${progress}/${KB_TEST_QUESTIONS.length}` : 'Run KB Test'}
        </button>
      </div>

      {/* Progress bar */}
      {running && (
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-[#6B7E54] transition-all duration-300"
            style={{ width: `${(progress / KB_TEST_QUESTIONS.length) * 100}%` }}
          />
        </div>
      )}

      {/* Summary */}
      {isDone && (
        <div className="flex gap-4 text-sm p-3 rounded-md bg-muted/50 border border-border">
          <span className="text-[#3D7A50] font-medium">{answered}/{KB_TEST_QUESTIONS.length} answered</span>
          <span className="text-muted-foreground">&middot;</span>
          <span className="text-[#C15B2E] font-medium">{deferred} deferred</span>
          <span className="text-muted-foreground">&middot;</span>
          <span className="text-[#C15B2E] font-medium">{gaps} gaps</span>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((result, i) =>
            result ? (
              <ResultRow key={i} result={result} clientId={clientId} />
            ) : (
              <div
                key={i}
                className="h-10 rounded-md border border-border bg-muted/30 animate-pulse"
              />
            )
          )}
        </div>
      )}

      {results.length === 0 && !running && (
        <div className="flex flex-col items-center py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Click &ldquo;Run KB Test&rdquo; to check knowledge base coverage
          </p>
        </div>
      )}
    </div>
  );
}
