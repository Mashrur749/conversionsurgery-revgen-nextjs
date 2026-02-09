'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Clock, Play, FileText } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface VoiceCall {
  id: string;
  from: string;
  duration: number | null;
  callerIntent: string | null;
  outcome: string | null;
  aiSummary: string | null;
  transcript: string | null;
  recordingUrl: string | null;
  startedAt: string | null;
  createdAt: string;
}

interface CallHistoryProps {
  clientId: string;
}

export function CallHistory({ clientId }: CallHistoryProps) {
  const [calls, setCalls] = useState<VoiceCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTranscript, setExpandedTranscript] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/clients/${clientId}/voice-calls`)
      .then((r) => r.json())
      .then((data) => {
        setCalls(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [clientId]);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const intentColors: Record<string, string> = {
    quote: 'bg-green-100 text-green-800',
    schedule: 'bg-blue-100 text-blue-800',
    question: 'bg-purple-100 text-purple-800',
    complaint: 'bg-red-100 text-red-800',
    transfer: 'bg-orange-100 text-orange-800',
    other: 'bg-gray-100 text-gray-800',
  };

  const outcomeColors: Record<string, string> = {
    qualified: 'bg-green-100 text-green-800',
    scheduled: 'bg-blue-100 text-blue-800',
    transferred: 'bg-orange-100 text-orange-800',
    voicemail: 'bg-yellow-100 text-yellow-800',
    dropped: 'bg-red-100 text-red-800',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Voice Call History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading calls...
          </div>
        ) : calls.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No voice calls yet
          </div>
        ) : (
          <div className="space-y-4">
            {calls.map((call) => (
              <div
                key={call.id}
                className="p-4 border rounded-lg space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{call.from}</span>
                    {call.callerIntent && (
                      <Badge className={intentColors[call.callerIntent] || intentColors.other}>
                        {call.callerIntent}
                      </Badge>
                    )}
                    {call.outcome && (
                      <Badge variant="outline" className={outcomeColors[call.outcome] || ''}>
                        {call.outcome}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {formatDuration(call.duration)}
                  </div>
                </div>

                {call.aiSummary && (
                  <p className="text-sm text-muted-foreground">
                    {call.aiSummary}
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {call.startedAt
                      ? formatDistanceToNow(new Date(call.startedAt), { addSuffix: true })
                      : formatDistanceToNow(new Date(call.createdAt), { addSuffix: true })}
                  </span>
                  <div className="flex gap-2">
                    {call.recordingUrl && (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={call.recordingUrl} target="_blank" rel="noopener noreferrer">
                          <Play className="h-4 w-4 mr-1" />
                          Play
                        </a>
                      </Button>
                    )}
                    {call.transcript && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setExpandedTranscript(
                            expandedTranscript === call.id ? null : call.id
                          )
                        }
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        Transcript
                      </Button>
                    )}
                  </div>
                </div>

                {expandedTranscript === call.id && call.transcript && (
                  <div className="mt-2 p-3 bg-gray-50 rounded text-sm whitespace-pre-wrap">
                    {call.transcript}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
