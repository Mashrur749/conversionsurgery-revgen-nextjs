'use client';

import { Fragment, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { Download, FileText, ExternalLink, RotateCw } from 'lucide-react';

interface Invoice {
  id: string;
  number: string;
  status: string;
  amountDue: number;
  amountPaid: number;
  createdAt: Date;
  dueDate: Date | null;
  paidAt: Date | null;
  pdfUrl: string | null;
  hostedInvoiceUrl: string | null;
  lineItems: {
    description: string;
    totalCents: number;
    quantity: number;
    eventIds: string[];
  }[];
}

interface InvoiceListProps {
  invoices: Invoice[];
  onLoadMore?: () => void;
  hasMore?: boolean;
  onRetryPayment?: (invoiceId: string) => Promise<void>;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-muted text-foreground' },
  open: { label: 'Open', color: 'bg-sage-light text-forest' },
  paid: { label: 'Paid', color: 'bg-[#E8F5E9] text-[#3D7A50]' },
  void: { label: 'Void', color: 'bg-muted text-foreground' },
  uncollectible: { label: 'Uncollectible', color: 'bg-[#FDEAE4] text-sienna' },
};

export function InvoiceList({ invoices, onLoadMore, hasMore, onRetryPayment }: InvoiceListProps) {
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Invoice History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No invoices yet.
          </p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => {
                    const cfg = statusConfig[invoice.status] || statusConfig.draft;
                    return (
                      <Fragment key={invoice.id}>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() =>
                            setExpandedInvoice(
                              expandedInvoice === invoice.id ? null : invoice.id
                            )
                          }
                        >
                          <TableCell className="font-medium">
                            {invoice.number}
                          </TableCell>
                          <TableCell>
                            {format(invoice.createdAt, 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell>
                            <Badge className={cfg.color}>
                              {cfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            ${(invoice.amountDue / 100).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {onRetryPayment && (invoice.status === 'open' || invoice.status === 'uncollectible') && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={retrying === invoice.id}
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    setRetrying(invoice.id);
                                    try {
                                      await onRetryPayment(invoice.id);
                                    } finally {
                                      setRetrying(null);
                                    }
                                  }}
                                >
                                  <RotateCw className={`h-4 w-4 mr-1 ${retrying === invoice.id ? 'animate-spin' : ''}`} />
                                  Retry
                                </Button>
                              )}
                              {invoice.pdfUrl && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(invoice.pdfUrl!, '_blank');
                                  }}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              )}
                              {invoice.hostedInvoiceUrl && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(invoice.hostedInvoiceUrl!, '_blank');
                                  }}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                        {expandedInvoice === invoice.id && (
                          <TableRow>
                            <TableCell colSpan={5} className="bg-muted/30">
                              <div className="p-4 space-y-2">
                                <h4 className="font-medium">Line Items</h4>
                                {invoice.lineItems.map((item, idx) => (
                                  <div
                                    key={idx}
                                    className="flex justify-between text-sm"
                                  >
                                    <span>
                                      {item.description}
                                      {item.quantity > 1 && ` x ${item.quantity}`}
                                      {item.eventIds.length > 0 && (
                                        <span className="ml-2 text-xs text-muted-foreground">
                                          ({item.eventIds.length} source event)
                                        </span>
                                      )}
                                    </span>
                                    <span>${(item.totalCents / 100).toFixed(2)}</span>
                                  </div>
                                ))}
                                <div className="flex justify-between font-medium pt-2 border-t">
                                  <span>Total</span>
                                  <span>
                                    ${(invoice.amountDue / 100).toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-3">
              {invoices.map((invoice) => {
                const cfg = statusConfig[invoice.status] || statusConfig.draft;
                const canRetry = onRetryPayment && (invoice.status === 'open' || invoice.status === 'uncollectible');
                return (
                  <div key={invoice.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{invoice.number}</span>
                      <Badge className={cfg.color}>{cfg.label}</Badge>
                    </div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-lg font-bold">
                        ${(invoice.amountDue / 100).toFixed(2)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(invoice.createdAt, 'MMM d, yyyy')}
                      </span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {invoice.pdfUrl && (
                        <a href={invoice.pdfUrl} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm">
                            <Download className="h-3 w-3 mr-1" />
                            PDF
                          </Button>
                        </a>
                      )}
                      {invoice.hostedInvoiceUrl && (
                        <a href={invoice.hostedInvoiceUrl} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm">
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View
                          </Button>
                        </a>
                      )}
                      {canRetry && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={retrying === invoice.id}
                          onClick={async () => {
                            setRetrying(invoice.id);
                            try {
                              await onRetryPayment(invoice.id);
                            } finally {
                              setRetrying(null);
                            }
                          }}
                        >
                          <RotateCw className={`h-3 w-3 mr-1 ${retrying === invoice.id ? 'animate-spin' : ''}`} />
                          Retry
                        </Button>
                      )}
                    </div>
                    {invoice.lineItems.length > 0 && (
                      <details className="mt-3">
                        <summary className="text-xs text-muted-foreground cursor-pointer select-none">
                          Line items ({invoice.lineItems.length})
                        </summary>
                        <div className="mt-2 space-y-1">
                          {invoice.lineItems.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span>
                                {item.description}
                                {item.quantity > 1 && ` x ${item.quantity}`}
                                {item.eventIds.length > 0 && (
                                  <span className="ml-1 text-xs text-muted-foreground">
                                    ({item.eventIds.length} source event)
                                  </span>
                                )}
                              </span>
                              <span className="ml-2 shrink-0">${(item.totalCents / 100).toFixed(2)}</span>
                            </div>
                          ))}
                          <div className="flex justify-between font-medium pt-2 border-t text-sm">
                            <span>Total</span>
                            <span>${(invoice.amountDue / 100).toFixed(2)}</span>
                          </div>
                        </div>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>

            {hasMore && (
              <div className="mt-4 text-center">
                <Button variant="outline" onClick={onLoadMore}>
                  Load More
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
