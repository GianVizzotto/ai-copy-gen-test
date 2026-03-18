import { Button } from "./ui/button";

interface WelcomeProps {
  onStart: () => void;
}

export function Welcome({ onStart }: WelcomeProps) {
  return (
    <div className="min-h-screen bg-[#0D1B3E] flex items-center justify-center px-4">
      <div className="max-w-[600px] text-center">
        <h1 className="text-5xl font-bold text-[#F0F0F5] mb-4">
          AI Authoring Assistant
        </h1>
        <p className="text-xl text-[#00A4A6] mb-12">
          Generate on-brand page content for Acme.com
        </p>
        <Button
          onClick={onStart}
          size="lg"
          className="bg-[#00A4A6] hover:bg-[#00A4A6]/90 text-white text-lg px-12 py-6 h-auto rounded-xl"
        >
          Start
        </Button>
      </div>
    </div>
  );
}