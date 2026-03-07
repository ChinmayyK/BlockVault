import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';

interface LoadingContextType {
    isLoading: boolean;
    loadingMessage: string | null;
    startLoading: (message?: string) => void;
    stopLoading: () => void;
    setLoadingMessage: (message: string) => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const LoadingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessageState] = useState<string | null>(null);
    const requestCount = useRef(0);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const startLoading = useCallback((message?: string) => {
        requestCount.current += 1;

        if (message) {
            setLoadingMessageState(message);
        }

        // Add 300ms delay before showing loader to avoid flicker on fast requests
        if (requestCount.current === 1) {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
                if (requestCount.current > 0) {
                    setIsLoading(true);
                }
            }, 300);
        }
    }, []);

    const stopLoading = useCallback(() => {
        requestCount.current = Math.max(0, requestCount.current - 1);

        if (requestCount.current === 0) {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            setIsLoading(false);
            setLoadingMessageState(null);
        }
    }, []);

    const setLoadingMessage = useCallback((message: string) => {
        setLoadingMessageState(message);
    }, []);

    const value = useMemo(() => ({
        isLoading,
        loadingMessage,
        startLoading,
        stopLoading,
        setLoadingMessage
    }), [isLoading, loadingMessage, startLoading, stopLoading, setLoadingMessage]);

    return (
        <LoadingContext.Provider value={value}>
            {children}
        </LoadingContext.Provider>
    );
};

export const useLoading = () => {
    const context = useContext(LoadingContext);
    if (context === undefined) {
        throw new Error('useLoading must be used within a LoadingProvider');
    }
    return context;
};
