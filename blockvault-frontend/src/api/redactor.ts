import apiClient from "@/api/client";
import { AnalyzeResponse, RedactApplyResponse, RedactEntity, VerifyRedactionResponse } from "../types/redactor";

export const analyzeRedaction = async (
    fileId: string,
    passphrase: string
): Promise<AnalyzeResponse> => {
    const formData = new FormData();
    formData.append("key", passphrase);

    const response = await apiClient.post(`/files/${fileId}/analyze-redaction`, formData, {
        headers: {
            "Content-Type": "multipart/form-data",
        },
    });

    return response.data as AnalyzeResponse;
};

export const applyRedaction = async (
    fileId: string,
    passphrase: string,
    entities: RedactEntity[],
    manualBoxes: any[] = []
): Promise<RedactApplyResponse> => {
    const formData = new FormData();
    formData.append("key", passphrase);
    formData.append("entities", JSON.stringify({ entities, manual_boxes: manualBoxes }));

    const response = await apiClient.post(`/files/${fileId}/apply-redaction`, formData, {
        headers: {
            "Content-Type": "multipart/form-data",
        },
    });

    return response.data as RedactApplyResponse;
};

export const verifyRedaction = async (fileId: string): Promise<VerifyRedactionResponse> => {
    const response = await apiClient.get(`/files/${fileId}/verify-redaction`);
    return response.data as VerifyRedactionResponse;
};
