import type { Result } from '../../core/errors/Result';

/** Adapter boundary for opening the browser print dialog after the semantic record has rendered. */
export const openPrintDialog = (print: () => void = () => window.print()): Result<void> => {
    try {
        print();
        return { ok: true, value: undefined };
    } catch {
        return { ok: false, error: { code: 'print-unavailable', message: 'The printable record could not be opened right now. Your current work is unchanged.' } };
    }
};
