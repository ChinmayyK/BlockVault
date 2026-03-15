import apiClient from "@/api/client";
import { AnalyzeResponse, RedactApplyResponse, RedactEntity, VerifyRedactionResponse } from "../types/redactor";

interface VerifyRedactionOptions {
    silent?: boolean;
}

export const analyzeRedaction = async (
    fileId: string,
    passphrase: string
): Promise<AnalyzeResponse> => {
    const formData = new FormData();
    formData.append("key", passphrase);

    let response = await apiClient.post(`/files/${fileId}/analyze-redaction`, formData, {
        headers: {
            "Content-Type": "multipart/form-data",
        },
    });

    if (response.data.status === "pending" || !response.data.entities) {
        while (true) {
            await new Promise((resolve) => setTimeout(resolve, 3000));
            response = await apiClient.post(`/files/${fileId}/analyze-redaction`, formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            if (response.data.status === "complete") {
                return response.data as AnalyzeResponse;
            } else if (response.data.status === "failed") {
                throw new Error("Analysis failed: " + (response.data.error || "Unknown Error"));
            }
        }
    }

    return response.data as AnalyzeResponse;
};

export const applyRedaction = async (
    fileId: string,
    passphrase: string,
    entities: RedactEntity[],
    manualBoxes: any[] = [],
    searchBoxes: any[] = []
): Promise<RedactApplyResponse> => {
    const formData = new FormData();
    formData.append("key", passphrase);
    formData.append("entities", JSON.stringify({ entities, manual_boxes: manualBoxes, search_boxes: searchBoxes }));

    const response = await apiClient.post(`/files/${fileId}/apply-redaction`, formData, {
        headers: {
            "Content-Type": "multipart/form-data",
        },
    });

    return response.data as RedactApplyResponse;
};

export const verifyRedaction = async (
    fileId: string,
    options: VerifyRedactionOptions = {},
): Promise<VerifyRedactionResponse> => {
    const response = await apiClient.get(`/files/${fileId}/verify-redaction`, {
        skipNetworkToast: options.silent,
    });
    return response.data as VerifyRedactionResponse;
};

export const searchRedactionMatches = async (
    fileId: string,
    passphrase: string,
    query: string,
    isRegex: boolean = false
): Promise<{ matches: any[] }> => {
    const formData = new FormData();
    formData.append("key", passphrase);
    formData.append("query", query);
    if (isRegex) {
        formData.append("is_regex", "true");
    }

    const response = await apiClient.post(`/files/${fileId}/search-redaction`, formData, {
        headers: {
            "Content-Type": "multipart/form-data",
        },
    });

    return response.data;
};
