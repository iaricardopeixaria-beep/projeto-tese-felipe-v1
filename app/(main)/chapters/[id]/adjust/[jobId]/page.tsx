'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  Loader2,
  XCircle,
  ArrowLeft,
  Sliders
} from 'lucide-react';
import Link from 'next/link';
import { SuggestionReviewPanel, Suggestion } from '@/components/suggestion-review-panel';

type AdjustJob = {
  id: string;
  chapterId: string;
  versionId: string;
  operation: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  errorMessage?: string;
  newVersionId?: string;
  createdAt: string;
  completedAt?: string;
};

export default function ChapterAdjustPage() {
  const params = useParams();
  const router = useRouter();
  const chapterId = params.id as string;
  const jobId = params.jobId as string;

  const [job, setJob] = useState<AdjustJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [chapterTitle, setChapterTitle] = useState<string>('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [fullText, setFullText] = useState<string>('');

  useEffect(() => {
    loadJob();
    loadChapterInfo();

    const interval = setInterval(() => {
      if (job?.status === 'processing' || job?.status === 'pending') {
        loadJob();
      }
    }, 3000); // Poll every 3s while processing

    return () => clearInterval(interval);
  }, [jobId, job?.status]);

  const loadChapterInfo = async () => {
    try {
      const res = await fetch(`/api/chapters/${chapterId}`);
      if (res.ok) {
        const data = await res.json();
        setChapterTitle(data.chapter.title);
      }
    } catch (error) {
      console.error('Failed to load chapter:', error);
    }
  };

  const loadJob = async () => {
    try {
      const res = await fetch(`/api/chapters/${chapterId}/operations/${jobId}`);
      if (!res.ok) throw new Error('Job não encontrado');
      const data = await res.json();
      setJob(data.job);

      // If completed, load suggestions and full text
      if (data.job.status === 'completed') {
        await loadSuggestionsAndText();
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadSuggestionsAndText = async () => {
    try {
      const res = await fetch(`/api/chapters/${chapterId}/operations/${jobId}/suggestions`);
      if (!res.ok) throw new Error('Falha ao carregar sugestões');
      const data = await res.json();

      setSuggestions(data.suggestions || []);
      setFullText(data.fullText || '');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleApply = async (acceptedIds: string[]) => {
    toast.loading('Aplicando ajustes selecionados...');

    try {
      const res = await fetch(`/api/chapters/${chapterId}/operations/${jobId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acceptedSuggestionIds: acceptedIds })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Falha ao aplicar ajustes');
      }

      const data = await res.json();

      toast.dismiss();
      toast.success('Ajustes aplicados! Nova versão criada.');

      // Redirect to new version
      router.push(`/chapters/${chapterId}/versions/${data.newVersionId}`);
    } catch (error: any) {
      toast.dismiss();
      toast.error(error.message);
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
        <p className="text-muted-foreground mt-4">Carregando análise...</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Análise não encontrada</p>
        <Link href={`/chapters/${chapterId}`}>
          <Button className="mt-4">Voltar</Button>
        </Link>
      </div>
    );
  }

  // Still processing
  if (job.status === 'processing' || job.status === 'pending') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href={`/chapters/${chapterId}`}>
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Analisando Ajustes</h1>
            <p className="text-muted-foreground mt-1">{chapterTitle || 'Carregando...'}</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sliders className="h-5 w-5 animate-pulse" />
              Análise em Progresso
            </CardTitle>
            <CardDescription>
              A IA está analisando o documento e gerando ajustes conforme suas instruções
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Processando...</span>
                <span>{job.progress}%</span>
              </div>
              <Progress value={job.progress} />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error
  if (job.status === 'error') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href={`/chapters/${chapterId}`}>
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Erro na Análise</h1>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              Erro ao Analisar Documento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{job.errorMessage || 'Erro desconhecido'}</p>
            <Button className="mt-4" onClick={() => router.push(`/chapters/${chapterId}`)}>
              Voltar ao Capítulo
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Completed - show suggestions
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/chapters/${chapterId}`}>
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Sugestões de Ajuste</h1>
          <p className="text-muted-foreground mt-1">{chapterTitle}</p>
        </div>
      </div>

      <SuggestionReviewPanel
        suggestions={suggestions}
        documentTitle={chapterTitle}
        fullDocumentText={fullText}
        onApply={handleApply}
        typeLabels={{
          adjustment: { label: 'Ajuste', color: 'bg-yellow-500' }
        }}
      />
    </div>
  );
}
