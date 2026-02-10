'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Phone,
  MessageSquare,
  User,
  CheckCircle,
  ArrowLeft,
  Send,
} from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';

interface EscalationDetailProps {
  escalationId: string;
}

interface EscalationData {
  escalation: {
    id: string;
    leadId: string;
    clientId: string;
    reason: string;
    reasonDetails: string | null;
    priority: number;
    status: string;
    slaBreach: boolean;
    slaDeadline: string | null;
    conversationSummary: string | null;
    suggestedResponse: string | null;
    createdAt: string;
    assignedTo: string | null;
  };
  lead: {
    id: string;
    name: string | null;
    phone: string;
  } | null;
  conversation: Array<{
    id: string;
    direction: string | null;
    content: string;
    createdAt: string | null;
  }>;
  assignee: {
    id: string;
    name: string;
  } | null;
}

export function EscalationDetail({ escalationId }: EscalationDetailProps) {
  const [data, setData] = useState<EscalationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [response, setResponse] = useState('');
  const [sending, setSending] = useState(false);
  const [resolution, setResolution] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchData();
  }, [escalationId]);

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/escalations/${escalationId}`);
      const json = await res.json() as EscalationData;
      setData(json);
    } catch (error) {
      console.error('Failed to fetch escalation:', error);
    }
    setLoading(false);
  };

  const handleTakeover = async () => {
    try {
      await fetch(`/api/escalations/${escalationId}/takeover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamMemberId: data?.escalation.assignedTo || 'admin' }),
      });
      toast.success('Conversation taken over');
      fetchData();
    } catch {
      toast.error('Failed to take over');
    }
  };

  const handleSendResponse = async () => {
    if (!response.trim() || !data?.lead) return;

    setSending(true);
    try {
      await fetch(`/api/leads/${data.lead.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: response }),
      });
      setResponse('');
      toast.success('Message sent');
      fetchData();
    } catch {
      toast.error('Failed to send message');
    }
    setSending(false);
  };

  const handleResolve = async () => {
    if (!resolution) {
      toast.error('Select a resolution');
      return;
    }

    try {
      await fetch(`/api/escalations/${escalationId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamMemberId: data?.escalation.assignedTo || 'admin',
          resolution,
          notes,
          returnToAi: resolution === 'returned_to_ai',
        }),
      });
      toast.success('Escalation resolved');
      fetchData();
    } catch {
      toast.error('Failed to resolve');
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (!data) {
    return <div className="text-center py-8">Failed to load escalation</div>;
  }

  const { escalation, lead, conversation, assignee } = data;
  const isActive = ['pending', 'assigned', 'in_progress'].includes(escalation.status);

  return (
    <div className="container py-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/escalations">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{lead?.name || 'Unknown Lead'}</h1>
          <p className="text-muted-foreground">{lead?.phone}</p>
        </div>
        {escalation.slaBreach && (
          <Badge variant="destructive" className="text-lg px-4 py-2">
            SLA BREACH
          </Badge>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left column - Conversation */}
        <div className="md:col-span-2 space-y-4">
          {/* AI Summary */}
          {escalation.conversationSummary && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">AI Conversation Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{escalation.conversationSummary}</p>
              </CardContent>
            </Card>
          )}

          {/* Conversation history */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Conversation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {conversation.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        msg.direction === 'outbound'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm">{msg.content}</p>
                      {msg.createdAt && (
                        <p className="text-xs opacity-70 mt-1">
                          {format(new Date(msg.createdAt), 'MMM d, h:mm a')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {conversation.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">No messages yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Response input */}
          {isActive && (
            <Card>
              <CardContent className="pt-4">
                <div className="space-y-4">
                  {escalation.suggestedResponse && (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Suggested response:</p>
                      <p className="text-sm">{escalation.suggestedResponse}</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-2"
                        onClick={() => setResponse(escalation.suggestedResponse || '')}
                      >
                        Use this
                      </Button>
                    </div>
                  )}

                  <Textarea
                    placeholder="Type your response..."
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    rows={3}
                  />

                  <div className="flex gap-2">
                    {escalation.status === 'assigned' && (
                      <Button variant="outline" onClick={handleTakeover}>
                        Take Over Conversation
                      </Button>
                    )}
                    <Button
                      onClick={handleSendResponse}
                      disabled={!response.trim() || sending}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Send Response
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column - Details */}
        <div className="space-y-4">
          {/* Escalation details */}
          <Card>
            <CardHeader>
              <CardTitle>Escalation Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Reason</p>
                <p className="font-medium capitalize">{escalation.reason.replace(/_/g, ' ')}</p>
              </div>

              {escalation.reasonDetails && (
                <div>
                  <p className="text-sm text-muted-foreground">Details</p>
                  <p>{escalation.reasonDetails}</p>
                </div>
              )}

              <div>
                <p className="text-sm text-muted-foreground">Priority</p>
                <Badge variant={escalation.priority === 1 ? 'destructive' : 'secondary'}>
                  {escalation.priority === 1 ? 'Urgent' : escalation.priority === 2 ? 'High' : 'Normal'}
                </Badge>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge>{escalation.status.replace(/_/g, ' ')}</Badge>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p>{formatDistanceToNow(new Date(escalation.createdAt), { addSuffix: true })}</p>
              </div>

              {assignee && (
                <div>
                  <p className="text-sm text-muted-foreground">Assigned to</p>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {assignee.name}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {lead && (
                <>
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <a href={`tel:${lead.phone}`}>
                      <Phone className="h-4 w-4 mr-2" />
                      Call {lead.name || 'Lead'}
                    </a>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href={`/leads/${lead.id}`}>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      View Lead Profile
                    </Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Resolution */}
          {isActive && (
            <Card>
              <CardHeader>
                <CardTitle>Resolve Escalation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={resolution} onValueChange={setResolution}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select resolution" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="handled">Handled - Issue Resolved</SelectItem>
                    <SelectItem value="returned_to_ai">Return to AI</SelectItem>
                    <SelectItem value="converted">Converted - Booked Job</SelectItem>
                    <SelectItem value="lost">Lost - No Longer Interested</SelectItem>
                    <SelectItem value="no_action">No Action Needed</SelectItem>
                  </SelectContent>
                </Select>

                <Textarea
                  placeholder="Resolution notes (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />

                <Button onClick={handleResolve} className="w-full">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Resolve
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
