'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Download,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  Pause,
  Play,
  X
} from 'lucide-react';
import Link from 'next/link';
import { PipelineJob, PipelineIntermediateDocument, OPERATION_METADATA } from '@/lib/pipeline/types';

export default function PipelinePage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;

  const [job, setJob] = useState<PipelineJob | null>(null);
  const [intermediateDocuments, setIntermediateDocuments] = useState<PipelineIntermediateDocument[]>([]);
  const [currentOperationProgress, setCurrentOperationProgress] = useState<{ percentage: number; message?: string } | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const loadPipelineStatus = async () => {
    try {
      const res = await fetch(`/api/pipeline/${jobId}`);
      if (!res.ok) {
        throw new Error('Pipeline não encontrado');
      }

      const data = await res.json();
      setJob(data.job);
      setIntermediateDocuments(data.intermediateDocuments || []);
      setCurrentOperationProgress(data.currentOperationProgress);

    } catch (error: any) {
      console.error('Error loading pipeline:', error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPipelineStatus();

    // Poll for updates every 2 seconds if running
    const interval = setInterval(() => {
      if (job?.status === 'running') {
        loadPipelineStatus();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [jobId, job?.status]);

  const handlePause = async () => {
    try {
      setActionLoading(true);
      const res = await fetch(`/api/pipeline/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pause' })
      });

      if (!res.ok) throw new Error('Falha ao pausar');
      toast.success('Pipeline pausado');
      loadPipelineStatus();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    try {
      setActionLoading(true);
      const res = await fetch(`/api/pipeline/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resume' })
      });

      if (!res.ok) throw new Error('Falha ao retomar');
      toast.success('Pipeline retomado');
      loadPipelineStatus();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Tem certeza que deseja cancelar o pipeline?')) return;

    try {
      setActionLoading(true);
      const res = await fetch(`/api/pipeline/${jobId}`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error('Falha ao cancelar');
      toast.success('Pipeline cancelado');
      loadPipelineStatus();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownload = async (type: 'final' | 'intermediate', index?: number) => {
    try {
      const url = type === 'final'
        ? `/api/pipeline/${jobId}/download?type=final`
        : `/api/pipeline/${jobId}/download?type=intermediate&index=${index}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error('Falha ao baixar');

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `pipeline_${type}_${jobId}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);

      toast.success('Download iniciado!');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-red-500" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 mb-4">Pipeline não encontrado</p>
        <Button onClick={() => router.push('/')}>Voltar</Button>
      </div>
    );
  }

  const currentOp = job.selected_operations[job.current_operation_index];
  
  // Calculate overall progress considering sub-operation progress
  const calculateOverallProgress = () => {
    if (job.selected_operations.length === 0) return 0;
    
    // Base progress: completed operations
    const completedOpsProgress = (job.current_operation_index / job.selected_operations.length) * 100;
    
    // If there's a current operation with progress, add its contribution
    if (job.status === 'running' && currentOperationProgress) {
      const currentOpProgress = (currentOperationProgress.percentage || 0) / job.selected_operations.length;
      return Math.min(Math.round(completedOpsProgress + currentOpProgress), 100);
    }
    
    return Math.round(completedOpsProgress);
  };
  
  const overallProgress = calculateOverallProgress();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Pipeline em Execução</h1>
            <p className="text-gray-400 mt-1">
              Job ID: {jobId.substring(0, 8)}...
            </p>
          </div>
        </div>

        <StatusBadge status={job.status} />
      </div>

      {/* Progress Overview */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Progresso Geral</span>
              <span className="text-sm text-gray-400">{overallProgress}%</span>
            </div>
            <Progress value={overallProgress} className="h-2" />

            {/* Timeline */}
            <div className="flex items-center justify-between pt-4">
              {job.selected_operations.map((op, idx) => {
                const metadata = OPERATION_METADATA[op];
                const isCompleted = idx < job.current_operation_index;
                const isCurrent = idx === job.current_operation_index && job.status === 'running';
                const isPending = idx > job.current_operation_index;

                return (
                  <div key={op} className="flex flex-col items-center">
                    <div
                      className={`
                        w-12 h-12 rounded-full flex items-center justify-center text-2xl
                        ${isCompleted ? 'bg-green-500/20 border-2 border-green-500' : ''}
                        ${isCurrent ? 'bg-blue-500/20 border-2 border-blue-500 animate-pulse' : ''}
                        ${isPending ? 'bg-gray-500/20 border-2 border-gray-500' : ''}
                      `}
                    >
                      {metadata.icon}
                    </div>
                    <p className="text-xs mt-2 text-center">{metadata.name}</p>
                    {isCompleted && <CheckCircle2 className="h-4 w-4 text-green-500 mt-1" />}
                    {isCurrent && <Loader2 className="h-4 w-4 text-blue-500 mt-1 animate-spin" />}
                    {isPending && <Clock className="h-4 w-4 text-gray-500 mt-1" />}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      {(job.status === 'running' || job.status === 'paused' || job.status === 'awaiting_approval') && (
        <div className="flex gap-2">
          {job.status === 'awaiting_approval' && (
            <Button
              className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white"
              onClick={() => {
                const currentOp = job.selected_operations[job.current_operation_index];
                const opResult = job.operation_results[job.current_operation_index];
                if (opResult?.operationJobId) {
                  // Map operation to correct URL path
                  const pathMap: Record<string, string> = {
                    improve: 'improvements',
                    update: 'norms-update',
                    translate: 'translations',
                    adjust: 'adjustments',
                    adapt: 'adaptations'
                  };
                  const path = pathMap[currentOp] || currentOp;
                  router.push(`/${path}/${opResult.operationJobId}?pipeline=${jobId}`);
                }
              }}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Revisar e Aprovar
            </Button>
          )}
          {job.status === 'running' && (
            <Button variant="outline" onClick={handlePause} disabled={actionLoading}>
              <Pause className="h-4 w-4 mr-2" />
              Pausar
            </Button>
          )}
          {job.status === 'paused' && (
            <Button variant="outline" onClick={handleResume} disabled={actionLoading}>
              <Play className="h-4 w-4 mr-2" />
              Retomar
            </Button>
          )}
          <Button variant="destructive" onClick={handleCancel} disabled={actionLoading}>
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
        </div>
      )}

      {/* Operations Details */}
      <div className="space-y-4">
        {job.operation_results.map((result, idx) => {
          const metadata = OPERATION_METADATA[result.operation];
          const intermediateDoc = intermediateDocuments.find(doc => doc.operation_index === idx);

          return (
            <Card key={idx}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">{metadata.icon}</span>
                  {metadata.name}
                  {result.status === 'completed' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                  {result.status === 'awaiting_approval' && <Clock className="h-5 w-5 text-orange-500" />}
                  {result.status === 'failed' && <XCircle className="h-5 w-5 text-red-500" />}
                </CardTitle>
                <CardDescription>
                  {result.status === 'completed' 
                    ? 'Concluído' 
                    : result.status === 'awaiting_approval'
                    ? 'Aguardando aprovação'
                    : 'Falhou'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {result.metadata.duration_seconds && (
                    <p>⏱️ Duração: {result.metadata.duration_seconds}s</p>
                  )}
                  {result.metadata.cost_usd && (
                    <p>💰 Custo: ${result.metadata.cost_usd.toFixed(4)}</p>
                  )}
                  {result.metadata.items_processed && (
                    <p>📊 Processados: {result.metadata.items_processed} itens</p>
                  )}
                  {result.metadata.error_message && (
                    <p className="text-red-500">❌ Erro: {result.metadata.error_message}</p>
                  )}
                </div>

                {result.status === 'awaiting_approval' && result.operationJobId && (
                  <Button
                    className="mt-4 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white"
                    onClick={() => {
                      const pathMap: Record<string, string> = {
                        improve: 'improvements',
                        update: 'norms-update',
                        translate: 'translations',
                        adjust: 'adjustments',
                        adapt: 'adaptations'
                      };
                      const path = pathMap[result.operation] || result.operation;
                      router.push(`/${path}/${result.operationJobId}?pipeline=${jobId}`);
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Revisar e Aprovar
                  </Button>
                )}
                {intermediateDoc && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => handleDownload('intermediate', idx)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Baixar Documento
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}

        {/* Current Operation (if running and not in results yet) */}
        {job.status === 'running' && currentOp && !job.operation_results.some(r => r.operationIndex === job.current_operation_index) && (
          <Card className="border-blue-500/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                <span className="text-2xl">{OPERATION_METADATA[currentOp].icon}</span>
                {OPERATION_METADATA[currentOp].name} (Em execução...)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-400 mb-3">
                Processando operação {job.current_operation_index + 1} de {job.selected_operations.length}
              </p>
              {currentOperationProgress && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Progresso da operação</span>
                    <span className="font-medium">{currentOperationProgress.percentage}%</span>
                  </div>
                  <Progress value={currentOperationProgress.percentage} className="h-2" />
                  {currentOperationProgress.message && (
                    <p className="text-xs text-gray-500">{currentOperationProgress.message}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Final Document Download */}
      {job.status === 'completed' && job.final_document_path && (
        <Card className="border-green-500/50 bg-green-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              Pipeline Concluído!
            </CardTitle>
            <CardDescription>
              Todas as operações foram executadas com sucesso
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {job.total_duration_seconds && (
                <p className="text-sm">⏱️ Tempo total: {Math.round(job.total_duration_seconds / 60)} minutos</p>
              )}
              {job.total_cost_usd > 0 && (
                <p className="text-sm">💰 Custo total: ${job.total_cost_usd.toFixed(4)}</p>
              )}

              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={() => handleDownload('final')}
              >
                <Download className="h-4 w-4 mr-2" />
                Baixar Documento Final
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {job.status === 'failed' && (
        <Card className="border-red-500/50 bg-red-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-500">
              <XCircle className="h-6 w-6" />
              Pipeline Falhou
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-400">
              {job.error_message || 'Erro desconhecido'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    pending: { color: 'bg-gray-500', label: 'Pendente' },
    running: { color: 'bg-blue-500 animate-pulse', label: 'Em Execução' },
    paused: { color: 'bg-yellow-500', label: 'Pausado' },
    awaiting_approval: { color: 'bg-orange-500 animate-pulse', label: '⏸️ Aguardando Aprovação' },
    applying_changes: { color: 'bg-purple-500 animate-pulse', label: '⚙️ Aplicando Mudanças' },
    completed: { color: 'bg-green-500', label: 'Concluído' },
    failed: { color: 'bg-red-500', label: 'Falhou' },
    cancelled: { color: 'bg-gray-500', label: 'Cancelado' }
  }[status] || { color: 'bg-gray-500', label: status };

  return (
    <Badge className={`${config.color} text-white px-4 py-2`}>
      {config.label}
    </Badge>
  );
}
