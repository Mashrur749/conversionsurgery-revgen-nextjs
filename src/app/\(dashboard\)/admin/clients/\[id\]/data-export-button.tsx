'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';

interface DataExportButtonProps {
  clientId: string;
}

export function DataExportButton({ clientId }: DataExportButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleExport = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/admin/clients/${clientId}/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        setErrorMessage(error.error || 'Failed to trigger data export');
        return;
      }

      const data = await response.json();
      setSuccessMessage(`Data export triggered successfully (Status: ${data.status})`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Export...
              </>
            ) : (
              'Generate Data Export'
            )}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generate Data Export</AlertDialogTitle>
            <AlertDialogDescription>
              This will generate a full data export for this client including all leads, conversations, and pipeline data. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleExport}>
              Generate Export
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {successMessage && (
        <p className="text-sm text-[#3D7A50] bg-[#E8F5E9] px-3 py-2 rounded">
          {successMessage}
        </p>
      )}
      {errorMessage && (
        <p className="text-sm text-sienna bg-[#FDEAE4] px-3 py-2 rounded">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
