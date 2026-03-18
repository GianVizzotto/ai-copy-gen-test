import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Loader2, CheckCircle2, Copy, RotateCcw, AlertCircle } from "lucide-react";
import { callClaude, extractTextFromResponse } from "../utils/api";
import { ProgressBar } from "./ProgressBar";

interface Field {
  key: string;
  label: string;
  maxLength?: number;
  hint?: string;
  agentGenerated: boolean;
}

interface Component {
  id: string;
  label: string;
  description: string;
  fields: Field[];
}

interface TemplateManifest {
  label: string;
  components: Component[];
}

interface GenerationProps {
  template: TemplateManifest;
  selectedComponentIds: string[];
  confirmedFields: Record<string, string>;
  brandGuidelines: string;
  onComplete: (generatedContent: Record<string, Record<string, string>>) => void;
}

type ComponentStatus = 'pending' | 'generating' | 'complete' | 'error';

interface ComponentState {
  status: ComponentStatus;
  content: Record<string, string>;
  error?: string;
}

export function Generation({
  template,
  selectedComponentIds,
  confirmedFields,
  brandGuidelines,
  onComplete
}: GenerationProps) {
  const [componentStates, setComponentStates] = useState<Record<string, ComponentState>>({});
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const selectedComponents = template.components.filter(c =>
    selectedComponentIds.includes(c.id)
  );

  useEffect(() => {
    // Initialize component states
    const initialStates: Record<string, ComponentState> = {};
    selectedComponents.forEach(component => {
      initialStates[component.id] = {
        status: 'pending',
        content: {}
      };
    });
    setComponentStates(initialStates);

    // Start generation for all components
    selectedComponents.forEach(component => {
      generateComponentContent(component);
    });
  }, []);

  async function generateComponentContent(component: Component) {
    setComponentStates(prev => ({
      ...prev,
      [component.id]: { ...prev[component.id], status: 'generating' }
    }));

    const systemPrompt = `
You are an AI content writer for Acme.com. You generate on-brand, professional copy for website pages.

Always follow these rules:
- Write in clear, confident, active voice
- No filler words or generic phrases
- Respect character limits strictly — never exceed maxLength for any field
- Do not use punctuation at the end of titles or headings
- Return ONLY a valid JSON object with no markdown, no backticks, no explanation

---
BRAND GUIDELINES — follow these for all content:

${brandGuidelines}
---
`;

    const generatableFields = component.fields.filter(f => f.agentGenerated);

    const generationPrompt = `
Generate content for the following page component.

Page context:
${JSON.stringify(confirmedFields, null, 2)}

Component: ${component.label}
Description: ${component.description}

Generate values for these fields:
${JSON.stringify(
  generatableFields.map(f => ({
    key: f.key,
    label: f.label,
    maxLength: f.maxLength,
    hint: f.hint
  })),
  null, 2
)}

Return ONLY valid JSON, no markdown:
{
  "fieldKey": "generated value",
  ...
}
`;

    try {
      const response = await callClaude(
        [{ role: 'user', content: generationPrompt }],
        systemPrompt
      );
      const text = extractTextFromResponse(response);
      
      // Wrap JSON.parse in try/catch as Claude may return malformed JSON
      let generated;
      try {
        generated = JSON.parse(text);
      } catch (parseError) {
        console.error('JSON parsing error for component:', component.label, parseError);
        console.error('Response text:', text);
        throw new Error('Failed to parse generated content. Please try again.');
      }

      setComponentStates(prev => ({
        ...prev,
        [component.id]: {
          status: 'complete',
          content: generated
        }
      }));
    } catch (error) {
      console.error(`Generation error for ${component.label}:`, error);
      setComponentStates(prev => ({
        ...prev,
        [component.id]: {
          status: 'error',
          content: {},
          error: error instanceof Error ? error.message : 'Failed to generate content'
        }
      }));
    }
  }

  async function regenerateField(component: Component, field: Field) {
    const currentState = componentStates[component.id];
    
    // Mark this field as generating (keep other fields)
    setComponentStates(prev => ({
      ...prev,
      [component.id]: { ...prev[component.id], status: 'generating' }
    }));

    const systemPrompt = `
You are an AI content writer for Acme.com. You generate on-brand, professional copy for website pages.

Always follow these rules:
- Write in clear, confident, active voice
- No filler words or generic phrases
- Respect character limits strictly — never exceed maxLength for any field
- Do not use punctuation at the end of titles or headings
- Return ONLY a valid JSON object with no markdown, no backticks, no explanation

---
BRAND GUIDELINES — follow these for all content:

${brandGuidelines}
---
`;

    const generationPrompt = `
Generate content for a single field of a page component.

Page context:
${JSON.stringify(confirmedFields, null, 2)}

Component: ${component.label}
Description: ${component.description}

Generate a value for this field:
${JSON.stringify({
  key: field.key,
  label: field.label,
  maxLength: field.maxLength,
  hint: field.hint
}, null, 2)}

Return ONLY valid JSON with a single field, no markdown:
{
  "${field.key}": "generated value"
}
`;

    try {
      const response = await callClaude(
        [{ role: 'user', content: generationPrompt }],
        systemPrompt
      );
      const text = extractTextFromResponse(response);
      const generated = JSON.parse(text);

      setComponentStates(prev => ({
        ...prev,
        [component.id]: {
          status: 'complete',
          content: {
            ...currentState.content,
            ...generated
          }
        }
      }));
    } catch (error) {
      console.error(`Regeneration error for ${field.label}:`, error);
      // Restore previous state on error
      setComponentStates(prev => ({
        ...prev,
        [component.id]: { ...currentState, status: 'complete' }
      }));
    }
  }

  function copyToClipboard(value: string, fieldKey: string) {
    navigator.clipboard.writeText(value);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  }

  function getCharacterCountColor(length: number, maxLength?: number): string {
    if (!maxLength) return 'text-white/70';
    const percentage = (length / maxLength) * 100;
    if (percentage > 100) return 'text-red-400';
    if (percentage > 80) return 'text-amber-400';
    return 'text-white/70';
  }

  const allComplete = selectedComponents.every(
    c => componentStates[c.id]?.status === 'complete'
  );

  const hasErrors = selectedComponents.some(
    c => componentStates[c.id]?.status === 'error'
  );

  function handleComplete() {
    const generatedContent: Record<string, Record<string, string>> = {};
    selectedComponents.forEach(component => {
      const state = componentStates[component.id];
      if (state?.content) {
        generatedContent[component.id] = state.content;
      }
    });
    onComplete(generatedContent);
  }

  return (
    <>
      <ProgressBar currentStep="generation" />
      <div className="min-h-screen bg-[#0D1B3E] pt-24 py-12 px-4">
        <div className="max-w-[720px] mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-[#F0F0F5] mb-2">Generated Content</h1>
            <p className="text-[#8892A4]">
              {template.label}
            </p>
          </div>

          <div className="space-y-6">
            {selectedComponents.map(component => {
              const state = componentStates[component.id];
              if (!state) return null;

              const generatableFields = component.fields.filter(f => f.agentGenerated);

              return (
                <div key={component.id} className="bg-[#111827] border border-[#1E2D4E] rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className="text-2xl text-[#F0F0F5] font-bold flex-1">{component.label}</h2>
                    {state.status === 'generating' && (
                      <Loader2 className="size-5 text-[#00A4A6] animate-spin" />
                    )}
                    {state.status === 'complete' && (
                      <CheckCircle2 className="size-5 text-[#10B981]" />
                    )}
                    {state.status === 'error' && (
                      <AlertCircle className="size-5 text-[#EF4444]" />
                    )}
                  </div>

                  {state.status === 'error' && (
                    <div className="mb-4 bg-[#EF4444]/10 border border-[#EF4444]/50 rounded-xl p-4">
                      <p className="text-[#EF4444] text-sm">{state.error}</p>
                      <Button
                        onClick={() => generateComponentContent(component)}
                        size="sm"
                        className="mt-3 bg-[#EF4444] hover:bg-[#EF4444]/90 text-white rounded-lg"
                      >
                        Retry Generation
                      </Button>
                    </div>
                  )}

                  {state.status === 'generating' && (
                    <div className="text-[#8892A4] text-sm">
                      Generating content...
                    </div>
                  )}

                  {(state.status === 'complete' || state.status === 'generating') && (
                    <div className="space-y-4">
                      {generatableFields.map(field => {
                        const value = state.content[field.key] || '';
                        const isGenerating = state.status === 'generating' && !value;

                        return (
                          <div key={field.key} className="bg-[#0D1B3E] border border-[#1E2D4E] rounded-lg p-4">
                            <div className="flex items-start justify-between gap-4 mb-2">
                              <div className="flex-1">
                                <div className="text-[#00A4A6] font-medium text-xs uppercase tracking-wide mb-1">
                                  {field.label}
                                </div>
                                {field.hint && (
                                  <div className="text-[#8892A4] text-xs mb-2">{field.hint}</div>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {value && (
                                  <>
                                    <Button
                                      onClick={() => copyToClipboard(value, `${component.id}-${field.key}`)}
                                      size="sm"
                                      variant="ghost"
                                      className="text-[#8892A4] hover:text-[#F0F0F5] hover:bg-[#1E2D4E] h-8 rounded-lg"
                                    >
                                      {copiedField === `${component.id}-${field.key}` ? (
                                        <>
                                          <CheckCircle2 className="size-4 mr-1" />
                                          Copied!
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="size-4 mr-1" />
                                          Copy
                                        </>
                                      )}
                                    </Button>
                                    <Button
                                      onClick={() => regenerateField(component, field)}
                                      size="sm"
                                      variant="ghost"
                                      className="text-[#8892A4] hover:text-[#F0F0F5] hover:bg-[#1E2D4E] h-8 rounded-lg"
                                    >
                                      <RotateCcw className="size-4 mr-1" />
                                      Regenerate
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>

                            {isGenerating ? (
                              <div className="flex items-center gap-2 text-[#8892A4] text-sm py-2">
                                <Loader2 className="size-4 animate-spin" />
                                Generating...
                              </div>
                            ) : (
                              <>
                                <div className="bg-[#111827] border border-[#1E2D4E] rounded-lg p-3 text-[#F0F0F5] min-h-[60px]">
                                  {value}
                                </div>
                                {field.maxLength && (
                                  <div className={`text-xs mt-2 font-mono ${getCharacterCountColor(value.length, field.maxLength)}`}>
                                    {value.length} / {field.maxLength} chars
                                    {value.length > field.maxLength && ' — exceeds limit'}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {allComplete && !hasErrors && (
            <div className="mt-8 flex justify-end">
              <Button
                onClick={handleComplete}
                size="lg"
                className="bg-[#00A4A6] hover:bg-[#00A4A6]/90 text-white px-8 rounded-xl"
              >
                Continue to Iteration
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}