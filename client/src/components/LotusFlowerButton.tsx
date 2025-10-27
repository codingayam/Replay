import React from 'react';
import '../styles/LotusFlowerButton.css';

interface LotusFlowerButtonProps {
    onClick: () => void;
}

const LotusFlowerButton: React.FC<LotusFlowerButtonProps> = ({ onClick }) => {
    // Generate smoke-like wisps
    const generateSmokeWisps = () => {
        const wisps = [];
        const centerX = 50;
        const centerY = 50;

        // Large smoke clouds - 6 main wisps
        for (let i = 0; i < 6; i++) {
            const angle = (i * 60) * Math.PI / 180;
            const baseRadius = 8;

            const x = centerX + Math.cos(angle) * baseRadius;
            const y = centerY + Math.sin(angle) * baseRadius;

            // Create organic blob-like smoke shape
            const radius1 = 12 + Math.sin(i * 1.3) * 4;
            const radius2 = 10 + Math.cos(i * 0.8) * 3;

            wisps.push(
                <ellipse
                    key={`smoke-large-${i}`}
                    cx={x}
                    cy={y}
                    rx={radius1}
                    ry={radius2}
                    transform={`rotate(${i * 30} ${x} ${y})`}
                    className="smoke-wisp large-smoke"
                    style={{ animationDelay: `${i * 0.15}s` }}
                />
            );
        }

        // Medium smoke puffs - 8 wisps
        for (let i = 0; i < 8; i++) {
            const angle = (i * 45 + 22.5) * Math.PI / 180;
            const baseRadius = 15;

            const x = centerX + Math.cos(angle) * baseRadius;
            const y = centerY + Math.sin(angle) * baseRadius;

            const radius1 = 8 + Math.sin(i * 1.5) * 2;
            const radius2 = 7 + Math.cos(i * 1.2) * 2;

            wisps.push(
                <ellipse
                    key={`smoke-medium-${i}`}
                    cx={x}
                    cy={y}
                    rx={radius1}
                    ry={radius2}
                    transform={`rotate(${i * 45} ${x} ${y})`}
                    className="smoke-wisp medium-smoke"
                    style={{ animationDelay: `${i * 0.12}s` }}
                />
            );
        }

        // Small smoke particles - 12 wisps
        for (let i = 0; i < 12; i++) {
            const angle = (i * 30) * Math.PI / 180;
            const baseRadius = 22 + Math.sin(i * 0.7) * 5;

            const x = centerX + Math.cos(angle) * baseRadius;
            const y = centerY + Math.sin(angle) * baseRadius;

            const radius1 = 5 + Math.sin(i * 2) * 2;
            const radius2 = 4 + Math.cos(i * 1.8) * 1.5;

            wisps.push(
                <ellipse
                    key={`smoke-small-${i}`}
                    cx={x}
                    cy={y}
                    rx={radius1}
                    ry={radius2}
                    transform={`rotate(${i * 15} ${x} ${y})`}
                    className="smoke-wisp small-smoke"
                    style={{ animationDelay: `${i * 0.1}s` }}
                />
            );
        }

        // Tiny floating particles - 16 wisps
        for (let i = 0; i < 16; i++) {
            const angle = (i * 22.5) * Math.PI / 180;
            const baseRadius = 28 + Math.sin(i * 0.5) * 7;

            const x = centerX + Math.cos(angle) * baseRadius;
            const y = centerY + Math.sin(angle) * baseRadius;

            wisps.push(
                <circle
                    key={`smoke-tiny-${i}`}
                    cx={x}
                    cy={y}
                    r={2 + Math.sin(i * 3) * 0.5}
                    className="smoke-wisp tiny-smoke"
                    style={{ animationDelay: `${i * 0.08}s` }}
                />
            );
        }

        return wisps;
    };

    return (
        <div className="lotus-button-container" onClick={onClick}>
            <div className="mandala-container">
                <svg viewBox="0 0 100 100" className="mandala-svg">
                    {/* Radial gradient for smoke effect */}
                    <defs>
                        <radialGradient id="smoke-glow" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor="rgba(6, 182, 212, 0.15)" />
                            <stop offset="40%" stopColor="rgba(6, 182, 212, 0.08)" />
                            <stop offset="100%" stopColor="rgba(6, 182, 212, 0)" />
                        </radialGradient>
                    </defs>

                    {/* Background glow */}
                    <rect width="100" height="100" fill="url(#smoke-glow)" />

                    {/* Smoke wisps */}
                    {generateSmokeWisps()}
                </svg>
            </div>

            {/* "Reflect" text below */}
            <div className="lotus-button-text">Reflect</div>
        </div>
    );
};

export default LotusFlowerButton;
