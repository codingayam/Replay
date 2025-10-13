import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';
import { useAuthenticatedApi } from '../utils/api';

interface FormState {
  name: string;
  values: string[];
  mission: string;
  focus: string;
}

const initialFormState: FormState = {
  name: '',
  values: [],
  mission: '',
  focus: ''
};

const cleanValues = (raw: string | string[] | null | undefined): string[] => {
  if (!raw) {
    return [];
  }

  if (Array.isArray(raw)) {
    return raw
      .map(value => (typeof value === 'string' ? value.trim() : ''))
      .filter(Boolean);
  }

  return raw
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
};

const totalSteps = 6;

const carouselContent = [
  {
    title: 'Capture experiences',
    description: 'Record voice notes, write, or upload photos to capture any experiences or thoughts which occur in your life.'
  },
  {
    title: 'Generate meditations',
    description: 'Replay combines your experiences with AI to craft guided meditations that are personalized for you.'
  },
  {
    title: 'Weekly pulse',
    description: "You'll receive a weekly digest that surfaces themes and patterns from your week - connecting your daily dots and making sense of it all."
  },
  {
    title: 'Personalize Replay',
    description: 'To ensure that Replay works best for you, help us by filling in some information about yourself.'
  }
];

const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = (location.state ?? {}) as { from?: string };
  const { user, loading: authLoading } = useAuth();
  const { profile, isLoading: profileLoading, setCurrentStep, currentStep, updateLocalProfile, refreshProfile } = useProfile();
  const api = useAuthenticatedApi();
  const [activeStep, setActiveStep] = useState<number>(1);
  const [formState, setFormState] = useState<FormState>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [valuesInput, setValuesInput] = useState<string>('');
  const [carouselIndex, setCarouselIndex] = useState<number>(0);

  const initialStepFromContext = useMemo(() => {
    if (currentStep >= totalSteps) {
      return totalSteps;
    }
    const storedStep = Math.max(0, currentStep);
    return Math.min(storedStep + 1, totalSteps);
  }, [currentStep]);

  useEffect(() => {
    setActiveStep(initialStepFromContext || 1);
  }, [initialStepFromContext]);

  useEffect(() => {
    // Reset carousel when entering step 2
    if (activeStep === 2) {
      setCarouselIndex(0);
    }
  }, [activeStep]);

  useEffect(() => {
    if (!profile) {
      setFormState(prev => ({
        ...prev,
        name: user?.user_metadata?.fullName || user?.email?.split('@')[0] || ''
      }));
      return;
    }

    setFormState({
      name: (profile.name ?? user?.user_metadata?.fullName ?? user?.email?.split('@')[0] ?? '').trim(),
      values: cleanValues(profile.values),
      mission: profile.mission?.toString() ?? '',
      focus: profile.thinking_about?.toString() ?? ''
    });
  }, [profile, user?.email, user?.user_metadata?.fullName]);

  const goToStep = (targetStep: number) => {
    const clamped = Math.min(Math.max(targetStep, 1), totalSteps);
    if (clamped !== activeStep) {
      setActiveStep(clamped);
    }
  };

  const handleNext = () => {
    const nextStep = Math.min(activeStep + 1, totalSteps);
    if (activeStep >= 1 && activeStep < totalSteps) {
      setCurrentStep(Math.max(currentStep, activeStep));
    }
    goToStep(nextStep);
  };

  const handleBack = () => {
    const prevStep = Math.max(activeStep - 1, 1);
    goToStep(prevStep);
  };

  const handleValuesKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',' || event.key === 'Tab') {
      event.preventDefault();
      const value = valuesInput.trim();
      if (!value) {
        return;
      }
      setFormState(prev => {
        if (prev.values.includes(value)) {
          return prev;
        }
        return {
          ...prev,
          values: [...prev.values, value]
        };
      });
      setValuesInput('');
    }
  };

  const handleRemoveValue = (value: string) => {
    setFormState(prev => ({
      ...prev,
      values: prev.values.filter(item => item !== value)
    }));
  };

  const handleChange = (field: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = event.target.value;
    setFormState(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleLeaveBlank = () => {
    if (activeStep === 4) {
      updateLocalProfile({ values: [], mission: '' });
      setFormState(prev => ({ ...prev, values: [], mission: '' }));
      setValuesInput('');
    }
    if (activeStep === 5) {
      updateLocalProfile({ thinking_about: '' });
      setFormState(prev => ({ ...prev, focus: '' }));
    }
    setCurrentStep(Math.max(currentStep, activeStep));
    handleNext();
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        name: formState.name.trim(),
        values: formState.values,
        mission: formState.mission.trim(),
        thinking_about: formState.focus.trim(),
        onboarding_step: totalSteps,
        onboarding_completed: true
      };

      updateLocalProfile(payload);
      await api.post('/profile', payload);
      setCurrentStep(totalSteps);
      await refreshProfile();
      navigate('/experiences', { replace: true, state: { from: locationState.from ?? '/onboarding' } });
    } catch (submissionError) {
      console.error('Failed to complete onboarding:', submissionError);
      setError('We couldn’t save your details. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div>Loading…</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const progressPercentage = Math.round((activeStep / totalSteps) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 flex items-center justify-center p-4">
      <div className="max-w-xl w-full">
        <div className="mb-8">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Step {activeStep} of {totalSteps}</span>
            <span>{progressPercentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
          {activeStep === 1 && (
            <section className="space-y-8 text-center flex flex-col items-center py-8">
              {/* Icon */}
              <div className="w-24 h-24 rounded-3xl shadow-2xl flex items-center justify-center bg-white">
                <img
                  src="/icon-512.png"
                  alt="Replay Logo"
                  className="w-16 h-16"
                />
              </div>

              {/* Heading with gradient text */}
              <div className="space-y-4">
                <h1
                  className="text-2xl font-normal text-center"
                  style={{
                    background: 'linear-gradient(90deg, rgb(79, 57, 246) 0%, rgb(152, 16, 250) 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    letterSpacing: '-0.3125px',
                    lineHeight: '24px'
                  }}
                >
                  Welcome to Replay
                </h1>
                <p
                  className="text-base text-center mx-auto"
                  style={{
                    color: 'rgba(10, 10, 10, 0.7)',
                    maxWidth: '373px',
                    letterSpacing: '-0.3125px',
                    lineHeight: '26px'
                  }}
                >
                  A space to capture experiences, replay memories, grow with guided meditations and learn more about yourself.
                </p>
              </div>

              {/* Button */}
              <button
                type="button"
                onClick={handleNext}
                className="w-full max-w-md h-14 rounded-2xl font-medium text-white text-sm shadow-lg hover:opacity-90 transition-opacity"
                style={{
                  background: 'linear-gradient(90deg, #615fff 0%, #9810fa 100%)',
                  letterSpacing: '-0.1504px'
                }}
              >
                Show me how it works
              </button>
            </section>
          )}

          {activeStep === 2 && (
            <section className="space-y-6 py-4">
              {/* Title with gradient */}
              <h2
                className="text-center text-base font-normal"
                style={{
                  background: 'linear-gradient(90deg, rgb(79, 57, 246) 0%, rgb(152, 16, 250) 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  letterSpacing: '-0.3125px',
                  lineHeight: '24px'
                }}
              >
                How do I use Replay
              </h2>

              {/* Carousel Card */}
              <div
                className="rounded-2xl px-8 pt-8 pb-6 shadow-2xl"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  boxShadow: '0px 20px 25px -5px rgba(0,0,0,0.1), 0px 8px 10px -6px rgba(0,0,0,0.1)'
                }}
              >
                {/* Content */}
                <div className="space-y-4">
                  {/* Number + Title */}
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 flex items-center justify-center">
                      <span
                        className="text-base font-normal"
                        style={{
                          color: '#4f39f6',
                          letterSpacing: '-0.3125px'
                        }}
                      >
                        {carouselIndex + 1}
                      </span>
                    </div>
                    <h3
                      className="text-lg font-medium"
                      style={{
                        color: '#4f39f6',
                        letterSpacing: '-0.4395px',
                        lineHeight: '27px'
                      }}
                    >
                      {carouselContent[carouselIndex].title}
                    </h3>
                  </div>

                  {/* Description */}
                  <p
                    className="text-base"
                    style={{
                      color: 'rgba(10, 10, 10, 0.7)',
                      letterSpacing: '-0.3125px',
                      lineHeight: '26px'
                    }}
                  >
                    {carouselContent[carouselIndex].description}
                  </p>
                </div>

                {/* Progress Dots */}
                <div className="flex items-center justify-center gap-2 mt-8">
                  {carouselContent.map((_, index) => (
                    <div
                      key={index}
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: index === carouselIndex ? '32px' : '8px',
                        background: index === carouselIndex
                          ? 'linear-gradient(90deg, #615fff 0%, #9810fa 100%)'
                          : '#d1d5dc'
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Navigation Buttons */}
              <div className="flex items-center gap-3">
                {carouselIndex > 0 && (
                  <button
                    type="button"
                    onClick={() => setCarouselIndex(carouselIndex - 1)}
                    className="h-14 px-4 rounded-2xl font-medium text-sm flex items-center gap-2 border"
                    style={{
                      color: '#4f39f6',
                      borderColor: '#c6d2ff',
                      backgroundColor: 'white',
                      letterSpacing: '-0.1504px'
                    }}
                  >
                    <img src="/arrow-left.svg" alt="" className="w-4 h-4" />
                    Previous
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (carouselIndex < carouselContent.length - 1) {
                      setCarouselIndex(carouselIndex + 1);
                    } else {
                      // Last carousel item, go to next step
                      handleNext();
                    }
                  }}
                  className="flex-1 h-14 rounded-2xl font-medium text-white text-sm shadow-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                  style={{
                    background: 'linear-gradient(90deg, #615fff 0%, #9810fa 100%)',
                    letterSpacing: '-0.1504px'
                  }}
                >
                  {carouselIndex === carouselContent.length - 1 ? "Let's go" : 'Next'}
                  {carouselIndex < carouselContent.length - 1 && (
                    <img src="/arrow-right.svg" alt="" className="w-4 h-4" />
                  )}
                </button>
              </div>
            </section>
          )}

          {activeStep === 3 && (
            <section className="space-y-6 py-4">
              {/* Back button */}
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-2 -ml-2 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <img src="/arrow-left.svg" alt="" className="w-4 h-4" />
                <span
                  className="text-sm font-medium"
                  style={{
                    color: '#4f39f6',
                    letterSpacing: '-0.1504px'
                  }}
                >
                  Back
                </span>
              </button>

              {/* Title with gradient */}
              <h2
                className="text-center text-base font-normal"
                style={{
                  background: 'linear-gradient(90deg, rgb(79, 57, 246) 0%, rgb(152, 16, 250) 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  letterSpacing: '-0.3125px',
                  lineHeight: '24px'
                }}
              >
                Let's start with your name
              </h2>

              {/* Form */}
              <div className="space-y-6">
                {/* Input field */}
                <div className="space-y-2">
                  <label
                    htmlFor="preferred-name"
                    className="block text-base font-normal"
                    style={{
                      color: 'rgba(10, 10, 10, 0.9)',
                      letterSpacing: '-0.3125px',
                      lineHeight: '24px'
                    }}
                  >
                    Preferred name
                  </label>
                  <input
                    id="preferred-name"
                    type="text"
                    value={formState.name}
                    onChange={handleChange('name')}
                    className="w-full h-14 px-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter your name"
                    style={{
                      letterSpacing: '-0.1504px'
                    }}
                  />
                </div>

                {/* Info box */}
                <div
                  className="rounded-2xl px-4 pt-4 pb-3 space-y-2"
                  style={{
                    backgroundColor: 'rgb(238, 242, 255)'
                  }}
                >
                  <p
                    className="text-sm"
                    style={{
                      color: '#432dd7',
                      letterSpacing: '-0.1504px',
                      lineHeight: '20px'
                    }}
                  >
                    We use your name in greetings, generated meditations and reports.
                  </p>
                  <p
                    className="text-sm"
                    style={{
                      color: 'rgba(79, 57, 246, 0.7)',
                      letterSpacing: '-0.1504px',
                      lineHeight: '20px'
                    }}
                  >
                    You can update this anytime in your profile.
                  </p>
                </div>
              </div>

              {/* Next Button */}
              <button
                type="button"
                onClick={() => {
                  updateLocalProfile({ name: formState.name.trim() });
                  handleNext();
                }}
                disabled={!formState.name.trim()}
                className="w-full h-14 rounded-2xl font-medium text-white text-sm shadow-lg transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: formState.name.trim()
                    ? 'linear-gradient(90deg, #615fff 0%, #9810fa 100%)'
                    : '#d1d5dc',
                  letterSpacing: '-0.1504px'
                }}
              >
                Next
              </button>
            </section>
          )}

          {activeStep === 4 && (
            <section className="space-y-6 py-4">
              {/* Back button */}
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-2 -ml-2 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <img src="/arrow-left.svg" alt="" className="w-4 h-4" />
                <span
                  className="text-sm font-medium"
                  style={{
                    color: '#4f39f6',
                    letterSpacing: '-0.1504px'
                  }}
                >
                  Back
                </span>
              </button>

              {/* Title with gradient */}
              <h2
                className="text-center text-base font-normal"
                style={{
                  background: 'linear-gradient(90deg, rgb(79, 57, 246) 0%, rgb(152, 16, 250) 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  letterSpacing: '-0.3125px',
                  lineHeight: '24px'
                }}
              >
                Your values and mission
              </h2>

              {/* Form sections */}
              <div className="space-y-6">
                {/* Values Section */}
                <div className="space-y-3">
                  <label
                    className="block text-base font-normal"
                    style={{
                      color: 'rgba(10, 10, 10, 0.9)',
                      letterSpacing: '-0.3125px',
                      lineHeight: '24px'
                    }}
                  >
                    Values
                  </label>

                  {/* Values chips */}
                  {formState.values.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formState.values.map(value => (
                        <span
                          key={value}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm"
                          style={{
                            backgroundColor: '#eef2ff',
                            color: '#4f39f6'
                          }}
                        >
                          {value}
                          <button
                            type="button"
                            onClick={() => handleRemoveValue(value)}
                            className="ml-2 hover:opacity-70"
                            aria-label={`Remove ${value}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Input */}
                  <input
                    type="text"
                    value={valuesInput}
                    onChange={(event) => setValuesInput(event.target.value)}
                    onKeyDown={handleValuesKeyDown}
                    placeholder="Add a value (e.g., growth, curiosity, compassion)"
                    className="w-full h-14 px-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    style={{
                      letterSpacing: '-0.1504px'
                    }}
                  />

                  {/* Helper text for values */}
                  <p
                    className="text-sm"
                    style={{
                      color: 'rgba(79, 57, 246, 0.8)',
                      letterSpacing: '-0.1504px',
                      lineHeight: '20px'
                    }}
                  >
                    Values are core principles you live by in your life - everyone usually has 5-6 core values they live by. Press Enter after each value.
                  </p>
                </div>

                {/* Mission Section */}
                <div className="space-y-3">
                  <label
                    htmlFor="mission"
                    className="block text-base font-normal"
                    style={{
                      color: 'rgba(10, 10, 10, 0.9)',
                      letterSpacing: '-0.3125px',
                      lineHeight: '24px'
                    }}
                  >
                    Mission
                  </label>
                  <textarea
                    id="mission"
                    value={formState.mission}
                    onChange={handleChange('mission')}
                    rows={5}
                    placeholder="What is your mission in life?"
                    className="w-full px-3 py-2 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                    style={{
                      letterSpacing: '-0.1504px',
                      lineHeight: '20px'
                    }}
                  />
                </div>

                {/* Info box */}
                <div
                  className="rounded-2xl px-4 pt-4 pb-3 space-y-3"
                  style={{
                    backgroundColor: 'rgb(238, 242, 255)'
                  }}
                >
                  <p
                    className="text-sm"
                    style={{
                      color: '#432dd7',
                      letterSpacing: '-0.1504px',
                      lineHeight: '22.75px'
                    }}
                  >
                    A mission is your reason for existing - something you were put on this Earth to do. Everyone has a mission and it is usually aligned with and driven by your core values.
                  </p>
                  <p
                    className="text-sm"
                    style={{
                      color: 'rgba(79, 57, 246, 0.7)',
                      letterSpacing: '-0.1504px',
                      lineHeight: '20px'
                    }}
                  >
                    Don't worry if you are not sure yet and these questions seem daunting. Leave them blank for now and Replay will suggest options later as you go along. You can also update this anytime in your profile later.
                  </p>
                </div>
              </div>

              {/* Buttons */}
              <div className="space-y-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    updateLocalProfile({
                      values: formState.values,
                      mission: formState.mission
                    });
                    handleNext();
                  }}
                  className="w-full h-14 rounded-2xl font-medium text-white text-sm shadow-lg hover:opacity-90 transition-opacity"
                  style={{
                    background: 'linear-gradient(90deg, #615fff 0%, #9810fa 100%)',
                    letterSpacing: '-0.1504px'
                  }}
                >
                  Next
                </button>
                <button
                  type="button"
                  onClick={handleLeaveBlank}
                  className="w-full h-12 rounded-2xl font-medium text-sm hover:bg-gray-50 transition-colors"
                  style={{
                    color: '#4f39f6',
                    letterSpacing: '-0.1504px'
                  }}
                >
                  Leave blank for now
                </button>
              </div>
            </section>
          )}

          {activeStep === 5 && (
            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-900">What are you focusing on right now?</h2>
              <p className="text-gray-600">
                Share any projects, thoughts or goals that currently occupy you. If something fascinates or bothers you, add it here. You can update this anytime in your profile later.
              </p>
              <div>
                <label htmlFor="focus" className="block text-sm font-medium text-gray-700 mb-2">
                  Current focus or challenge
                </label>
                <textarea
                  id="focus"
                  value={formState.focus}
                  onChange={handleChange('focus')}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Describe what’s on your mind right now"
                />
              </div>
            </section>
          )}

          {activeStep === 6 && (
            <section className="space-y-6 py-8 text-center flex flex-col items-center">
              {/* Checkmark Icon */}
              <div
                className="w-24 h-24 rounded-full shadow-2xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  boxShadow: '0px 25px 50px -12px rgba(0,0,0,0.25)'
                }}
              >
                <img
                  src="/checkmark.svg"
                  alt="Success"
                  className="w-12 h-12"
                />
              </div>

              {/* Heading with gradient */}
              <div className="space-y-3">
                <h2
                  className="text-base font-normal"
                  style={{
                    background: 'linear-gradient(90deg, rgb(79, 57, 246) 0%, rgb(152, 16, 250) 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    letterSpacing: '-0.3125px',
                    lineHeight: '24px'
                  }}
                >
                  Thank you!
                </h2>
                <p
                  className="text-base"
                  style={{
                    color: 'rgba(10, 10, 10, 0.7)',
                    letterSpacing: '-0.3125px',
                    lineHeight: '26px'
                  }}
                >
                  Your dashboard and profile are ready. Start capturing experiences today!
                </p>
              </div>

              {/* Progress Card */}
              <div
                className="w-full rounded-2xl p-6 space-y-6"
                style={{
                  backgroundColor: 'white',
                  border: '1px solid rgb(243, 244, 246)'
                }}
              >
                {/* Journal Progress */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-2xl flex items-center justify-center"
                        style={{ backgroundColor: 'rgb(243, 232, 255)' }}
                      >
                        <img src="/journal-icon.svg" alt="" className="w-5 h-5" />
                      </div>
                      <span
                        className="text-base font-normal"
                        style={{
                          color: 'rgb(10, 10, 10)',
                          letterSpacing: '-0.3125px'
                        }}
                      >
                        Journal
                      </span>
                    </div>
                    <span
                      className="text-base font-normal"
                      style={{
                        color: '#9810fa',
                        letterSpacing: '-0.3125px'
                      }}
                    >
                      0/5
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: '0%',
                        backgroundColor: '#9810fa'
                      }}
                    />
                  </div>
                </div>

                {/* Meditation Progress */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-2xl flex items-center justify-center"
                        style={{ backgroundColor: 'transparent' }}
                      >
                        <img src="/meditation-icon.svg" alt="" className="w-5 h-5" />
                      </div>
                      <span
                        className="text-base font-normal"
                        style={{
                          color: 'rgb(10, 10, 10)',
                          letterSpacing: '-0.3125px'
                        }}
                      >
                        Meditation
                      </span>
                    </div>
                    <span
                      className="text-base font-normal"
                      style={{
                        color: '#0092b8',
                        letterSpacing: '-0.3125px'
                      }}
                    >
                      0/1
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: '0%',
                        background: 'linear-gradient(90deg, #00b8db 0%, #2b7fff 100%)'
                      }}
                    />
                  </div>
                </div>

                {/* Weekly Report - Locked */}
                <div className="space-y-3 opacity-60">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center relative">
                        <img src="/report-icon.svg" alt="" className="w-5 h-5" />
                        <div
                          className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center shadow-lg"
                          style={{ backgroundColor: '#6a7282' }}
                        >
                          <img src="/lock-icon.svg" alt="" className="w-3 h-3" />
                        </div>
                      </div>
                      <span
                        className="text-base font-normal"
                        style={{
                          color: '#6a7282',
                          letterSpacing: '-0.3125px'
                        }}
                      >
                        Weekly Report
                      </span>
                    </div>
                    <span
                      className="text-base font-normal"
                      style={{
                        color: '#99a1af',
                        letterSpacing: '-0.3125px'
                      }}
                    >
                      Locked
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: '0%',
                        backgroundColor: '#d1d5dc'
                      }}
                    />
                  </div>
                  <p
                    className="text-xs italic text-left"
                    style={{
                      color: '#6a7282',
                      lineHeight: '16px'
                    }}
                  >
                    Unlocks after 3 journals + 1 meditation OR 5 journals
                  </p>
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div className="bg-red-100 border border-red-200 text-red-700 text-sm rounded-lg p-3 w-full">
                  {error}
                </div>
              )}

              {/* Button */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full h-14 rounded-2xl font-medium text-white text-sm shadow-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{
                  background: 'linear-gradient(90deg, #615fff 0%, #9810fa 100%)',
                  letterSpacing: '-0.1504px'
                }}
              >
                {isSubmitting ? 'Saving…' : 'Start exploring Replay'}
              </button>
            </section>
          )}
        </div>

        {activeStep === 5 && (
          <div className="flex justify-between items-center mt-6">
            <button
              type="button"
              onClick={handleBack}
              className="px-6 py-3 rounded-lg font-medium bg-gray-200 text-gray-700 hover:bg-gray-300"
            >
              Back
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleLeaveBlank}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Leave blank for now
              </button>
              <button
                type="button"
                onClick={() => {
                  updateLocalProfile({
                    thinking_about: formState.focus
                  });
                  handleNext();
                }}
                className="px-6 py-3 rounded-lg font-medium text-white bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingPage;
