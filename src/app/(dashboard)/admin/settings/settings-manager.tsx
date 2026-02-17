'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Plus, Pencil, Check, X } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Setting {
  id: string;
  key: string;
  value: string;
  description: string | null;
  updatedAt: Date;
}

interface Props {
  settings: Setting[];
}

export function SystemSettingsManager({ settings: initialSettings }: Props) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteKey, setDeleteKey] = useState<string | null>(null);

  const startEdit = (setting: Setting) => {
    setEditingKey(setting.key);
    setEditValue(setting.value);
    setEditDesc(setting.description || '');
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditValue('');
    setEditDesc('');
  };

  const saveEdit = async (key: string) => {
    setSaving(true);
    const res = await fetch('/api/admin/system-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value: editValue, description: editDesc || undefined }),
    });
    if (res.ok) {
      setSettings((prev) =>
        prev.map((s) =>
          s.key === key ? { ...s, value: editValue, description: editDesc, updatedAt: new Date() } : s
        )
      );
      cancelEdit();
    }
    setSaving(false);
  };

  const addSetting = async () => {
    if (!newKey.trim() || !newValue.trim()) return;
    setSaving(true);
    const res = await fetch('/api/admin/system-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: newKey, value: newValue, description: newDesc || undefined }),
    });
    if (res.ok) {
      setShowAdd(false);
      setNewKey('');
      setNewValue('');
      setNewDesc('');
      router.refresh();
    }
    setSaving(false);
  };

  const deleteSetting = async () => {
    if (!deleteKey) return;
    const res = await fetch(`/api/admin/system-settings/${encodeURIComponent(deleteKey)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setSettings((prev) => prev.filter((s) => s.key !== deleteKey));
    }
    setDeleteKey(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Setting
        </Button>
      </div>

      {showAdd && (
        <Card className="border-blue-200">
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Key</Label>
                <Input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="setting_key" />
              </div>
              <div className="space-y-2">
                <Label>Value</Label>
                <Input value={newValue} onChange={(e) => setNewValue(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="What this setting controls..." />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={addSetting} disabled={saving}>
                {saving ? 'Adding...' : 'Add'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {settings.length === 0 && !showAdd ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No system settings configured yet.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {settings.map((setting) => (
                <div key={setting.key} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                  {editingKey === setting.key ? (
                    <div className="space-y-2">
                      <p className="font-mono text-sm font-medium">{setting.key}</p>
                      <Textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        rows={2}
                      />
                      <Input
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        placeholder="Description..."
                        className="text-sm"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveEdit(setting.key)} disabled={saving}>
                          <Check className="h-3 w-3 mr-1" />
                          {saving ? 'Saving...' : 'Save'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEdit}>
                          <X className="h-3 w-3 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-sm font-medium">{setting.key}</p>
                        <p className="text-sm mt-0.5 break-all">{setting.value}</p>
                        {setting.description && (
                          <p className="text-xs text-muted-foreground mt-1">{setting.description}</p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(setting)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => setDeleteKey(setting.key)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      <AlertDialog open={!!deleteKey} onOpenChange={() => setDeleteKey(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete System Setting</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the setting &ldquo;{deleteKey}&rdquo;. Features depending on it may stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={deleteSetting}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
