import { analyzeRedaction, applyRedaction, verifyRedaction } from '../redactor';
import apiClient from '@/api/client';

jest.mock('@/api/client');
const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('Redactor API', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    const fileId = 'file-123';
    const passphrase = 'secret-pass';

    test('analyzeDocument should call the backend and return entities', async () => {
        const mockResponse = { data: { entities: [{ text: 'John Doe', type: 'PERSON', bbox: [0, 0, 10, 10], page: 0, score: 0.99 }] } };
        mockedApiClient.post.mockResolvedValueOnce(mockResponse as any);

        const result = await analyzeRedaction(fileId, passphrase);

        expect(mockedApiClient.post).toHaveBeenCalledWith(
            expect.stringContaining(`/files/${fileId}/analyze-redaction`),
            expect.any(FormData),
            expect.objectContaining({ headers: { 'Content-Type': 'multipart/form-data' } })
        );
        expect(result).toEqual(mockResponse.data);
    });

    test('applyRedaction should call the backend and return metadata', async () => {
        const mockResponse = { data: { file_id: 'redacted-123', redaction_status: 'pending' } };
        mockedApiClient.post.mockResolvedValueOnce(mockResponse as any);

        const entities: any[] = [{ text: 'John Doe', type: 'PERSON', bbox: [0, 0, 10, 10], page: 0 }];
        const result = await applyRedaction(fileId, passphrase, entities);

        expect(mockedApiClient.post).toHaveBeenCalledWith(
            expect.stringContaining(`/files/${fileId}/apply-redaction`),
            expect.any(FormData),
            expect.objectContaining({ headers: { 'Content-Type': 'multipart/form-data' } })
        );
        expect(result).toEqual(mockResponse.data);
    });

    test('verifyRedaction should call the backend and return status', async () => {
        const mockResponse = { data: { file_id: fileId, valid_proof: true, status: 'complete' } };
        mockedApiClient.get.mockResolvedValueOnce(mockResponse as any);

        const result = await verifyRedaction(fileId);

        expect(mockedApiClient.get).toHaveBeenCalledWith(
            expect.stringContaining(`/files/${fileId}/verify-redaction`)
        );
        expect(result).toEqual(mockResponse.data);
    });
});
