import { useState } from "react";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
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
  agentScope: string;
  fields: Field[];
}

interface SectionSelectionProps {
  components: Component[];
  onGenerate: (selectedIds: string[]) => void;
}

export function SectionSelection({ components, onGenerate }: SectionSelectionProps) {
  const generatableComponents = components.filter(c => c.agentScope !== 'none');
  
  // All components pre-selected by default
  const [selectedIds, setSelectedIds] = useState<string[]>(
    generatableComponents.map(c => c.id)
  );

  function toggleComponent(componentId: string) {
    setSelectedIds(prev =>
      prev.includes(componentId)
        ? prev.filter(id => id !== componentId)
        : [...prev, componentId]
    );
  }

  function handleGenerate() {
    if (selectedIds.length > 0) {
      onGenerate(selectedIds);
    }
  }

  return (
    <>
      <ProgressBar currentStep="generation" />
      <div className="min-h-screen bg-[#0D1B3E] pt-24 py-12 px-4">
        <div className="max-w-[720px] mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-[#F0F0F5] mb-2">Select Sections</h1>
            <p className="text-[#8892A4]">
              Choose which sections to generate content for
            </p>
          </div>

          <div className="bg-[#111827] border border-[#1E2D4E] rounded-xl p-6 mb-8">
            <div className="space-y-4">
              {generatableComponents.map(component => (
                <div
                  key={component.id}
                  className="flex items-start gap-3 p-4 bg-[#0D1B3E] border border-[#1E2D4E] rounded-lg hover:border-[#00A4A6]/50 transition-colors cursor-pointer"
                  onClick={() => toggleComponent(component.id)}
                >
                  <Checkbox
                    checked={selectedIds.includes(component.id)}
                    onCheckedChange={() => toggleComponent(component.id)}
                    className="mt-0.5 border-[#1E2D4E] data-[state=checked]:bg-[#00A4A6] data-[state=checked]:border-[#00A4A6]"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-1">
                    <div className="text-[#F0F0F5] font-medium">{component.label}</div>
                    <div className="text-[#8892A4] text-sm mt-1">{component.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleGenerate}
              disabled={selectedIds.length === 0}
              size="lg"
              className="bg-[#00A4A6] hover:bg-[#00A4A6]/90 text-white px-8 rounded-xl"
            >
              Generate Content ({selectedIds.length})
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}