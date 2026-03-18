interface ProgressBarProps {
  currentStep: 'welcome' | 'template-selection' | 'intake' | 'section-selection' | 'generation' | 'iteration';
}

const steps = [
  { key: 'welcome', label: 'Welcome' },
  { key: 'template-selection', label: 'Template' },
  { key: 'intake', label: 'Intake' },
  { key: 'generation', label: 'Generate' },
  { key: 'iteration', label: 'Iterate' }
] as const;

export function ProgressBar({ currentStep }: ProgressBarProps) {
  const currentIndex = steps.findIndex(s => s.key === currentStep || 
    (currentStep === 'section-selection' && s.key === 'generation'));

  return (
    <div className="fixed top-0 left-0 right-0 bg-[#111827] border-b border-[#1E2D4E] z-50">
      <div className="max-w-[720px] mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          {steps.map((step, index) => {
            const isActive = index === currentIndex;
            const isComplete = index < currentIndex;

            return (
              <div key={step.key} className="flex items-center flex-1">
                <div className="flex items-center gap-2 flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      isActive
                        ? 'bg-[#00A4A6] text-white'
                        : isComplete
                        ? 'bg-[#00A4A6]/30 text-[#00A4A6]'
                        : 'bg-[#1E2D4E] text-[#8892A4]'
                    }`}
                  >
                    {index + 1}
                  </div>
                  <span
                    className={`text-sm font-medium transition-colors hidden sm:inline ${
                      isActive
                        ? 'text-[#00A4A6]'
                        : isComplete
                        ? 'text-[#8892A4]'
                        : 'text-[#8892A4]/50'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 mx-2 transition-colors ${
                      isComplete ? 'bg-[#00A4A6]/30' : 'bg-[#1E2D4E]'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
