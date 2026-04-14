'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/src/i18n/i18n-provider';

export default function RecordVerifyPage() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const { messages } = useI18n();
  const copy = messages.record.verify;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return;
    router.push(`/record/${trimmed}`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
          <p className="text-sm text-muted-foreground">{copy.subtitle}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="xxxx-xxxx-xxxx-xxxx"
            className="text-center uppercase"
            aria-label={copy.label}
          />
          <Button type="submit" variant="primary" className="w-full">
            {copy.submit}
          </Button>
        </form>
      </div>
    </div>
  );
}
