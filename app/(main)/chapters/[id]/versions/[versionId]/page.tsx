'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, FileText, Clock, Layers, Download, Info, Sparkles, Languages, Sliders, Wand2, RefreshCw, SearchCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ReferenceManager, type ReferenceItem } from '@/components/thesis/reference-manager';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ExpandableTextarea } from '@/components/expandable-textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ContextSelector } from '@/components/thesis/context-selector';

type ChapterVersion = {
  id: string;
  chapterId: string;
  versionNumber: number;
  filePath: string;
  pages: number | null;
  chunksCount: number | null;
  createdByOperation: string;
  metadata: any;
  createdAt: string;
  parentVersionId: string | null;
  isCurrent: boolean;
  chapterTitle?: string;
  chapterOrder?: number;
  thesisTitle?: string;
  thesisId?: string;
};

export default function ChapterVersionPage() {
  const params = useParams();
  const router = useRouter();
  const chapterId = params.id as string;
  const versionId = params.versionId as string;

  const [version, setVersion] = useState<ChapterVersion | null>(null);
  const [allVersions, setAllVersions] = useState<ChapterVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [allChapters, setAllChapters] = useState<any[]>([]);
  const [contextVersionIds, setContextVersionIds] = useState<string[]>([]);

  // Operation states
  const [improveDialogOpen, setImproveDialogOpen] = useState(false);
  const [translateDialogOpen, setTranslateDialogOpen] = useState(false);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [adaptDialogOpen, setAdaptDialogOpen] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [revisarDialogOpen, setRevisarDialogOpen] = useState(false);
  const [revisarAtualizarNormas, setRevisarAtualizarNormas] = useState(false);
  const [revisarLoading, setRevisarLoading] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState<string>('');
  const [processing, setProcessing] = useState(false);

  // References
  const [improveReferences, setImproveReferences] = useState<ReferenceItem[]>([]);
  const [translateReferences, setTranslateReferences] = useState<ReferenceItem[]>([]);
  const [adjustReferences, setAdjustReferences] = useState<ReferenceItem[]>([]);
  const [adaptReferences, setAdaptReferences] = useState<ReferenceItem[]>([]);
  const [updateReferences, setUpdateReferences] = useState<ReferenceItem[]>([]);

  // Prompts for operations
  const [adjustPrompt, setAdjustPrompt] = useState('');
  const [adjustCreativity, setAdjustCreativity] = useState(5);
  const [adjustUseGrounding, setAdjustUseGrounding] = useState(false);
  // Fixed to Gemini 2.5 Flash
  const adjustProvider = 'gemini' as const;
  const adjustModel = 'gemini-2.5-flash' as const;
  const [adaptPrompt, setAdaptPrompt] = useState('');
  const [adaptStyle, setAdaptStyle] = useState<'academic' | 'professional' | 'simplified' | 'custom'>('simplified');
  const [adaptTargetAudience, setAdaptTargetAudience] = useState('');
  const [updatePrompt, setUpdatePrompt] = useState('');

  const loadVersionData = async () => {
    try {
      setLoading(true);

      // Load all versions to get context
      const versionsRes = await fetch(`/api/chapters/${chapterId}/versions`);
      if (!versionsRes.ok) {
        throw new Error('Falha ao carregar versões');
      }
      const versionsData = await versionsRes.json();
      setAllVersions(versionsData.versions || []);

      // Find the specific version
      const foundVersion = versionsData.versions?.find((v: any) => v.id === versionId);
      if (!foundVersion) {
        toast.error('Versão não encontrada');
        router.push(`/chapters/${chapterId}`);
        return;
      }

      // Load chapter info for context
      const chapterRes = await fetch(`/api/chapters/${chapterId}`);
      if (chapterRes.ok) {
        const chapterData = await chapterRes.json();
        foundVersion.chapterTitle = chapterData.chapter.title;
        foundVersion.chapterOrder = chapterData.chapter.chapterOrder;
        foundVersion.thesisTitle = chapterData.chapter.thesisTitle;
        foundVersion.thesisId = chapterData.chapter.thesisId;

        // Load all chapters from thesis for context selection
        if (chapterData.chapter.thesisId) {
          const thesisRes = await fetch(`/api/theses/${chapterData.chapter.thesisId}`);
          if (thesisRes.ok) {
            const thesisData = await thesisRes.json();
            const chaptersWithVersions = await Promise.all(
              (thesisData.chapters || []).map(async (ch: any) => {
                const vRes = await fetch(`/api/chapters/${ch.id}/versions`);
                if (vRes.ok) {
                  const vData = await vRes.json();
                  return {
                    id: ch.id,
                    title: ch.title,
                    chapterOrder: ch.chapterOrder,
                    versions: vData.versions || []
                  };
                }
                return null;
              })
            );
            setAllChapters(chaptersWithVersions.filter(Boolean));
          }
        }
      }

      setVersion(foundVersion);

      console.log('[VERSION-PAGE] Loaded version:', foundVersion.versionNumber);
    } catch (error: any) {
      console.error('[VERSION-PAGE] Error loading version:', error);
      toast.error(error.message || 'Erro ao carregar versão');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVersionData();
  }, [chapterId, versionId]);

  const handleDownload = async () => {
    try {
      toast.info('Iniciando download...');

      const response = await fetch(`/api/chapters/${chapterId}/versions/${versionId}/download`);

      if (!response.ok) {
        throw new Error('Falha ao fazer download');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `capitulo_v${version?.versionNumber}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Download concluído!');
    } catch (error: any) {
      console.error('[DOWNLOAD] Error:', error);
      toast.error(error.message || 'Erro ao fazer download');
    }
  };

  const handleImprove = async () => {
    try {
      setProcessing(true);
      toast.info('Iniciando análise de melhorias...');

      // Convert ReferenceItem to API format
      const referencesForAPI = improveReferences.map(ref => ({
        type: ref.type,
        title: ref.title,
        description: ref.description,
        url: ref.url,
        filePath: ref.filePath,
        fileName: ref.fileName,
        fileSize: ref.fileSize,
        mimeType: ref.mimeType,
      }));

      const response = await fetch(`/api/chapters/${chapterId}/improve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          versionId,
          references: referencesForAPI,
          contextVersionIds
        })
      });

      if (!response.ok) {
        throw new Error('Falha ao iniciar análise');
      }

      const data = await response.json();
      setImproveDialogOpen(false);

      // Redirecionar para a página de melhorias
      router.push(`/chapters/${chapterId}/improvements/${data.jobId}`);

    } catch (error: any) {
      console.error('[IMPROVE] Error:', error);
      toast.error(error.message || 'Erro ao iniciar análise');
      setProcessing(false);
    }
  };

  const handleTranslate = async () => {
    if (!targetLanguage) {
      toast.error('Selecione o idioma de destino');
      return;
    }

    try {
      setProcessing(true);
      toast.info('Iniciando tradução...');

      // Convert ReferenceItem to API format
      const referencesForAPI = translateReferences.map(ref => ({
        type: ref.type,
        title: ref.title,
        description: ref.description,
        url: ref.url,
        filePath: ref.filePath,
        fileName: ref.fileName,
        fileSize: ref.fileSize,
        mimeType: ref.mimeType,
      }));

      const response = await fetch(`/api/chapters/${chapterId}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          versionId,
          targetLanguage,
          references: referencesForAPI
        })
      });

      if (!response.ok) {
        throw new Error('Falha ao iniciar tradução');
      }

      const data = await response.json();
      setTranslateDialogOpen(false);

      // Redirecionar para a página de tradução
      router.push(`/chapters/${chapterId}/translate/${data.jobId}`);

    } catch (error: any) {
      console.error('[TRANSLATE] Error:', error);
      toast.error(error.message || 'Erro ao iniciar tradução');
      setProcessing(false);
    }
  };

  const handleAdjust = async () => {
    if (!adjustPrompt.trim()) {
      toast.error('Por favor, descreva o ajuste que deseja realizar');
      return;
    }

    try {
      setProcessing(true);
      toast.info('Iniciando ajuste...');

      const referencesForAPI = adjustReferences.map(ref => ({
        type: ref.type,
        title: ref.title,
        description: ref.description,
        url: ref.url,
        filePath: ref.filePath,
        fileName: ref.fileName,
        fileSize: ref.fileSize,
        mimeType: ref.mimeType,
      }));

      const response = await fetch(`/api/chapters/${chapterId}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          versionId,
          instructions: adjustPrompt.trim(),
          creativity: adjustCreativity,
          provider: adjustProvider,
          model: adjustModel,
          useGrounding: adjustUseGrounding,
          references: referencesForAPI,
          contextVersionIds
        })
      });

      if (!response.ok) {
        throw new Error('Falha ao iniciar ajuste');
      }

      const data = await response.json();
      setAdjustDialogOpen(false);

      // Redirecionar para a página de ajuste
      router.push(`/chapters/${chapterId}/adjust/${data.jobId}`);

    } catch (error: any) {
      console.error('[ADJUST] Error:', error);
      toast.error(error.message || 'Erro ao iniciar ajuste');
      setProcessing(false);
    }
  };

  const handleAdapt = async () => {
    // Validação para custom style
    if (adaptStyle === 'custom' && !adaptTargetAudience.trim()) {
      toast.error('Por favor, especifique o público-alvo para o estilo personalizado');
      return;
    }

    try {
      setProcessing(true);
      toast.info('Iniciando adaptação...');

      const referencesForAPI = adaptReferences.map(ref => ({
        type: ref.type,
        title: ref.title,
        description: ref.description,
        url: ref.url,
        filePath: ref.filePath,
        fileName: ref.fileName,
        fileSize: ref.fileSize,
        mimeType: ref.mimeType,
      }));

      const response = await fetch(`/api/chapters/${chapterId}/adapt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          versionId,
          style: adaptStyle,
          targetAudience: adaptStyle === 'custom' ? adaptTargetAudience.trim() : undefined,
          references: referencesForAPI,
          contextVersionIds
        })
      });

      if (!response.ok) {
        throw new Error('Falha ao iniciar adaptação');
      }

      const data = await response.json();
      setAdaptDialogOpen(false);

      // Redirecionar para a página de adaptação
      router.push(`/chapters/${chapterId}/adapt/${data.jobId}`);

    } catch (error: any) {
      console.error('[ADAPT] Error:', error);
      toast.error(error.message || 'Erro ao iniciar adaptação');
      setProcessing(false);
    }
  };

  const handleUpdate = async () => {
    // Update operation uses references to update content
    // References are optional but recommended
    if (updateReferences.length === 0) {
      toast.warning('Nenhuma referência adicionada. Recomenda-se adicionar materiais de referência para atualização.');
    }

    try {
      setProcessing(true);
      toast.info('Iniciando atualização...');

      const referencesForAPI = updateReferences.map(ref => ({
        type: ref.type,
        title: ref.title,
        description: ref.description,
        url: ref.url,
        filePath: ref.filePath,
        fileName: ref.fileName,
        fileSize: ref.fileSize,
        mimeType: ref.mimeType,
      }));

      const response = await fetch(`/api/chapters/${chapterId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          versionId,
          references: referencesForAPI,
          contextVersionIds
        })
      });

      if (!response.ok) {
        throw new Error('Falha ao iniciar atualização');
      }

      const data = await response.json();
      setUpdateDialogOpen(false);

      // Redirecionar para a página de atualização
      router.push(`/chapters/${chapterId}/update/${data.jobId}`);

    } catch (error: any) {
      console.error('[UPDATE] Error:', error);
      toast.error(error.message || 'Erro ao iniciar atualização');
      setProcessing(false);
    }
  };

  const handleRevisar = async () => {
    if (!revisarAtualizarNormas) {
      toast.info('Marque pelo menos uma opção de revisão (ex.: Atualizar normas)');
      return;
    }
    try {
      setRevisarLoading(true);
      toast.loading('Iniciando análise de normas...');
      const res = await fetch(`/api/chapters/${chapterId}/versions/${versionId}/norms-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'gemini', model: 'gemini-2.5-flash' })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao iniciar análise de normas');
      }
      const data = await res.json();
      setRevisarDialogOpen(false);
      toast.dismiss();
      toast.success('Análise de normas iniciada!');
      router.push(`/norms-update/${data.jobId}`);
    } catch (error: any) {
      toast.dismiss();
      toast.error(error.message || 'Erro ao iniciar revisão');
    } finally {
      setRevisarLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-red-500/20 border-t-red-500 rounded-full animate-spin"></div>
        </div>
        <p className="text-gray-400 mt-6 text-sm">Carregando versão...</p>
      </div>
    );
  }

  if (!version) {
    return null;
  }

  const getOperationColor = (operation: string) => {
    switch (operation) {
      case 'upload': return 'bg-blue-500';
      case 'improve': return 'bg-green-500';
      case 'translate': return 'bg-purple-500';
      case 'adjust': return 'bg-orange-500';
      case 'adapt': return 'bg-pink-500';
      case 'update': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getOperationLabel = (operation: string) => {
    switch (operation) {
      case 'upload': return 'Upload Original';
      case 'improve': return 'Melhorado';
      case 'translate': return 'Traduzido';
      case 'adjust': return 'Ajustado';
      case 'adapt': return 'Adaptado';
      case 'update': return 'Atualizado';
      default: return operation;
    }
  };

  const parentVersion = version.parentVersionId
    ? allVersions.find((v) => v.id === version.parentVersionId)
    : null;

  const childVersions = allVersions.filter((v) => v.parentVersionId === version.id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/chapters/${chapterId}`)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para Capítulo
        </Button>
      </div>

      {/* Version Info */}
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Layers className="h-8 w-8 text-primary" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold">Versão {version.versionNumber}</h1>
                {version.isCurrent && (
                  <Badge variant="default" className="bg-red-600">
                    Versão Atual
                  </Badge>
                )}
              </div>
              {version.chapterTitle && (
                <p className="text-sm text-muted-foreground mt-1">
                  <FileText className="h-3 w-3 inline mr-1" />
                  Capítulo {version.chapterOrder}: {version.chapterTitle}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Main Card */}
        <Card className="bg-gradient-to-br from-white/[0.07] to-white/[0.02] backdrop-blur-xl border-white/10">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              Detalhes da Versão
            </CardTitle>
            <CardDescription>
              Criada em{' '}
              {new Date(version.createdAt).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Operation Badge */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Criada por:</span>
              <Badge className={getOperationColor(version.createdByOperation)}>
                {getOperationLabel(version.createdByOperation)}
              </Badge>
            </div>

            {/* Stats */}
            {version.pages && (
              <div className="flex flex-col gap-1">
                <span className="text-sm text-muted-foreground">Páginas</span>
                <span className="text-2xl font-bold">{version.pages}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Version Lineage */}
        {(parentVersion || childVersions.length > 0) && (
          <Card className="bg-gradient-to-br from-white/[0.07] to-white/[0.02] backdrop-blur-xl border-white/10">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Linhagem de Versões
              </CardTitle>
              <CardDescription>
                Histórico de derivação desta versão
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Parent Version */}
              {parentVersion && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Derivada de:</p>
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <Layers className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            Versão {parentVersion.versionNumber}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-xs ${getOperationColor(parentVersion.createdByOperation)} text-white border-0`}
                          >
                            {getOperationLabel(parentVersion.createdByOperation)}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(parentVersion.createdAt).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => router.push(`/chapters/${chapterId}/versions/${parentVersion.id}`)}
                    >
                      Ver
                    </Button>
                  </div>
                </div>
              )}

              {/* Child Versions */}
              {childVersions.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Versões derivadas desta ({childVersions.length}):
                  </p>
                  <div className="space-y-2">
                    {childVersions.map((child) => (
                      <div
                        key={child.id}
                        className="flex items-center justify-between p-3 bg-muted rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Layers className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                Versão {child.versionNumber}
                              </span>
                              {child.isCurrent && (
                                <Badge variant="default" className="text-xs">
                                  Atual
                                </Badge>
                              )}
                              <Badge
                                variant="outline"
                                className={`text-xs ${getOperationColor(child.createdByOperation)} text-white border-0`}
                              >
                                {getOperationLabel(child.createdByOperation)}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(child.createdAt).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => router.push(`/chapters/${chapterId}/versions/${child.id}`)}
                        >
                          Ver
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Actions Card */}
        <Card className="bg-gradient-to-br from-white/[0.07] to-white/[0.02] backdrop-blur-xl border-white/10">
          <CardHeader>
            <CardTitle className="text-lg">Ações</CardTitle>
            <CardDescription>
              Fazer download ou aplicar transformações nesta versão
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Download Button */}
            <Button
              onClick={handleDownload}
              variant="outline"
              className="w-full justify-start"
            >
              <Download className="h-4 w-4 mr-2" />
              Fazer Download
            </Button>

            {/* Improve Dialog */}
            <Dialog open={improveDialogOpen} onOpenChange={setImproveDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Melhorar Texto
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh]">
                <DialogHeader>
                  <DialogTitle>Melhorar Capítulo</DialogTitle>
                  <DialogDescription>
                    Analisar o capítulo para identificar oportunidades de melhoria. Uma nova versão será criada.
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] pr-4">
                  <div className="space-y-4 py-4">
                    {allChapters.length > 0 && (
                      <ContextSelector
                        chapters={allChapters}
                        currentChapterId={chapterId}
                        selectedVersionIds={contextVersionIds}
                        onSelectionChange={setContextVersionIds}
                      />
                    )}
                    <div className="space-y-2">
                      <Label>Materiais de Referência (Opcional)</Label>
                      <p className="text-sm text-muted-foreground">
                        Adicione links ou arquivos para fornecer contexto adicional à análise
                      </p>
                    </div>
                    <ReferenceManager
                      references={improveReferences}
                      onChange={setImproveReferences}
                    />
                  </div>
                </ScrollArea>
                <DialogFooter>
                  <Button
                    variant="ghost"
                    onClick={() => setImproveDialogOpen(false)}
                    disabled={processing}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleImprove}
                    disabled={processing}
                  >
                    {processing ? 'Processando...' : 'Iniciar Análise'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Translate Dialog */}
            <Dialog open={translateDialogOpen} onOpenChange={setTranslateDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                >
                  <Languages className="h-4 w-4 mr-2" />
                  Traduzir
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh]">
                <DialogHeader>
                  <DialogTitle>Traduzir Capítulo</DialogTitle>
                  <DialogDescription>
                    Traduzir o capítulo para outro idioma. Uma nova versão será criada.
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] pr-4">
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="target-language">Idioma de Destino *</Label>
                      <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                        <SelectTrigger id="target-language">
                          <SelectValue placeholder="Selecione o idioma" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pt">Português</SelectItem>
                          <SelectItem value="en">Inglês</SelectItem>
                          <SelectItem value="es">Espanhol</SelectItem>
                          <SelectItem value="fr">Francês</SelectItem>
                          <SelectItem value="de">Alemão</SelectItem>
                          <SelectItem value="it">Italiano</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="border-t pt-4 space-y-2">
                      <Label>Materiais de Referência (Opcional)</Label>
                      <p className="text-sm text-muted-foreground">
                        Adicione links ou arquivos para fornecer contexto adicional à tradução
                      </p>
                      <ReferenceManager
                        references={translateReferences}
                        onChange={setTranslateReferences}
                      />
                    </div>
                  </div>
                </ScrollArea>
                <DialogFooter>
                  <Button
                    variant="ghost"
                    onClick={() => setTranslateDialogOpen(false)}
                    disabled={processing}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleTranslate}
                    disabled={processing || !targetLanguage}
                  >
                    {processing ? 'Processando...' : 'Iniciar Tradução'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Adjust Dialog */}
            <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                >
                  <Sliders className="h-4 w-4 mr-2" />
                  Ajustar
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh]">
                <DialogHeader>
                  <DialogTitle>Ajustar Capítulo</DialogTitle>
                  <DialogDescription>
                    Descreva especificamente o que deseja ajustar. Uma nova versão será criada.
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] pr-4">
                  <div className="space-y-4 py-4">
                    {allChapters.length > 0 && (
                      <ContextSelector
                        chapters={allChapters}
                        currentChapterId={chapterId}
                        selectedVersionIds={contextVersionIds}
                        onSelectionChange={setContextVersionIds}
                      />
                    )}
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Info className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-amber-900">Como funciona o Ajuste</p>
                          <p className="text-sm text-amber-700">
                            A IA irá fazer APENAS o que você pedir nas instruções abaixo. O nível de criatividade controla
                            <strong> como suas instruções são aplicadas</strong>, não se deve fazer melhorias extras.
                          </p>
                          <p className="text-sm text-amber-700 mt-1">
                            Se você NÃO pedir para melhorar clareza/gramática/estilo, a IA NÃO fará isso automaticamente.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="adjust-prompt">Instruções de Ajuste *</Label>
                      <p className="text-sm text-muted-foreground">
                        Seja específico sobre o que deseja ajustar (ex: "adicionar exemplos práticos", "remover jargão técnico", "expandir a seção de conclusão")
                      </p>
                      <ExpandableTextarea
                        id="adjust-prompt"
                        placeholder="Ex: Melhorar a clareza da introdução, adicionar mais exemplos práticos, revisar argumentação do capítulo 2..."
                        value={adjustPrompt}
                        onChange={setAdjustPrompt}
                        disabled={processing}
                        minRows={4}
                        maxRows={20}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="creativity-slider">
                        Nível de Criatividade: {adjustCreativity}/10
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {adjustCreativity < 3
                          ? 'Conservador - Aplica suas instruções mantendo o mais próximo possível do original'
                          : adjustCreativity < 7
                          ? 'Moderado - Aplica suas instruções com alguma flexibilidade na reformulação'
                          : 'Criativo - Aplica suas instruções com liberdade para reformular, mas SÓ faz o que você pediu'}
                      </p>
                      <input
                        id="creativity-slider"
                        type="range"
                        min="0"
                        max="10"
                        value={adjustCreativity}
                        onChange={(e) => setAdjustCreativity(parseInt(e.target.value))}
                        disabled={processing}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>0 - Conservador</span>
                        <span>5 - Moderado</span>
                        <span>10 - Criativo</span>
                      </div>
                    </div>

                    <div className="border-t pt-4 space-y-4">
                      <div className="flex items-start space-x-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <Checkbox
                          id="adjust-grounding"
                          checked={adjustUseGrounding}
                          onCheckedChange={(checked) => {
                            setAdjustUseGrounding(checked as boolean);
                          }}
                        />
                        <div className="space-y-1 flex-1">
                          <Label
                            htmlFor="adjust-grounding"
                            className="text-sm font-medium text-blue-900 cursor-pointer"
                          >
                            Usar pesquisa na internet (Google Search Grounding)
                          </Label>
                          <p className="text-xs text-blue-700">
                            A IA usará o Google Gemini 2.5 Flash para analisar o documento e poderá pesquisar informações atualizadas na internet para aplicar suas instruções com mais precisão.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-4 space-y-2">
                      <Label>Materiais de Referência (Opcional)</Label>
                      <p className="text-sm text-muted-foreground">
                        Adicione links ou arquivos para fornecer contexto adicional
                      </p>
                      <ReferenceManager
                        references={adjustReferences}
                        onChange={setAdjustReferences}
                      />
                    </div>
                  </div>
                </ScrollArea>
                <DialogFooter>
                  <Button
                    variant="ghost"
                    onClick={() => setAdjustDialogOpen(false)}
                    disabled={processing}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleAdjust}
                    disabled={processing || !adjustPrompt.trim()}
                  >
                    {processing ? 'Processando...' : 'Iniciar Ajuste'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Adapt Dialog */}
            <Dialog open={adaptDialogOpen} onOpenChange={setAdaptDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                >
                  <Wand2 className="h-4 w-4 mr-2" />
                  Adaptar
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh]">
                <DialogHeader>
                  <DialogTitle>Adaptar Capítulo</DialogTitle>
                  <DialogDescription>
                    Adapte o capítulo para um estilo ou público-alvo diferente. Uma nova versão será criada.
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] pr-4">
                  <div className="space-y-4 py-4">
                    {allChapters.length > 0 && (
                      <ContextSelector
                        chapters={allChapters}
                        currentChapterId={chapterId}
                        selectedVersionIds={contextVersionIds}
                        onSelectionChange={setContextVersionIds}
                      />
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="adapt-style">Estilo de Adaptação *</Label>
                      <p className="text-sm text-muted-foreground">
                        Escolha como deseja adaptar o ton e estilo do capítulo
                      </p>
                      <Select value={adaptStyle} onValueChange={(value: any) => setAdaptStyle(value)}>
                        <SelectTrigger id="adapt-style">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="academic">Acadêmico - Mais formal e técnico</SelectItem>
                          <SelectItem value="professional">Profissional - Direto e objetivo</SelectItem>
                          <SelectItem value="simplified">Simplificado - Mais acessível e claro</SelectItem>
                          <SelectItem value="custom">Personalizado - Especificar público-alvo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {adaptStyle === 'custom' && (
                      <div className="space-y-2">
                        <Label htmlFor="target-audience">Público-Alvo *</Label>
                        <p className="text-sm text-muted-foreground">
                          Descreva o público-alvo para adaptação personalizada
                        </p>
                        <input
                          id="target-audience"
                          type="text"
                          placeholder="Ex: Estudantes de graduação, profissionais da área, público geral..."
                          value={adaptTargetAudience}
                          onChange={(e) => setAdaptTargetAudience(e.target.value)}
                          disabled={processing}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      </div>
                    )}

                    <div className="border-t pt-4 space-y-2">
                      <Label>Materiais de Referência (Opcional)</Label>
                      <p className="text-sm text-muted-foreground">
                        Adicione exemplos do estilo ou formato desejado
                      </p>
                      <ReferenceManager
                        references={adaptReferences}
                        onChange={setAdaptReferences}
                      />
                    </div>
                  </div>
                </ScrollArea>
                <DialogFooter>
                  <Button
                    variant="ghost"
                    onClick={() => setAdaptDialogOpen(false)}
                    disabled={processing}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleAdapt}
                    disabled={processing || (adaptStyle === 'custom' && !adaptTargetAudience.trim())}
                  >
                    {processing ? 'Processando...' : 'Iniciar Adaptação'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Revisar (opção Atualizar normas - igual a documentos) */}
            <Dialog open={revisarDialogOpen} onOpenChange={setRevisarDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                >
                  <SearchCheck className="h-4 w-4 mr-2" />
                  Revisar
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <SearchCheck className="h-5 w-5" />
                    Revisar Capítulo
                  </DialogTitle>
                  <DialogDescription>
                    Escolha as opções de revisão antes de considerar a versão final. Igual ao fluxo em documentos.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="flex items-start space-x-3 p-3 rounded-lg border bg-muted/50">
                    <Checkbox
                      id="revisar-normas"
                      checked={revisarAtualizarNormas}
                      onCheckedChange={(c) => setRevisarAtualizarNormas(!!c)}
                    />
                    <div className="space-y-1 flex-1">
                      <Label htmlFor="revisar-normas" className="text-sm font-medium cursor-pointer">
                        Atualizar normas
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Verificar se leis e normas citadas seguem vigentes (LexML/Senado + IA). Pode aplicar alterações aprovadas e criar nova versão.
                      </p>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setRevisarDialogOpen(false)} disabled={revisarLoading}>
                    Cancelar
                  </Button>
                  <Button onClick={handleRevisar} disabled={revisarLoading || !revisarAtualizarNormas}>
                    {revisarLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Iniciando...
                      </>
                    ) : (
                      'Iniciar revisão'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Update Dialog */}
            <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Atualizar
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh]">
                <DialogHeader>
                  <DialogTitle>Atualizar Capítulo</DialogTitle>
                  <DialogDescription>
                    Atualize o capítulo com base em materiais de referência (links, arquivos, documentos). Uma nova versão será criada.
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] pr-4">
                  <div className="space-y-4 py-4">
                    {allChapters.length > 0 && (
                      <ContextSelector
                        chapters={allChapters}
                        currentChapterId={chapterId}
                        selectedVersionIds={contextVersionIds}
                        onSelectionChange={setContextVersionIds}
                      />
                    )}
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-blue-900">Como funciona a atualização</p>
                          <p className="text-sm text-blue-700">
                            A IA analisará o capítulo atual e os materiais de referência fornecidos,
                            identificando informações desatualizadas, novos dados ou melhorias baseadas nas referências.
                          </p>
                          <p className="text-sm text-blue-700 mt-2">
                            Recomenda-se adicionar pelo menos um material de referência para melhores resultados.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Materiais de Referência</Label>
                      <p className="text-sm text-muted-foreground">
                        Adicione links, arquivos ou documentos com as informações atualizadas
                      </p>
                      <ReferenceManager
                        references={updateReferences}
                        onChange={setUpdateReferences}
                      />
                    </div>
                  </div>
                </ScrollArea>
                <DialogFooter>
                  <Button
                    variant="ghost"
                    onClick={() => setUpdateDialogOpen(false)}
                    disabled={processing}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleUpdate}
                    disabled={processing}
                  >
                    {processing ? 'Processando...' : 'Iniciar Atualização'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
