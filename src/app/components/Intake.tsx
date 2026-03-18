import { useState } from "react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Input } from "./ui/input";
import { CheckCircle2, AlertCircle, Minus, Loader2 } from "lucide-react";
import { callClaude, extractTextFromResponse } from "../utils/api";
import { ProgressBar } from "./ProgressBar";

interface IntakeField {
  key: string;
  label: string;
  briefingFieldMapping: string | null;
  hint?: string;
  required: boolean;
}

interface TemplateManifest {
  label: string;
  description: string;
  intakeFields: {
    universal: IntakeField[];
    templateSpecific: IntakeField[];
  };
}

interface IntakeProps {
  template: TemplateManifest;
  onComplete: (briefText: string, confirmedFields: Record<string, string>) => void;
}

type IntakeStep = 'brief-input' | 'extracting' | 'gap-filling';

export function Intake({ template, onComplete }: IntakeProps) {
  const [step, setStep] = useState<IntakeStep>('brief-input');
  const [briefText, setBriefText] = useState('');
  const [extractedFields, setExtractedFields] = useState<Record<string, string | null>>({});
  const [confirmedFields, setConfirmedFields] = useState<Record<string, string>>({});
  const [currentGapIndex, setCurrentGapIndex] = useState(0);
  const [gapFillValue, setGapFillValue] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Get all fields that can be extracted from briefing
  const allFields: IntakeField[] = [
    ...template.intakeFields.universal,
    ...template.intakeFields.templateSpecific.filter(f => f.briefingFieldMapping !== null)
  ];

  const requiredFields = allFields.filter(f => f.required);
  const missingRequiredFields = requiredFields.filter(
    f => !extractedFields[f.key] && !confirmedFields[f.key]
  );

  async function handleExtractInformation() {
    if (!briefText.trim()) {
      setError('Please provide a briefing before extracting information.');
      return;
    }

    setStep('extracting');
    setError(null);

    const extractionPrompt = `
You are an AI assistant helping to generate content for an Acme website page.

The user has provided the following briefing text:
---
${briefText}
---

Extract the following fields from the briefing. For each field, return the value if found, or null if not present.
Return ONLY a valid JSON object with no markdown, no backticks, no explanation.

Fields to extract:
${JSON.stringify(allFields.map(f => ({
  key: f.key,
  label: f.label,
  briefingFieldMapping: f.briefingFieldMapping,
  hint: f.hint
})), null, 2)}

Return format:
{
  "fieldKey": "extracted value or null",
  ...
}
`;

    try {
      const response = await callClaude(
        [{ role: 'user', content: extractionPrompt }]
      );
      const text = extractTextFromResponse(response);
      
      // Wrap JSON.parse in try/catch as Claude may return malformed JSON
      let extracted;
      try {
        extracted = JSON.parse(text);
      } catch (parseError) {
        console.error('JSON parsing error:', parseError);
        console.error('Response text:', text);
        setError('Failed to parse the extracted information. Please try again.');
        setStep('brief-input');
        return;
      }
      
      setExtractedFields(extracted);
      
      // Initialize confirmed fields with non-null extracted values
      const initialConfirmed: Record<string, string> = {};
      Object.entries(extracted).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          initialConfirmed[key] = value as string;
        }
      });
      setConfirmedFields(initialConfirmed);

      setStep('gap-filling');
    } catch (error) {
      console.error('Field extraction error:', error);
      setError(error instanceof Error ? error.message : 'Failed to extract information. Please try again.');
      setStep('brief-input');
    }
  }

  function handleGapFillSubmit() {
    if (currentGapIndex < missingRequiredFields.length && gapFillValue.trim()) {
      const field = missingRequiredFields[currentGapIndex];
      setConfirmedFields(prev => ({
        ...prev,
        [field.key]: gapFillValue.trim()
      }));
      setGapFillValue('');
      setCurrentGapIndex(prev => prev + 1);
    }
  }

  function handleConfirmAndContinue() {
    const finalFields = {
      ...confirmedFields,
      ...(additionalContext.trim() && { additionalContext: additionalContext.trim() })
    };
    onComplete(briefText, finalFields);
  }

  const allRequiredFieldsFilled = requiredFields.every(
    f => confirmedFields[f.key]
  );

  const isAskingForGaps = currentGapIndex < missingRequiredFields.length;
  const currentGapField = isAskingForGaps ? missingRequiredFields[currentGapIndex] : null;

  return (
    <>
      <ProgressBar currentStep="intake" />
      <div className="min-h-screen bg-[#0D1B3E] pt-24 py-12 px-4">
        <div className="max-w-[720px] mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-[#F0F0F5] mb-2">Brief & Context</h1>
            <p className="text-[#8892A4]">
              {template.label}
            </p>
          </div>

          {/* Step 3a: Brief Input */}
          {step === 'brief-input' && (
            <div className="space-y-6">
              <div className="bg-[#111827] border border-[#1E2D4E] rounded-xl p-6">
                <p className="text-[#F0F0F5] mb-4">
                  Do you have a briefing for this page? Paste the content from your intake form below.
                  The more context you provide, the better the output.
                </p>
                <Textarea
                  value={briefText}
                  onChange={(e) => setBriefText(e.target.value)}
                  placeholder="Paste your briefing here..."
                  className="min-h-[300px] bg-[#0D1B3E] border-[#1E2D4E] text-[#F0F0F5] placeholder:text-[#8892A4] focus:border-[#00A4A6] focus:ring-[#00A4A6] rounded-xl"
                />
                {error && (
                  <div className="mt-4 bg-[#EF4444]/10 border border-[#EF4444]/50 rounded-xl p-3 text-[#EF4444] text-sm">
                    {error}
                  </div>
                )}
                <div className="mt-4 flex justify-end">
                  <Button
                    onClick={handleExtractInformation}
                    size="lg"
                    className="bg-[#00A4A6] hover:bg-[#00A4A6]/90 text-white rounded-xl"
                  >
                    Extract Information
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3b: Extracting */}
          {step === 'extracting' && (
            <div className="bg-[#111827] border border-[#1E2D4E] rounded-xl p-12 text-center">
              <Loader2 className="size-12 text-[#00A4A6] animate-spin mx-auto mb-4" />
              <p className="text-[#F0F0F5] text-lg">Analyzing your briefing...</p>
            </div>
          )}

          {/* Step 3c: Gap Filling */}
          {step === 'gap-filling' && (
            <div className="space-y-6">
              {/* Summary Panel */}
              <div className="bg-[#111827] border border-[#1E2D4E] rounded-xl p-6">
                <h2 className="text-xl font-bold text-[#F0F0F5] mb-4">Extracted Information</h2>
                <div className="space-y-3">
                  {allFields.map(field => {
                    const value = confirmedFields[field.key];
                    const hasValue = value !== null && value !== undefined && value !== '';
                    const isMissing = !hasValue;
                    
                    return (
                      <div
                        key={field.key}
                        className="flex items-start gap-3 p-3 bg-[#0D1B3E] rounded-lg border border-[#1E2D4E]"
                      >
                        {hasValue && <CheckCircle2 className="size-5 text-[#10B981] shrink-0 mt-0.5" />}
                        {isMissing && field.required && (
                          <AlertCircle className="size-5 text-[#F59E0B] shrink-0 mt-0.5" />
                        )}
                        {isMissing && !field.required && (
                          <Minus className="size-5 text-[#8892A4]/30 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-[#F0F0F5] font-medium text-sm">{field.label}</div>
                          {hasValue && (
                            <div className="text-[#8892A4] text-sm mt-1">{value}</div>
                          )}
                          {isMissing && field.required && (
                            <div className="text-[#F59E0B] text-sm mt-1">Not found — please provide</div>
                          )}
                          {isMissing && !field.required && (
                            <div className="text-[#8892A4]/60 text-sm mt-1">Not provided — optional</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Gap Filling Conversation */}
              {isAskingForGaps && currentGapField && (
                <div className="bg-[#00A4A6]/10 border border-[#00A4A6]/30 rounded-xl p-6">
                  <p className="text-[#F0F0F5] mb-4">
                    I couldn't find the <span className="font-semibold">{currentGapField.label}</span> in your briefing. Could you provide it?
                  </p>
                  {currentGapField.hint && (
                    <p className="text-[#8892A4] text-sm mb-4">{currentGapField.hint}</p>
                  )}
                  <div className="flex gap-3">
                    <Input
                      value={gapFillValue}
                      onChange={(e) => setGapFillValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleGapFillSubmit()}
                      placeholder={`Enter ${currentGapField.label.toLowerCase()}...`}
                      className="bg-[#111827] border-[#1E2D4E] text-[#F0F0F5] placeholder:text-[#8892A4] focus:border-[#00A4A6] focus:ring-[#00A4A6] rounded-xl"
                    />
                    <Button
                      onClick={handleGapFillSubmit}
                      disabled={!gapFillValue.trim()}
                      className="bg-[#00A4A6] hover:bg-[#00A4A6]/90 text-white rounded-xl"
                    >
                      Submit
                    </Button>
                  </div>
                </div>
              )}

              {/* Additional Context */}
              {!isAskingForGaps && allRequiredFieldsFilled && (
                <div className="bg-[#111827] border border-[#1E2D4E] rounded-xl p-6">
                  <p className="text-[#F0F0F5] mb-4">
                    Is there anything else you'd like me to consider when generating the content? (optional)
                  </p>
                  <Textarea
                    value={additionalContext}
                    onChange={(e) => setAdditionalContext(e.target.value)}
                    placeholder="Additional context or special instructions..."
                    className="min-h-[120px] bg-[#0D1B3E] border-[#1E2D4E] text-[#F0F0F5] placeholder:text-[#8892A4] focus:border-[#00A4A6] focus:ring-[#00A4A6] rounded-xl"
                  />
                </div>
              )}

              {/* Confirm & Continue */}
              {allRequiredFieldsFilled && !isAskingForGaps && (
                <div className="flex justify-end">
                  <Button
                    onClick={handleConfirmAndContinue}
                    size="lg"
                    className="bg-[#00A4A6] hover:bg-[#00A4A6]/90 text-white px-8 rounded-xl"
                  >
                    Confirm & Continue
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}