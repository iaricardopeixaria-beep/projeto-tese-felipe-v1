'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getAIErrorMessage } from '@/lib/ai-error-message';
import { PipelineOperation, OPERATION_METADATA } from '@/lib/pipeline/types';
import {
  PIPELINE_OPERATIONS,
  OperationStepContent,
  validateConfig,
  buildNormalizedConfigs
} from '@/components/pipeline-operation-forms';

function initialConfigForOperation(op: PipelineOperation): Record<string, unknown> {
  if (op === 'adapt') return { style: 'simplified' };
  return {};
}

type DocumentActionsCardProps = {
  documentId: string;
  documentTitle: string;
};

export function DocumentActionsCard({ documentId, documentTitle }: DocumentActionsCardProps) {
  const router = useRouter();
  const [openOp, setOpenOp] = useState<PipelineOperation | null>(null);
  const [configsByOp, setConfigsByOp] = useState<Partial<Record<PipelineOperation, any>>>({});
  const [startingOp, setStartingOp] = useState<PipelineOperation | null>(null);
  const [downloading, setDownloading] = useState(false);

  const openDialog = (op: PipelineOperation) => {
    setConfigsByOp((prev) => ({ ...prev, [op]: initialConfigForOperation(op) }));
    setOpenOp(op);
  };

  const patchConfig = useCallback((op: PipelineOperation, key: string, value: any) => {
    setConfigsByOp((prev) => ({
      ...prev,
      [op]: { ...(prev[op] || {}), [key]: value }
    }));
  }, []);

  const handleDownload = async () => {
    setDownloading(true);
    toast.info('Iniciando download...');
    try {
      const res = await fetch(`/api/documents/${documentId}/download`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Falha ao fazer download');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      const cd = res.headers.get('Content-Disposition');
      const match = cd?.match(/filename="([^"]+)"/);
      a.download = match?.[1] || `${documentTitle.replace(/\s+/g, '_')}.docx`;
      window.document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      window.document.body.removeChild(a);
      toast.success('Download concluído!');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao baixar');
    } finally {
      setDownloading(false);
    }
  };

  const handleStartSingle = async (op: PipelineOperation) => {
    const config = configsByOp[op];
    if (!validateConfig(op, config)) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    try {
      setStartingOp(op);
      const normalizedConfigs = buildNormalizedConfigs([op], { [op]: config } as any);
      const res = await fetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          operations: [op],
          configs: normalizedConfigs
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao iniciar');
      }
      const data = await res.json();
      toast.success('Processamento iniciado!');
      setOpenOp(null);
      router.push(`/pipeline/${data.jobId}`);
    } catch (e: any) {
      toast.error(getAIErrorMessage(e, 'Falha ao iniciar processamento'));
    } finally {
      setStartingOp(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ações</CardTitle>
          <CardDescription>
            Fazer download ou aplicar transformações neste documento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin shrink-0" />
            ) : (
              <Download className="h-4 w-4 mr-2 shrink-0" />
            )}
            Fazer download
          </Button>
          {PIPELINE_OPERATIONS.map((op) => {
            const meta = OPERATION_METADATA[op];
            return (
              <Button
                key={op}
                variant="outline"
                className="w-full justify-start"
                onClick={() => openDialog(op)}
              >
                <span className="mr-2 shrink-0">{meta.icon}</span>
                {meta.name}
              </Button>
            );
          })}
        </CardContent>
      </Card>

      {PIPELINE_OPERATIONS.map((op) => {
        const meta = OPERATION_METADATA[op];
        const starting = startingOp === op;
        return (
          <Dialog
            key={op}
            open={openOp === op}
            onOpenChange={(v) => {
              if (!v) setOpenOp(null);
            }}
          >
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl">
                  {meta.icon} {meta.name}
                </DialogTitle>
                <DialogDescription>{meta.description}</DialogDescription>
              </DialogHeader>
              <OperationStepContent
                operation={op}
                config={configsByOp[op]}
                onConfigChange={(key, value) => patchConfig(op, key, value)}
              />
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpenOp(null)} disabled={!!startingOp}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => handleStartSingle(op)}
                  disabled={!!startingOp}
                  className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white"
                >
                  {starting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Iniciando...
                    </>
                  ) : (
                    'Iniciar'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })}
    </>
  );
}
