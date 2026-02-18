'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Rocket, ArrowLeft, ArrowRight, SkipForward, Check } from 'lucide-react';
import { PipelineOperation, OperationConfigs, OPERATION_METADATA } from '@/lib/pipeline/types';
import { getAIErrorMessage } from '@/lib/ai-error-message';

type PipelineWizardProps = {
  documentId: string;
  documentTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const OPERATIONS: PipelineOperation[] = ['adjust', 'update', 'improve', 'adapt', 'translate'];

export function PipelineWizard({ documentId, documentTitle, open, onOpenChange }: PipelineWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0); // 0-4 for operations, 5 for review
  const [selectedOps, setSelectedOps] = useState<Set<PipelineOperation>>(new Set());
  const [configs, setConfigs] = useState<Partial<OperationConfigs>>({});
  const [isStarting, setIsStarting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const totalSteps = OPERATIONS.length + 1; // 5 operations + 1 review page
  const currentOperation = currentStep < OPERATIONS.length ? OPERATIONS[currentStep] : null;
  const isReviewStep = currentStep === OPERATIONS.length;

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    if (currentOperation) {
      // Remove from selected operations
      const newSelected = new Set(selectedOps);
      newSelected.delete(currentOperation);
      setSelectedOps(newSelected);

      // Remove config
      const newConfigs = { ...configs };
      delete newConfigs[currentOperation];
      setConfigs(newConfigs);
    }
    handleNext();
  };

  const handleConfigure = async () => {
    if (!currentOperation) return;

    // Validate current step
    const config = configs[currentOperation];
    if (!validateConfig(currentOperation, config)) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    // Simulate processing for visual feedback
    setIsProcessing(true);

    // Simulate AI processing time (1-2 seconds)
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

    // Add to selected operations
    setSelectedOps(new Set([...selectedOps, currentOperation]));
    setIsProcessing(false);
    handleNext();
  };

  const handleStartPipeline = async () => {
    if (selectedOps.size === 0) {
      toast.error('Selecione pelo menos uma operação');
      return;
    }

    try {
      setIsStarting(true);

      // Build operations array in fixed order
      const orderedOps: PipelineOperation[] = OPERATIONS.filter(op =>
        selectedOps.has(op)
      );

      // Ensure all configs have provider/model defaults
      const normalizedConfigs = { ...configs };
      orderedOps.forEach(op => {
        if (!normalizedConfigs[op]) {
          normalizedConfigs[op] = {};
        }

        const config = normalizedConfigs[op];

        // Apply default provider/model if not set
        if (!config.provider || !config.model) {
          const defaultProviders = getDefaultProviders(op);
          config.provider = config.provider || defaultProviders[0];
          config.model = config.model || getDefaultModel(config.provider);
        }
      });

      const res = await fetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          operations: orderedOps,
          configs: normalizedConfigs
        })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Falha ao iniciar pipeline');
      }

      const data = await res.json();
      toast.success('Pipeline iniciado!');

      // Redirect to pipeline page
      setTimeout(() => {
        router.push(`/pipeline/${data.jobId}`);
      }, 500);

    } catch (error: any) {
      console.error('Pipeline start error:', error);
      toast.error(getAIErrorMessage(error, 'Falha ao iniciar pipeline'));
      setIsStarting(false);
    }
  };

  const updateConfig = (key: string, value: any) => {
    if (!currentOperation) return;

    setConfigs((prev) => ({
      ...prev,
      [currentOperation]: {
        ...prev[currentOperation],
        [key]: value
      }
    }));
  };

  const handleEditStep = (step: number) => {
    setCurrentStep(step);
  };

  const estimatedTime = Array.from(selectedOps).reduce((total, op) => {
    return total + (OPERATION_METADATA[op]?.estimatedMinutes || 0);
  }, 0);

  const estimatedCost = selectedOps.size * 0.05;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {isReviewStep ? '📋 Revisar Pipeline' : `${OPERATION_METADATA[currentOperation!]?.icon} ${OPERATION_METADATA[currentOperation!]?.name}`}
          </DialogTitle>
          <DialogDescription>
            {isReviewStep
              ? 'Revise suas seleções antes de iniciar o processamento'
              : `Passo ${currentStep + 1} de ${OPERATIONS.length}`}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Indicator */}
        <div className="py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Progresso</span>
            <span className="text-sm font-medium">{currentStep + 1} / {totalSteps}</span>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-2 flex-1 rounded-full transition-all ${
                  i < currentStep
                    ? 'bg-green-500'
                    : i === currentStep
                    ? 'bg-red-500'
                    : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="py-4 min-h-[300px]">
          {!isReviewStep && currentOperation && (
            <OperationStepContent
              operation={currentOperation}
              config={configs[currentOperation]}
              onConfigChange={updateConfig}
            />
          )}

          {isReviewStep && (
            <ReviewStep
              selectedOps={selectedOps}
              configs={configs}
              estimatedTime={estimatedTime}
              estimatedCost={estimatedCost}
              onEditStep={handleEditStep}
            />
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 0 || isStarting || isProcessing}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>

          <div className="flex gap-2">
            {!isReviewStep && (
              <Button
                variant="ghost"
                onClick={handleSkip}
                disabled={isStarting || isProcessing}
              >
                <SkipForward className="w-4 h-4 mr-2" />
                Pular
              </Button>
            )}

            {isReviewStep ? (
              <Button
                onClick={handleStartPipeline}
                disabled={selectedOps.size === 0 || isStarting}
                className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white"
              >
                {isStarting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Iniciando...
                  </>
                ) : (
                  <>
                    <Rocket className="w-4 h-4 mr-2" />
                    Iniciar Pipeline
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleConfigure}
                disabled={isStarting || isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    Configurar & Avançar
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Operation Step Content
// ============================================

type OperationStepContentProps = {
  operation: PipelineOperation;
  config: any;
  onConfigChange: (key: string, value: any) => void;
};

function OperationStepContent({ operation, config, onConfigChange }: OperationStepContentProps) {
  const metadata = OPERATION_METADATA[operation];

  return (
    <div className="space-y-4">
      {/* Operation description shown in dialog header, no need to repeat */}
      <div className="text-sm text-gray-600 mb-4">
        {metadata.description}
      </div>

      {/* Configuration Fields */}
      <div className="space-y-4">
        {operation === 'adjust' && <AdjustConfig config={config} onChange={onConfigChange} />}
        {operation === 'update' && <UpdateConfig config={config} onChange={onConfigChange} />}
        {operation === 'improve' && <ImproveConfig config={config} onChange={onConfigChange} />}
        {operation === 'adapt' && <AdaptConfig config={config} onChange={onConfigChange} />}
        {operation === 'translate' && <TranslateConfig config={config} onChange={onConfigChange} />}
      </div>
    </div>
  );
}

// ============================================
// Review Step
// ============================================

type ReviewStepProps = {
  selectedOps: Set<PipelineOperation>;
  configs: Partial<OperationConfigs>;
  estimatedTime: number;
  estimatedCost: number;
  onEditStep: (step: number) => void;
};

function ReviewStep({ selectedOps, configs, estimatedTime, estimatedCost, onEditStep }: ReviewStepProps) {
  if (selectedOps.size === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">Nenhuma operação selecionada</p>
        <p className="text-sm text-gray-400">Volte e configure pelo menos uma operação</p>
      </div>
    );
  }

  const orderedSelectedOps = OPERATIONS.filter(op => selectedOps.has(op));

  return (
    <div className="space-y-4">
      <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-900/20">
        <h3 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">✓ {selectedOps.size} Operações Selecionadas</h3>
        <div className="space-y-2">
          {orderedSelectedOps.map((op, index) => {
            const metadata = OPERATION_METADATA[op];
            const config = configs[op];
            const stepNumber = OPERATIONS.indexOf(op);

            return (
              <div key={op} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{metadata.icon}</span>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{metadata.name}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {getConfigSummary(op, config)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEditStep(stepNumber)}
                  className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
                >
                  Editar
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold mb-3 text-gray-900 dark:text-gray-100">📊 Resumo do Pipeline</h3>
        <div className="space-y-2 text-sm">
          <p className="flex justify-between">
            <span className="text-gray-700 dark:text-gray-300">Tempo total estimado:</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">~{estimatedTime}-{estimatedTime + 5} min</span>
          </p>
          <p className="flex justify-between">
            <span className="text-gray-700 dark:text-gray-300">Custo total estimado:</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">${estimatedCost.toFixed(2)}</span>
          </p>
          <p className="flex justify-between">
            <span className="text-gray-700 dark:text-gray-300">Operações que requerem aprovação:</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {orderedSelectedOps.filter(op => op === 'update' || op === 'improve').length}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Config Components (reused from pipeline-selector)
// ============================================

function AdjustConfig({ config, onChange }: any) {
  return (
    <>
      <div>
        <Label>Instruções *</Label>
        <Textarea
          placeholder="Ex: Revisar o capítulo 3, melhorar as frases, retirar tópicos sobre tema tal..."
          value={config?.instructions || ''}
          onChange={(e) => onChange('instructions', e.target.value)}
          rows={4}
          className="mt-1"
        />
      </div>
      <div>
        <Label>Criatividade da IA (0 = conservador, 10 = criativo)</Label>
        <input
          type="range"
          min="0"
          max="10"
          value={config?.creativity || 5}
          onChange={(e) => onChange('creativity', parseInt(e.target.value))}
          className="w-full mt-2"
        />
        <p className="text-xs text-gray-500 mt-1">Nível: {config?.creativity || 5}</p>
      </div>
      <ModelSelector config={config} onChange={onChange} providers={['openai', 'gemini', 'grok']} />
    </>
  );
}

function UpdateConfig({ config, onChange }: any) {
  return (
    <>
      <div className="p-3 border rounded bg-yellow-50 text-sm text-yellow-800">
        ⚠️ Esta operação requer aprovação manual após a análise
      </div>
      <ModelSelector config={config} onChange={onChange} providers={['gemini']} />
    </>
  );
}

function ImproveConfig({ config, onChange }: any) {
  return (
    <>
      <div className="p-3 border rounded bg-yellow-50 text-sm text-yellow-800">
        ⚠️ Esta operação requer aprovação manual após a análise
      </div>
      <ModelSelector config={config} onChange={onChange} providers={['openai', 'gemini']} />
    </>
  );
}

function AdaptConfig({ config, onChange }: any) {
  return (
    <>
      <div>
        <Label>Estilo de Adaptação *</Label>
        <Select value={config?.style || 'simplified'} onValueChange={(v) => onChange('style', v)}>
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="academic">Acadêmico</SelectItem>
            <SelectItem value="professional">Profissional</SelectItem>
            <SelectItem value="simplified">Simplificado</SelectItem>
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {config?.style === 'custom' && (
        <div>
          <Label>Público-Alvo</Label>
          <input
            type="text"
            placeholder="Ex: Estudantes de graduação"
            value={config?.targetAudience || ''}
            onChange={(e) => onChange('targetAudience', e.target.value)}
            className="w-full mt-1 px-3 py-2 border rounded"
          />
        </div>
      )}
      <ModelSelector config={config} onChange={onChange} providers={['openai', 'gemini']} />
    </>
  );
}

function TranslateConfig({ config, onChange }: any) {
  const LANGUAGES = {
    en: 'English',
    pt: 'Português',
    es: 'Español',
    fr: 'Français',
    de: 'Deutsch',
    it: 'Italiano'
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>De (origem)</Label>
          <Select value={config?.sourceLanguage || 'auto'} onValueChange={(v) => onChange('sourceLanguage', v)}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto-detectar</SelectItem>
              {Object.entries(LANGUAGES).map(([code, name]) => (
                <SelectItem key={code} value={code}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Para (destino) *</Label>
          <Select value={config?.targetLanguage || ''} onValueChange={(v) => onChange('targetLanguage', v)}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(LANGUAGES).map(([code, name]) => (
                <SelectItem key={code} value={code}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <ModelSelector config={config} onChange={onChange} providers={['openai']} />
    </>
  );
}

function ModelSelector({ config, onChange, providers }: { config: any; onChange: any; providers: string[] }) {
  const defaultProvider = providers[0];
  const currentProvider = config?.provider || defaultProvider;
  const currentModel = config?.model || MODELS[currentProvider]?.[0];

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <Label>Provedor</Label>
        <Select value={currentProvider} onValueChange={(v) => {
          onChange('provider', v);
          onChange('model', MODELS[v]?.[0]);
        }}>
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {providers.map((p) => (
              <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Modelo</Label>
        <Select
          value={currentModel}
          onValueChange={(v) => onChange('model', v)}
        >
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODELS[currentProvider]?.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// ============================================
// Helper Functions
// ============================================

const MODELS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini'],
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro'],
  grok: ['grok-2-1212']
};

function getDefaultProviders(op: PipelineOperation): string[] {
  switch (op) {
    case 'adjust':
      return ['gemini', 'openai', 'grok'];
    case 'update':
      return ['gemini'];
    case 'improve':
      return ['gemini', 'openai'];
    case 'adapt':
      return ['gemini', 'openai'];
    case 'translate':
      return ['gemini', 'openai'];
    default:
      return ['gemini', 'openai'];
  }
}

function getDefaultModel(provider: string): string {
  return MODELS[provider]?.[0] || (provider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o');
}

function validateConfig(op: PipelineOperation, config: any): boolean {
  if (!config) return false;

  switch (op) {
    case 'adjust':
      // Only instructions is required; provider/model have defaults
      return !!config.instructions?.trim();
    case 'update':
      // No required fields; provider/model have defaults
      return true;
    case 'improve':
      // No required fields; provider/model have defaults
      return true;
    case 'adapt':
      // Only style is required; provider/model have defaults
      return !!config.style;
    case 'translate':
      // Only targetLanguage is required; provider/model have defaults
      return !!config.targetLanguage;
    default:
      return false;
  }
}

function getConfigSummary(op: PipelineOperation, config: any): string {
  if (!config) return 'Não configurado';

  // Get provider/model with defaults
  const defaultProviders = getDefaultProviders(op);
  const provider = config.provider || defaultProviders[0];
  const model = config.model || getDefaultModel(provider);

  switch (op) {
    case 'adjust':
      return `Criatividade: ${config.creativity || 5} | ${provider}/${model}`;
    case 'update':
      return `${provider}/${model}`;
    case 'improve':
      return `${provider}/${model}`;
    case 'adapt':
      return `Estilo: ${config.style} | ${provider}/${model}`;
    case 'translate':
      const sourceLang = config.sourceLanguage || 'auto';
      return `${sourceLang} → ${config.targetLanguage} | ${provider}/${model}`;
    default:
      return '';
  }
}
