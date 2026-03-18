import { useState, useEffect } from "react";
import { Welcome } from "./components/Welcome";
import { TemplateSelection } from "./components/TemplateSelection";
import { Intake } from "./components/Intake";
import { SectionSelection } from "./components/SectionSelection";
import { Generation } from "./components/Generation";
import { Iteration } from "./components/Iteration";
import { testServerConnection } from "./utils/api";

type AppState = 'welcome' | 'template-selection' | 'intake' | 'section-selection' | 'generation' | 'iteration';

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
  components: Component[];
  intakeFields: {
    universal: IntakeField[];
    templateSpecific: IntakeField[];
  };
}

interface AppStateData {
  state: AppState;
  selectedTemplate: TemplateManifest | null;
  brandGuidelines: string;
  briefText: string;
  extractedFields: Record<string, unknown>;
  confirmedFields: Record<string, string>;
  selectedSections: string[];
  generatedContent: Record<string, Record<string, string>>;
  conversationHistory: unknown[];
}

export default function App() {
  const [appState, setAppState] = useState<AppStateData>({
    state: 'welcome',
    selectedTemplate: null,
    brandGuidelines: '',
    briefText: '',
    extractedFields: {},
    confirmedFields: {},
    selectedSections: [],
    generatedContent: {},
    conversationHistory: []
  });

  // Test server connection and load brand guidelines on app startup
  useEffect(() => {
    async function initialize() {
      // Test server connectivity
      console.log('Testing server connection...');
      const serverOk = await testServerConnection();
      if (serverOk) {
        console.log('✅ Server is accessible');
      } else {
        console.error('❌ Server is not accessible - API calls will fail');
      }

      // Load brand guidelines
      try {
        const [tovRes, wsgRes] = await Promise.all([
          fetch('https://raw.githubusercontent.com/GianVizzotto/ai-copy-gen-test/main/tone-of-voice.md'),
          fetch('https://raw.githubusercontent.com/GianVizzotto/ai-copy-gen-test/main/writing-style-guide.md')
        ]);
        const tov = await tovRes.text();
        const wsg = await wsgRes.text();

        // Store concatenated in state
        setAppState(prev => ({
          ...prev,
          brandGuidelines: `${tov}\n\n---\n\n${wsg}`
        }));
        console.log('✅ Brand guidelines loaded');
      } catch (error) {
        console.error('Failed to load brand guidelines:', error);
        // App can continue without guidelines — generation will use fallback tone instructions
      }
    }

    initialize();
  }, []);

  function handleStart() {
    setAppState(prev => ({ ...prev, state: 'template-selection' }));
  }

  function handleTemplateSelected(template: TemplateManifest) {
    setAppState(prev => ({
      ...prev,
      state: 'intake',
      selectedTemplate: template
    }));
  }

  function handleIntakeComplete(briefText: string, confirmedFields: Record<string, string>) {
    setAppState(prev => ({
      ...prev,
      state: 'section-selection',
      briefText,
      confirmedFields
    }));
  }

  function handleSectionsSelected(selectedIds: string[]) {
    setAppState(prev => ({
      ...prev,
      state: 'generation',
      selectedSections: selectedIds
    }));
  }

  function handleGenerationComplete(generatedContent: Record<string, Record<string, string>>) {
    setAppState(prev => ({
      ...prev,
      state: 'iteration',
      generatedContent
    }));
  }

  return (
    <div className="size-full">
      {appState.state === 'welcome' && <Welcome onStart={handleStart} />}
      {appState.state === 'template-selection' && (
        <TemplateSelection onTemplateSelected={handleTemplateSelected} />
      )}
      {appState.state === 'intake' && appState.selectedTemplate && (
        <Intake 
          template={appState.selectedTemplate}
          onComplete={handleIntakeComplete}
        />
      )}
      {appState.state === 'section-selection' && appState.selectedTemplate && (
        <SectionSelection
          components={appState.selectedTemplate.components}
          onGenerate={handleSectionsSelected}
        />
      )}
      {appState.state === 'generation' && appState.selectedTemplate && (
        <Generation
          template={appState.selectedTemplate}
          selectedComponentIds={appState.selectedSections}
          confirmedFields={appState.confirmedFields}
          brandGuidelines={appState.brandGuidelines}
          onComplete={handleGenerationComplete}
        />
      )}
      {appState.state === 'iteration' && appState.selectedTemplate && (
        <Iteration
          template={appState.selectedTemplate}
          selectedComponentIds={appState.selectedSections}
          confirmedFields={appState.confirmedFields}
          brandGuidelines={appState.brandGuidelines}
          initialContent={appState.generatedContent}
        />
      )}
    </div>
  );
}