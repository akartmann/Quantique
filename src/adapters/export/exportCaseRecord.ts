import type { Result } from '../../core/errors/Result';
import { CaseRecordSchema, type CaseRecord } from '../../schemas/CaseRecordSchema';

type ExportDocument = Pick<Document, 'createElement' | 'body'>;
type ExportUrl = Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'>;

const failure = (): Result<void> => ({
    ok: false,
    error: { code: 'export-unavailable', message: 'Progress could not be exported right now. Your current work is unchanged.' }
});

/** Downloads the validated player-only record through a temporary same-origin object URL. */
export const exportCaseRecord = (
    record: CaseRecord,
    documentRef: ExportDocument = document,
    urlRef: ExportUrl = URL
): Result<void> => {
    const parsed = CaseRecordSchema.safeParse(record);
    if (!parsed.success) return failure();
    try {
        const blob = new Blob([JSON.stringify(parsed.data, null, 2)], { type: 'application/json' });
        const url = urlRef.createObjectURL(blob);
        const anchor = documentRef.createElement('a');
        anchor.href = url;
        anchor.download = `${parsed.data.caseId}-progress-v${parsed.data.schemaVersion}.json`;
        anchor.hidden = true;
        documentRef.body.append(anchor);
        anchor.click();
        anchor.remove();
        queueMicrotask(() => urlRef.revokeObjectURL(url));
        return { ok: true, value: undefined };
    } catch {
        return failure();
    }
};
