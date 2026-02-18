'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ChapterSelector } from './chapter-selector';
import { CitationBadge, CitationDisplayMode } from './citation-badge';

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

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: any[];
  citationMode?: CitationDisplayMode;
  timestamp: Date;
};

type ChapterChatProps = {
  currentChapterId: string;
  allChapters: Chapter[];
};

export function ChapterChat({ currentChapterId, allChapters }: ChapterChatProps) {
  // Load messages from localStorage on mount
  const loadMessagesFromStorage = (): Message[] => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(`chat-history-${currentChapterId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert timestamp strings back to Date objects
        return parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
      }
    } catch (error) {
      console.error('[CHAT] Error loading messages from storage:', error);
    }
    return [];
  };

  const [messages, setMessages] = useState<Message[]>(loadMessagesFromStorage);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedVersionIds, setSelectedVersionIds] = useState<string[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (typeof window === 'undefined' || messages.length === 0) return;
    try {
      localStorage.setItem(`chat-history-${currentChapterId}`, JSON.stringify(messages));
    } catch (error) {
      console.error('[CHAT] Error saving messages to storage:', error);
    }
  }, [messages, currentChapterId]);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (messages.length > 0 && scrollAreaRef.current) {
      // Find the ScrollArea viewport (Radix UI creates it)
      setTimeout(() => {
        const viewport = scrollAreaRef.current?.closest('[data-radix-scroll-area-root]')?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
        if (viewport) {
          viewport.scrollTop = viewport.scrollHeight;
        }
      }, 100);
    }
  }, [messages]);

  // Auto-seleciona a versão atual do capítulo atual
  useEffect(() => {
    const currentChapter = allChapters.find(c => c.id === currentChapterId);
    if (currentChapter) {
      const currentVersion = currentChapter.versions.find(v => v.isCurrent);
      if (currentVersion && selectedVersionIds.length === 0) {
        setSelectedVersionIds([currentVersion.id]);
      }
    }
  }, [currentChapterId, allChapters]);

  const handleSend = async () => {
    if (!input.trim() || selectedVersionIds.length === 0) {
      if (selectedVersionIds.length === 0) {
        toast.error('Selecione pelo menos um capítulo');
      }
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapterVersionIds: selectedVersionIds,
          question: input,
          providers: ['openai'],
          models: { openai: 'gpt-4o-mini' }
        })
      });

      if (!response.ok) {
        throw new Error('Falha ao enviar mensagem');
      }

      const data = await response.json();

      console.log('[CHAT] Response data:', data);

      // answers é um array de AIResponse
      const answers = data.answers || [];
      const citationMode = data.citationMode;

      if (answers.length > 0) {
        // Pega a primeira resposta (geralmente openai)
        const answer = answers[0];
        
        console.log('[CHAT] Processing answer:', {
          provider: answer.provider,
          hasText: !!answer.text,
          citationsCount: answer.citations?.length || 0
        });

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: answer.text || 'Sem resposta',
          citations: answer.citations || [],
          citationMode: citationMode,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, assistantMessage]);
      } else {
        console.warn('[CHAT] No answers received');
        toast.error('Nenhuma resposta recebida da IA');
      }

    } catch (error: any) {
      console.error('[CHAT] Error:', error);
      toast.error(error.message || 'Erro ao enviar mensagem');

      // Remove a mensagem do usuário em caso de erro
      setMessages(prev => prev.filter(m => m.id !== userMessage.id));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Chat Area */}
      <div className="lg:col-span-2 space-y-4">
        <Card className="bg-gradient-to-br from-white/[0.07] to-white/[0.02] backdrop-blur-xl border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Chat Contextual
            </CardTitle>
            <CardDescription>
              Faça perguntas sobre os capítulos selecionados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Messages */}
            <ScrollArea className="h-[400px]">
              <div ref={scrollAreaRef} className="pr-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                  <p className="text-muted-foreground mb-2">Nenhuma mensagem ainda</p>
                  <p className="text-sm text-muted-foreground">
                    Selecione capítulos e faça uma pergunta para começar
                  </p>
                </div>
              ) : (
                <>
                  {loading && messages[messages.length - 1]?.role === 'user' && (
                    <div className="flex justify-start">
                      <div className="max-w-[80%] rounded-lg p-3 bg-muted">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">Processando...</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          message.role === 'user'
                            ? 'bg-red-600 text-white'
                            : 'bg-muted text-foreground'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                        {/* Citations */}
                        {message.citations && message.citations.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-border/50">
                            <p className="text-xs text-muted-foreground mb-1">Fontes:</p>
                            <div className="flex flex-wrap gap-1">
                              {message.citations.map((citation: any, idx: number) => (
                                <CitationBadge
                                  key={idx}
                                  citation={{
                                    pageFrom: citation.page || citation.pageFrom || 0,
                                    pageTo: citation.page || citation.pageTo || citation.pageFrom || 0,
                                    chapterOrder: citation.metadata?.chapterOrder,
                                    chapterTitle: citation.metadata?.chapterTitle,
                                    versionNumber: citation.metadata?.versionNumber
                                  }}
                                  mode={message.citationMode || 'minimal'}
                                  showIcon={idx === 0}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        <p className="text-xs opacity-70 mt-2">
                          {message.timestamp.toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                    ))}
                  </>
                )}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Digite sua pergunta..."
                disabled={loading || selectedVersionIds.length === 0}
                className="flex-1"
              />
              <Button
                onClick={handleSend}
                disabled={loading || !input.trim() || selectedVersionIds.length === 0}
                size="icon"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>

            {selectedVersionIds.length === 0 && (
              <p className="text-sm text-muted-foreground text-center">
                ← Selecione capítulos no painel ao lado
              </p>
            )}

            {/* Clear history button */}
            {messages.length > 0 && (
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (confirm('Tem certeza que deseja limpar o histórico de conversa?')) {
                      setMessages([]);
                      if (typeof window !== 'undefined') {
                        localStorage.removeItem(`chat-history-${currentChapterId}`);
                      }
                    }
                  }}
                  className="text-xs text-muted-foreground"
                >
                  Limpar histórico
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Chapter Selector */}
      <div className="lg:col-span-1">
        <ChapterSelector
          chapters={allChapters}
          selectedVersionIds={selectedVersionIds}
          onSelectionChange={setSelectedVersionIds}
          currentChapterId={currentChapterId}
        />
      </div>
    </div>
  );
}
