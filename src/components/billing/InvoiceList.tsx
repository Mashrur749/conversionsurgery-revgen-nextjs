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
import { Download, FileText, ExternalLink } from 'lucide-react';

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
  }[];
}

interface InvoiceListProps {
  invoices: Invoice[];
  onLoadMore?: () => void;
  hasMore?: boolean;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-800' },
  open: { label: 'Open', color: 'bg-blue-100 text-blue-800' },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-800' },
  void: { label: 'Void', color: 'bg-gray-100 text-gray-800' },
  uncollectible: { label: 'Uncollectible', color: 'bg-red-100 text-red-800' },
};

export function InvoiceList({ invoices, onLoadMore, hasMore }: InvoiceListProps) {
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);

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
