'use client';

import { ApiKeyManager } from './api-key-manager';

export default function ApiKeysPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">API Keys</h1>
        <p className="text-muted-foreground">Manage API keys for client integrations.</p>
      </div>
      <ApiKeyManager />
    </div>
  );
}
