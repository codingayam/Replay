import React, { useState, useEffect } from 'react';
import { useAuthenticatedApi, getSignedUrl } from '../utils/api';

interface SupabaseImageProps {
    src: string;
    alt: string;
    style?: React.CSSProperties;
    fallback?: React.ReactNode;
    onError?: () => void;
}

const SupabaseImage: React.FC<SupabaseImageProps> = ({ 
    src, 
    alt, 
    style, 
    fallback = null,
    onError 
}) => {
    const [imageUrl, setImageUrl] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<boolean>(false);
    const api = useAuthenticatedApi();

    useEffect(() => {
        const fetchSignedUrl = async () => {
            if (!src) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(false);
                
                const signedUrl = await getSignedUrl(src, api);
                
                if (signedUrl) {
                    setImageUrl(signedUrl);
                } else {
                    setError(true);
                    onError?.();
                }
            } catch (err) {
                console.error('Error fetching signed URL:', err);
                setError(true);
                onError?.();
            } finally {
                setLoading(false);
            }
        };

        fetchSignedUrl();
    }, [src, api, onError]);

    const handleImageError = () => {
        setError(true);
        onError?.();
    };

    if (loading) {
        return (
            <div style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6' }}>
                <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading...</span>
            </div>
        );
    }

    if (error || !imageUrl) {
        return fallback ? <>{fallback}</> : (
            <div style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6' }}>
                <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Image unavailable</span>
            </div>
        );
    }

    return (
        <img 
            src={imageUrl}
            alt={alt}
            style={style}
            onError={handleImageError}
        />
    );
};

export default SupabaseImage;