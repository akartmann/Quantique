export type ResultError = Readonly<{
    code: string;
    message: string;
}>;

export type Result<T, E extends ResultError = ResultError> =
    | Readonly<{ ok: true; value: T }>
    | Readonly<{ ok: false; error: E }>;
