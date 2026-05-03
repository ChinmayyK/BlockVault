import { useEffect } from 'react';
import { useLoading } from '@/contexts/LoadingContext';
import apiClient from '@/api/client';

export const AxiosLoadingInterceptor: React.FC = () => {
    const { startLoading, stopLoading } = useLoading();

    useEffect(() => {
        const reqInterceptor = apiClient.interceptors.request.use(
            (config) => {
                // If the request explicitly skips loading, don't start the loader
                if (!(config as any).skipGlobalLoader) {
                    const message = (config as any).loadingMessage || undefined;
                    startLoading(message);
                }
                return config;
            },
            (error) => {
                stopLoading();
                return Promise.reject(error);
            }
        );

        const resInterceptor = apiClient.interceptors.response.use(
            (response) => {
                const config = response.config;
                if (!(config as any).skipGlobalLoader) {
                    stopLoading();
                }
                return response;
            },
            (error) => {
                const config = error.config;
                if (config && !(config as any).skipGlobalLoader) {
                    stopLoading();
                }
                return Promise.reject(error);
            }
        );

        return () => {
            apiClient.interceptors.request.eject(reqInterceptor);
            apiClient.interceptors.response.eject(resInterceptor);
        };
    }, [startLoading, stopLoading]);

    return null;
};
