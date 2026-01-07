'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, BookOpen, Info } from 'lucide-react';
import { ChapterSelector } from './chapter-selector';

type ChapterVersion = {
  id: string;
  versionNumber: number;
  createdByOperation: string;
  isCurrent: boolean;
  pages: number | null;
};

type Chapter = {
  id: string;
  title: string;
  chapterOrder: number;
  versions: ChapterVersion[];
};

type ContextSelectorProps = {
  chapters: Chapter[];
  currentChapterId: string;
  selectedVersionIds: string[];
  onSelectionChange: (versionIds: string[]) => void;
  description?: string;
};

export function ContextSelector({
  chapters,
  currentChapterId,
  selectedVersionIds,
  onSelectionChange,
  description = "Selecione capítulos para usar como contexto. A IA considerará o conteúdo desses capítulos ao processar o capítulo atual."
}: ContextSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Filtrar capítulo atual
  const availableChapters = chapters.filter(ch => ch.id !== currentChapterId);

  // Contar capítulos selecionados
  const selectedChaptersCount = availableChapters.filter(ch =>
    ch.versions.some(v => selectedVersionIds.includes(v.id))
  ).length;

  // Selecionar automaticamente versão atual de todos os capítulos
  const selectAllCurrentVersions = () => {
    const currentVersionIds = availableChapters
      .map(ch => ch.versions.find(v => v.isCurrent)?.id)
      .filter(Boolean) as string[];
    onSelectionChange(currentVersionIds);
  };

  // Limpar seleção
  const clearSelection = () => {
    onSelectionChange([]);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Contexto de Capítulos
              {selectedChaptersCount > 0 && (
                <Badge variant="secondary">
                  {selectedChaptersCount} {selectedChaptersCount === 1 ? 'capítulo' : 'capítulos'}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Recolher
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                {selectedChaptersCount > 0 ? 'Ver seleção' : 'Selecionar'}
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {availableChapters.length === 0 ? (
            <div className="flex items-start gap-2 p-4 bg-muted rounded-lg border">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-sm text-muted-foreground">
                Não há outros capítulos disponíveis nesta tese para usar como contexto.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAllCurrentVersions}
                  disabled={availableChapters.length === 0}
                >
                  Versões Atuais
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSelection}
                  disabled={selectedVersionIds.length === 0}
                >
                  Limpar
                </Button>
                <div className="ml-auto text-sm text-muted-foreground">
                  {selectedVersionIds.length} {selectedVersionIds.length === 1 ? 'versão selecionada' : 'versões selecionadas'}
                </div>
              </div>

              <ChapterSelector
                chapters={availableChapters}
                selectedVersionIds={selectedVersionIds}
                onSelectionChange={onSelectionChange}
                currentChapterId={currentChapterId}
              />
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
