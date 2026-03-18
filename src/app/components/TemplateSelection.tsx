import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Loader2, CheckCircle2 } from "lucide-react";
import { ProgressBar } from "./ProgressBar";

interface Template {
  label: string;
  description: string;
  file: string;
}

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
  agentScope: string;
  fields: Field[];
}

interface TemplateManifest {
  label: string;
  description: string;
  components: Component[];
}

interface TemplateSelectionProps {
  onTemplateSelected: (template: TemplateManifest) => void;
}

export function TemplateSelection({ onTemplateSelected }: TemplateSelectionProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateManifest | null>(null);
  const [loadingManifest, setLoadingManifest] = useState(false);

  useEffect(() => {
    async function fetchIndex() {
      try {
        const response = await fetch(
          'https://raw.githubusercontent.com/GianVizzotto/ai-copy-gen-test/main/index.json'
        );
        if (!response.ok) {
          throw new Error('Failed to fetch templates');
        }
        const data = await response.json();
        setTemplates(data.templates || []);
      } catch (err) {
        setError('Could not load templates. Please check your connection and try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchIndex();
  }, []);

  async function handleSelectTemplate(template: Template) {
    setLoadingManifest(true);
    try {
      const response = await fetch(
        `https://raw.githubusercontent.com/GianVizzotto/ai-copy-gen-test/main/${template.file}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch template manifest');
      }
      const manifest = await response.json();
      setSelectedTemplate(manifest);
    } catch (err) {
      setError('Could not load template details. Please try again.');
    } finally {
      setLoadingManifest(false);
    }
  }

  function handleContinue() {
    if (selectedTemplate) {
      onTemplateSelected(selectedTemplate);
    }
  }

  return (
    <>
      <ProgressBar currentStep="template-selection" />
      <div className="min-h-screen bg-[#0D1B3E] pt-24 py-12 px-4">
        <div className="max-w-[720px] mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-[#F0F0F5] mb-2">Choose a Template</h1>
            <p className="text-[#8892A4]">
              Select the page type you want to create
            </p>
          </div>

          {loading && (
            <div className="bg-[#111827] border border-[#1E2D4E] rounded-xl p-12 text-center">
              <Loader2 className="size-12 text-[#00A4A6] animate-spin mx-auto mb-4" />
              <p className="text-[#8892A4] text-lg">Loading templates...</p>
            </div>
          )}

          {error && (
            <div className="bg-[#EF4444]/10 border border-[#EF4444]/50 rounded-xl p-6 text-center">
              <p className="text-[#EF4444]">{error}</p>
            </div>
          )}

          {!loading && !error && !selectedTemplate && (
            <div className="grid gap-4">
              {templates.map(template => (
                <button
                  key={template.file}
                  onClick={() => handleSelectTemplate(template)}
                  className="bg-[#111827] border border-[#1E2D4E] rounded-xl p-6 text-left hover:border-[#00A4A6] transition-colors"
                >
                  <h3 className="text-xl font-bold text-[#F0F0F5] mb-2">{template.label}</h3>
                  <p className="text-[#8892A4]">{template.description}</p>
                </button>
              ))}
            </div>
          )}

          {loadingManifest && (
            <div className="bg-[#111827] border border-[#1E2D4E] rounded-xl p-12 text-center">
              <Loader2 className="size-12 text-[#00A4A6] animate-spin mx-auto mb-4" />
              <p className="text-[#8892A4] text-lg">Loading template details...</p>
            </div>
          )}

          {selectedTemplate && !loadingManifest && (
            <div className="bg-[#111827] border border-[#1E2D4E] rounded-xl p-6">
              <div className="flex items-start gap-3 mb-6">
                <CheckCircle2 className="size-6 text-[#10B981] shrink-0 mt-1" />
                <div>
                  <h3 className="text-xl font-bold text-[#F0F0F5] mb-2">
                    You selected: {selectedTemplate.label}
                  </h3>
                  <p className="text-[#8892A4] mb-4">
                    Here are the sections we will generate:
                  </p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                {selectedTemplate.components
                  .filter(c => c.agentScope !== 'none')
                  .map(component => (
                    <div
                      key={component.id}
                      className="bg-[#0D1B3E] border border-[#1E2D4E] rounded-lg p-4"
                    >
                      <div className="text-[#F0F0F5] font-medium mb-1">
                        {component.label}
                      </div>
                      <div className="text-[#8892A4] text-sm">
                        {component.description}
                      </div>
                    </div>
                  ))}
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleContinue}
                  size="lg"
                  className="bg-[#00A4A6] hover:bg-[#00A4A6]/90 text-white px-8 rounded-xl"
                >
                  Continue
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}