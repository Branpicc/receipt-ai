"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type OnboardingStep = {
  title: string;
  description: string;
  content: React.ReactNode;
  image?: string;
  action?: {
    label: string;
    onClick: () => void | Promise<void>;
  };
};

type OnboardingModalProps = {
  steps: OnboardingStep[];
  onComplete: () => void;
  onSkip: () => void;
  role: string;
};

export default function OnboardingModal({
  steps,
  onComplete,
  onSkip,
  role,
}: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const progress = ((currentStep + 1) / steps.length) * 100;

  async function handleNext() {
    if (step.action) {
      setIsProcessing(true);
      try {
        await step.action.onClick();
      } catch (error) {
        console.error("Action failed:", error);
      } finally {
        setIsProcessing(false);
      }
    }

    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  }

  function handlePrevious() {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden border border-gray-200 dark:border-dark-border">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-dark-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Welcome to ReceiptAI
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {role === "firm_admin" || role === "owner"
                  ? "Firm Administrator"
                  : role === "accountant"
                  ? "Accountant"
                  : "Client"}{" "}
                Guide
              </p>
            </div>
            <button
              onClick={onSkip}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              Skip for now
            </button>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 dark:bg-dark-border rounded-full h-2">
            <div
              className="bg-accent-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
            <span>
              Step {currentStep + 1} of {steps.length}
            </span>
            <span>{Math.round(progress)}% complete</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-280px)]">
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {step.title}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {step.description}
            </p>
          </div>

          {/* Step Image (if provided) */}
          {step.image && (
            <div className="mb-6 rounded-lg overflow-hidden border border-gray-200 dark:border-dark-border">
              <img
                src={step.image}
                alt={step.title}
                className="w-full h-auto"
              />
            </div>
          )}

          {/* Step Content */}
          <div className="text-gray-700 dark:text-gray-300">
            {step.content}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-hover">
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-border rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>

            <div className="flex items-center gap-2">
              {/* Step Indicators */}
              <div className="flex gap-1.5 mr-4">
                {steps.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === currentStep
                        ? "bg-accent-500"
                        : index < currentStep
                        ? "bg-accent-300 dark:bg-accent-700"
                        : "bg-gray-300 dark:bg-dark-border"
                    }`}
                  />
                ))}
              </div>

              <button
                onClick={handleNext}
                disabled={isProcessing}
                className="px-6 py-2 text-sm font-medium bg-accent-500 text-white rounded-lg hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing
                  ? "Processing..."
                  : isLastStep
                  ? "Get Started! 🚀"
                  : step.action
                  ? step.action.label
                  : "Next →"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}