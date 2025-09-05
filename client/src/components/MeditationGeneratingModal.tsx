import React, { useEffect, useState } from 'react';
import { Loader2, Brain, Sparkles } from 'lucide-react';

interface MeditationGeneratingModalProps {
    isOpen: boolean;
    onClose?: () => void;
    onComplete?: () => void;
    isApiComplete?: boolean;
    onRunInBackground?: () => void;
    showBackgroundOption?: boolean;
}

const MeditationGeneratingModal: React.FC<MeditationGeneratingModalProps> = ({
    isOpen,
    onClose,
    onComplete,
    isApiComplete = false,
    onRunInBackground,
    showBackgroundOption = true
}) => {
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [animationClass, setAnimationClass] = useState('');
    const [isCompleted, setIsCompleted] = useState(false);
    const [animationComplete, setAnimationComplete] = useState(false);

    const steps = [
        "Analyzing your preferences",
        "Crafting personalized content", 
        "Preparing your session"
    ];

    useEffect(() => {
        if (!isOpen) {
            setCurrentStepIndex(0);
            setIsCompleted(false);
            setAnimationComplete(false);
            return;
        }

        setAnimationClass('meditation-modal-enter');
        
        const stepInterval = setInterval(() => {
            setCurrentStepIndex(prev => {
                if (prev < steps.length - 1) {
                    return prev + 1;
                } else {
                    // Animation sequence complete, but keep cycling if API not done
                    setAnimationComplete(true);
                    // Optionally cycle back to show continued progress
                    return prev; // Stay on last step
                }
            });
        }, 2000);

        return () => clearInterval(stepInterval);
    }, [isOpen, steps.length]);

    // Trigger completion when both conditions are met
    useEffect(() => {
        if (!isOpen || !onComplete || isCompleted) return;

        // If both animation and API are complete, mark as completed
        if (animationComplete && isApiComplete) {
            setIsCompleted(true);
        }
    }, [animationComplete, isApiComplete, isCompleted, onComplete, isOpen]);

    // Handle the completion delay and callback
    useEffect(() => {
        if (!isOpen || !onComplete || !isCompleted) return;

        // Brief delay to show "Ready!" state, then auto-transition
        const completionTimer = setTimeout(() => {
            onComplete();
        }, 1500);

        return () => clearTimeout(completionTimer);
    }, [isCompleted, onComplete, isOpen]);

    // No timeout - let the API take as long as it needs
    // The parent component will handle API failures through try/catch


    if (!isOpen) return null;

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div 
                style={styles.modal}
                className={animationClass}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div style={styles.header}>
                    <h1 style={styles.title}>
                        Creating Your Meditation
                    </h1>
                    <p style={styles.subtitle}>
                        Personalizing your mindfulness journey
                    </p>
                </div>

                {/* Main Content */}
                <div style={styles.content}>
                    {/* Loading Animation */}
                    <div style={styles.animationContainer}>
                        {/* Outer Circle */}
                        <div style={styles.outerCircle} className="rotate-animation" />
                        
                        {/* Inner Breathing Circle */}
                        <div style={styles.innerCircle} className="breathing-animation">
                            <Brain size={32} color="var(--primary-color)" />
                        </div>

                        {/* Floating Sparkles */}
                        <div style={styles.sparkle1} className="sparkle-animation-1">
                            <Sparkles size={16} color="var(--primary-color)" opacity={0.6} />
                        </div>

                        <div style={styles.sparkle2} className="sparkle-animation-2">
                            <Sparkles size={12} color="var(--primary-color)" opacity={0.4} />
                        </div>
                    </div>

                    {/* Progress Text */}
                    <div style={styles.progressText}>
                        <div style={styles.loadingIndicator}>
                            {!isCompleted ? (
                                <>
                                    <Loader2 size={16} className="spin-animation" color="var(--primary-color)" />
                                    <span style={styles.generatingText}>
                                        {animationComplete && !isApiComplete 
                                            ? "Crafting your personalized meditation..." 
                                            : "Generating your meditation..."
                                        }
                                    </span>
                                </>
                            ) : (
                                <>
                                    <Sparkles size={16} color="var(--success-color)" />
                                    <span style={{...styles.generatingText, color: 'var(--success-color)'}}>
                                        Ready! Starting your meditation...
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Steps */}
                    <div style={styles.stepsContainer}>
                        {steps.map((step, index) => (
                            <div 
                                key={index}
                                style={{
                                    ...styles.step,
                                    ...(index <= currentStepIndex ? styles.stepActive : styles.stepInactive)
                                }}
                            >
                                <div style={{
                                    ...styles.stepDot,
                                    ...(isCompleted ? styles.stepDotCompleted :
                                        index === currentStepIndex ? styles.stepDotActive : 
                                        index < currentStepIndex ? styles.stepDotCompleted : styles.stepDotInactive)
                                }} />
                                <span style={{
                                    ...styles.stepText,
                                    ...(index <= currentStepIndex ? styles.stepTextActive : styles.stepTextInactive)
                                }}>
                                    {step}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bottom Message and Actions */}
                <div style={styles.footer}>
                    <p style={styles.footerText}>
                        {animationComplete && !isApiComplete 
                            ? "Creating your unique meditation experience..." 
                            : "This usually takes 1-2 minutes"
                        }
                    </p>
                    
                    {/* Background Option Button */}
                    {showBackgroundOption && onRunInBackground && !isCompleted && (
                        <div style={styles.backgroundButtonContainer}>
                            <button
                                style={styles.backgroundButton}
                                onClick={() => {
                                    onRunInBackground();
                                    if (onClose) onClose();
                                }}
                            >
                                🔄 Run in Background
                            </button>
                            <p style={styles.backgroundButtonSubtext}>
                                Continue using the app while your meditation generates
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const styles = {
    overlay: {
        position: 'fixed' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(4px)',
    },
    modal: {
        backgroundColor: 'var(--card-background)',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '400px',
        minHeight: '600px',
        display: 'flex',
        flexDirection: 'column' as const,
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        margin: '1rem',
    },
    header: {
        padding: '3rem 1.5rem 2rem 1.5rem',
        textAlign: 'center' as const,
    },
    title: {
        fontSize: '1.5rem',
        fontWeight: '500',
        color: 'var(--text-color)',
        margin: '0 0 0.5rem 0',
        lineHeight: 1.3,
    },
    subtitle: {
        fontSize: '1rem',
        color: 'var(--text-secondary)',
        margin: 0,
        lineHeight: 1.4,
    },
    content: {
        flex: 1,
        padding: '0 1.5rem',
        display: 'flex',
        flexDirection: 'column' as const,
        justifyContent: 'center',
        alignItems: 'center',
    },
    animationContainer: {
        position: 'relative' as const,
        marginBottom: '3rem',
        width: '128px',
        height: '128px',
    },
    outerCircle: {
        width: '128px',
        height: '128px',
        borderRadius: '50%',
        border: '4px solid rgba(var(--text-secondary-rgb), 0.2)',
        position: 'absolute' as const,
        top: 0,
        left: 0,
    },
    innerCircle: {
        position: 'absolute' as const,
        top: '16px',
        left: '16px',
        width: '96px',
        height: '96px',
        backgroundColor: 'rgba(var(--primary-color-rgb), 0.1)',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sparkle1: {
        position: 'absolute' as const,
        top: '-8px',
        right: '-8px',
    },
    sparkle2: {
        position: 'absolute' as const,
        bottom: '-4px',
        left: '-12px',
    },
    progressText: {
        textAlign: 'center' as const,
        marginBottom: '2rem',
    },
    loadingIndicator: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        marginBottom: '1rem',
    },
    generatingText: {
        color: 'var(--text-color)',
        fontWeight: '500',
        fontSize: '1rem',
    },
    stepsContainer: {
        width: '100%',
        maxWidth: '320px',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '1rem',
    },
    step: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem',
        borderRadius: '8px',
        backgroundColor: 'rgba(var(--text-secondary-rgb), 0.05)',
        transition: 'all 0.3s ease',
    },
    stepActive: {
        backgroundColor: 'rgba(var(--primary-color-rgb), 0.1)',
    },
    stepInactive: {
        backgroundColor: 'rgba(var(--text-secondary-rgb), 0.05)',
    },
    stepDot: {
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        transition: 'all 0.3s ease',
    },
    stepDotActive: {
        backgroundColor: 'var(--primary-color)',
        animation: 'pulse 2s infinite',
    },
    stepDotCompleted: {
        backgroundColor: 'var(--success-color)',
    },
    stepDotInactive: {
        backgroundColor: 'rgba(var(--text-secondary-rgb), 0.3)',
    },
    stepText: {
        fontSize: '0.875rem',
        transition: 'color 0.3s ease',
    },
    stepTextActive: {
        color: 'var(--text-color)',
    },
    stepTextInactive: {
        color: 'var(--text-secondary)',
    },
    footer: {
        padding: '2rem 1.5rem 3rem 1.5rem',
        textAlign: 'center' as const,
    },
    footerText: {
        fontSize: '0.875rem',
        color: 'var(--text-secondary)',
        margin: 0,
        lineHeight: 1.4,
    },
    backgroundButtonContainer: {
        marginTop: '2rem',
        textAlign: 'center' as const,
    },
    backgroundButton: {
        backgroundColor: 'rgba(var(--primary-color-rgb), 0.1)',
        border: '2px solid var(--primary-color)',
        borderRadius: '12px',
        color: 'var(--primary-color)',
        padding: '0.75rem 2rem',
        fontSize: '0.875rem',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        marginBottom: '0.5rem',
        ':hover': {
            backgroundColor: 'rgba(var(--primary-color-rgb), 0.2)',
            transform: 'translateY(-1px)',
        },
        ':active': {
            transform: 'translateY(0)',
        },
    },
    backgroundButtonSubtext: {
        fontSize: '0.75rem',
        color: 'var(--text-secondary)',
        lineHeight: 1.3,
        maxWidth: '280px',
        margin: '0.5rem auto 0 auto',
    },
};

export default MeditationGeneratingModal;