import React from 'react';
import '../styles/LotusFlowerButton.css';

interface LotusFlowerButtonProps {
    onClick: () => void;
}

const LotusFlowerButton: React.FC<LotusFlowerButtonProps> = ({ onClick }) => {
    // Generate smoke-like wisps with organic randomness
    const generateSmokeWisps = () => {
        const wisps = [];
        const centerX = 50;
        const centerY = 50;

        // Seeded random for consistency
        const seededRandom = (seed: number) => {
            const x = Math.sin(seed) * 10000;
            return x - Math.floor(x);
        };

        // Large smoke clouds - 6 main wisps with randomness
        for (let i = 0; i < 6; i++) {
            const angleOffset = (seededRandom(i * 7) - 0.5) * 40; // Random angle variation
            const angle = (i * 60 + angleOffset) * Math.PI / 180;
            const radiusVariation = seededRandom(i * 11) * 6 - 3;
            const baseRadius = 8 + radiusVariation;

            const x = centerX + Math.cos(angle) * baseRadius;
            const y = centerY + Math.sin(angle) * baseRadius;

            // More organic shapes
            const radius1 = 12 + seededRandom(i * 13) * 6;
            const radius2 = 10 + seededRandom(i * 17) * 5;
            const rotation = seededRandom(i * 19) * 360;

            wisps.push(
                <ellipse
                    key={`smoke-large-${i}`}
                    cx={x}
                    cy={y}
                    rx={radius1}
                    ry={radius2}
                    transform={`rotate(${rotation} ${x} ${y})`}
                    className="smoke-wisp large-smoke"
                    style={{ animationDelay: `${seededRandom(i * 23) * 2}s` }}
                />
            );
        }

        // Medium smoke puffs - 8 wisps with more variation
        for (let i = 0; i < 8; i++) {
            const angleOffset = (seededRandom(i * 29) - 0.5) * 35;
            const angle = (i * 45 + 22.5 + angleOffset) * Math.PI / 180;
            const radiusVariation = seededRandom(i * 31) * 8 - 4;
            const baseRadius = 15 + radiusVariation;

            const x = centerX + Math.cos(angle) * baseRadius;
            const y = centerY + Math.sin(angle) * baseRadius;

            const radius1 = 8 + seededRandom(i * 37) * 4;
            const radius2 = 7 + seededRandom(i * 41) * 3;
            const rotation = seededRandom(i * 43) * 360;

            wisps.push(
                <ellipse
                    key={`smoke-medium-${i}`}
                    cx={x}
                    cy={y}
                    rx={radius1}
                    ry={radius2}
                    transform={`rotate(${rotation} ${x} ${y})`}
                    className="smoke-wisp medium-smoke"
                    style={{ animationDelay: `${seededRandom(i * 47) * 1.8}s` }}
                />
            );
        }

        // Small smoke particles - 12 wisps scattered more randomly
        for (let i = 0; i < 12; i++) {
            const angleOffset = (seededRandom(i * 53) - 0.5) * 50;
            const angle = (i * 30 + angleOffset) * Math.PI / 180;
            const radiusVariation = seededRandom(i * 59) * 10 - 5;
            const baseRadius = 22 + radiusVariation;

            const x = centerX + Math.cos(angle) * baseRadius;
            const y = centerY + Math.sin(angle) * baseRadius;

            const radius1 = 5 + seededRandom(i * 61) * 3;
            const radius2 = 4 + seededRandom(i * 67) * 2.5;
            const rotation = seededRandom(i * 71) * 360;

            wisps.push(
                <ellipse
                    key={`smoke-small-${i}`}
                    cx={x}
                    cy={y}
                    rx={radius1}
                    ry={radius2}
                    transform={`rotate(${rotation} ${x} ${y})`}
                    className="smoke-wisp small-smoke"
                    style={{ animationDelay: `${seededRandom(i * 73) * 1.5}s` }}
                />
            );
        }

        // Tiny floating particles - 16 wisps with maximum scatter
        for (let i = 0; i < 16; i++) {
            const angleOffset = (seededRandom(i * 79) - 0.5) * 60;
            const angle = (i * 22.5 + angleOffset) * Math.PI / 180;
            const radiusVariation = seededRandom(i * 83) * 12 - 6;
            const baseRadius = 28 + radiusVariation;

            const x = centerX + Math.cos(angle) * baseRadius;
            const y = centerY + Math.sin(angle) * baseRadius;

            wisps.push(
                <circle
                    key={`smoke-tiny-${i}`}
                    cx={x}
                    cy={y}
                    r={2 + seededRandom(i * 89) * 1.2}
                    className="smoke-wisp tiny-smoke"
                    style={{ animationDelay: `${seededRandom(i * 97) * 1.2}s` }}
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

            {/* "Generate Meditation" text below */}
            <div className="lotus-button-text">Meditate</div>
        </div>
    );
};

export default LotusFlowerButton;
