'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function CertificateVerifyPage() {
  const router = useRouter();
  const [value, setValue] = useState('');

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
          <h1 className="text-2xl font-semibold tracking-tight">Verify a certificate</h1>
          <p className="text-sm text-muted-foreground">
            Enter the certificate ID to view verified details.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="xxxx-xxxx-xxxx-xxxx"
            className="text-center tracking-widest uppercase"
            aria-label="Certificate ID"
          />
          <Button type="submit" variant="primary" className="w-full">
            Verify
          </Button>
        </form>
      </div>
    </div>
  );
}
