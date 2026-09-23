import React, { useState, useRef, useEffect } from 'react';
import { Plus, ArrowUp, Mic, MicOff, Cpu } from 'lucide-react';

export function InputBar({ onSend, disabled, activeProvider, onOpenModelSelector }) {
  const [text, setText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [text]);

  // Speech Recognition (Web Speech API for Chrome / Android)
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setText((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsListening(false);
      };

      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleVoice = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser window.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const hasContent = text.trim().length > 0;

  return (
    <div className="w-full max-w-5xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[88%] mx-auto px-4 pb-4 pt-2">
      <div className="relative rounded-3xl bg-gemini-elevated/90 border border-gemini-border/60 backdrop-blur-md gemini-pill-shadow transition-all duration-300 focus-within:border-gemini-blue/60 focus-within:ring-1 focus-within:ring-gemini-blue/30">
        <div className="flex items-end px-3 py-2.5 space-x-2">
          {/* Plus / Action button */}
          <button
            type="button"
            className="p-2 rounded-full text-gemini-muted hover:text-gemini-text hover:bg-gemini-hover transition-colors shrink-0"
            title="Attach file or action"
          >
            <Plus className="w-5 h-5" />
          </button>

          {/* Model Provider Pill Badge */}
          <button
            type="button"
            onClick={onOpenModelSelector}
            className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 mb-1 rounded-full bg-gemini-surface border border-gemini-border text-xs text-gemini-sparkle1 hover:border-gemini-blue transition-colors shrink-0"
            title="Switch Model Provider"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span className="font-medium max-w-[120px] truncate capitalize">
              {activeProvider || 'Local Model'}
            </span>
          </button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Personal Assistant, run a command, or automate your PC..."
            className="w-full bg-transparent text-gemini-text placeholder-gemini-muted/70 text-sm md:text-base resize-none focus:outline-none py-1.5 px-2 max-h-44 leading-relaxed"
          />

          {/* Voice Input Mic */}
          <button
            type="button"
            onClick={toggleVoice}
            className={`p-2 rounded-full transition-colors shrink-0 ${
              isListening
                ? 'bg-rose-500/20 text-rose-400 animate-pulse'
                : 'text-gemini-muted hover:text-gemini-text hover:bg-gemini-hover'
            }`}
            title={isListening ? 'Listening...' : 'Dictate with voice'}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Send Arrow Button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!hasContent || disabled}
            className={`p-2 rounded-full transition-all duration-200 shrink-0 ${
              hasContent && !disabled
                ? 'bg-gemini-blue text-slate-950 shadow-md scale-100 hover:bg-gemini-blue-dark active:scale-95'
                : 'text-gemini-muted/40 cursor-not-allowed'
            }`}
          >
            <ArrowUp className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>
      </div>
      <div className="text-center text-[11px] text-gemini-muted/60 mt-1.5">
        Personal Assistant can inspect your PC, run commands, and automate tasks with your approval.
      </div>
    </div>
  );
}
