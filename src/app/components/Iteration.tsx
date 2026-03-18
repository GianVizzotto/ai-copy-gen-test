import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Copy, RotateCcw, CheckCircle2, Loader2, Send, Sparkles } from "lucide-react";
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

interface IterationProps {
  template: TemplateManifest;
  selectedComponentIds: string[];
  confirmedFields: Record<string, string>;
  brandGuidelines: string;
  initialContent: Record<string, Record<string, string>>;
}

export function Iteration({
  template,
  selectedComponentIds,
  confirmedFields,
  brandGuidelines,
  initialContent
}: IterationProps) {
  const [generatedContent, setGeneratedContent] = useState(initialContent);
  const [changeRequest, setChangeRequest] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [regeneratingComponentId, setRegeneratingComponentId] = useState<string | null>(null);
  const [highlightedComponentId, setHighlightedComponentId] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const selectedComponents = template.components.filter(c =>
    selectedComponentIds.includes(c.id)
  );

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

  async function handleChangeRequest() {
    if (!changeRequest.trim() || isProcessing) return;

    setIsProcessing(true);
    const userInstruction = changeRequest.trim();
    setChangeRequest('');

    try {
      // Step 1: Identify target component
      const componentList = selectedComponents.map(c => ({
        id: c.id,
        label: c.label,
        description: c.description
      }));

      const classifyPrompt = `
The user wants to change content on a page. Identify which component they are referring to.

Available components:
${JSON.stringify(componentList, null, 2)}

User request: "${userInstruction}"

Return ONLY the component id as a plain string. Example: arc-marquee-large
`;

      const classifyResponse = await callClaude(
        [{ role: 'user', content: classifyPrompt }]
      );
      const componentId = extractTextFromResponse(classifyResponse).trim();

      // Validate that the component exists
      const targetComponent = selectedComponents.find(c => c.id === componentId);
      if (!targetComponent) {
        console.error('Component not found:', componentId);
        setIsProcessing(false);
        return;
      }

      // Step 2: Regenerate the component with the instruction
      setRegeneratingComponentId(componentId);

      const generatableFields = targetComponent.fields.filter(f => f.agentGenerated);

      const generationPrompt = `
Generate content for the following page component.

Page context:
${JSON.stringify(confirmedFields, null, 2)}

Component: ${targetComponent.label}
Description: ${targetComponent.description}

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

      const iterationPrompt = `
${generationPrompt}

Additional instruction from the user: "${userInstruction}"
Apply this instruction while keeping all other rules and constraints.
`;

      const response = await callClaude(
        [{ role: 'user', content: iterationPrompt }],
        systemPrompt
      );
      const text = extractTextFromResponse(response);
      
      // Wrap JSON.parse in try/catch as Claude may return malformed JSON
      let updated;
      try {
        updated = JSON.parse(text);
      } catch (parseError) {
        console.error('JSON parsing error during iteration:', parseError);
        console.error('Response text:', text);
        throw new Error('Failed to parse updated content. Please try again.');
      }

      // Update content
      setGeneratedContent(prev => ({
        ...prev,
        [componentId]: updated
      }));

      // Highlight the updated component
      setHighlightedComponentId(componentId);
      setTimeout(() => setHighlightedComponentId(null), 3000);

    } catch (error) {
      console.error('Iteration error:', error);
      // TODO: Show error message to user
    } finally {
      setIsProcessing(false);
      setRegeneratingComponentId(null);
    }
  }

  async function regenerateField(component: Component, field: Field) {
    setRegeneratingComponentId(component.id);

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

      setGeneratedContent(prev => ({
        ...prev,
        [component.id]: {
          ...prev[component.id],
          ...generated
        }
      }));

      // Highlight the updated component
      setHighlightedComponentId(component.id);
      setTimeout(() => setHighlightedComponentId(null), 3000);

    } catch (error) {
      console.error(`Regeneration error for ${field.label}:`, error);
    } finally {
      setRegeneratingComponentId(null);
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

  return (
    <>
      <ProgressBar currentStep="iteration" />
      <div className="min-h-screen bg-[#0D1B3E] pt-24 py-12 px-4 pb-32">
        <div className="max-w-[720px] mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-[#F0F0F5] mb-2">Review & Refine</h1>
            <p className="text-[#8892A4]">
              {template.label}
            </p>
          </div>

          <div className="space-y-6 mb-8">
            {selectedComponents.map(component => {
              const content = generatedContent[component.id] || {};
              const generatableFields = component.fields.filter(f => f.agentGenerated);
              const isRegenerating = regeneratingComponentId === component.id;
              const isHighlighted = highlightedComponentId === component.id;

              return (
                <div
                  key={component.id}
                  className={`bg-[#111827] border rounded-xl p-6 transition-all duration-500 ${
                    isHighlighted
                      ? 'border-[#00A4A6] shadow-lg shadow-[#00A4A6]/20 scale-[1.02]'
                      : 'border-[#1E2D4E]'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className="text-2xl text-[#F0F0F5] font-bold flex-1">{component.label}</h2>
                    {isRegenerating && (
                      <Loader2 className="size-5 text-[#00A4A6] animate-spin" />
                    )}
                    {isHighlighted && (
                      <Sparkles className="size-5 text-[#00A4A6] animate-pulse" />
                    )}
                  </div>

                  <div className="space-y-4">
                    {generatableFields.map(field => {
                      const value = content[field.key] || '';

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
                                    disabled={isRegenerating}
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

                          <div className="bg-[#111827] border border-[#1E2D4E] rounded-lg p-3 text-[#F0F0F5] min-h-[60px]">
                            {value}
                          </div>
                          {field.maxLength && (
                            <div className={`text-xs mt-2 font-mono ${getCharacterCountColor(value.length, field.maxLength)}`}>
                              {value.length} / {field.maxLength} chars
                              {value.length > field.maxLength && ' — exceeds limit'}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Chat Input */}
          <div className="fixed bottom-0 left-0 right-0 bg-[#0D1B3E] border-t border-[#1E2D4E] py-6 px-4">
            <div className="max-w-[720px] mx-auto">
              <div className="bg-[#111827] border border-[#1E2D4E] rounded-xl p-4">
                <p className="text-[#8892A4] text-sm mb-3">
                  Ask for changes — e.g. <span className="italic">"Make the hero title shorter"</span> or <span className="italic">"Change the CTA to be more urgent"</span>
                </p>
                <div className="flex gap-3">
                  <Input
                    value={changeRequest}
                    onChange={(e) => setChangeRequest(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleChangeRequest()}
                    placeholder="Type your change request here..."
                    disabled={isProcessing}
                    className="bg-[#0D1B3E] border-[#1E2D4E] text-[#F0F0F5] placeholder:text-[#8892A4] focus:border-[#00A4A6] focus:ring-[#00A4A6] flex-1 rounded-xl"
                  />
                  <Button
                    onClick={handleChangeRequest}
                    disabled={!changeRequest.trim() || isProcessing}
                    className="bg-[#00A4A6] hover:bg-[#00A4A6]/90 text-white px-6 rounded-xl"
                  >
                    {isProcessing ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="size-4 mr-2" />
                        Send
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}