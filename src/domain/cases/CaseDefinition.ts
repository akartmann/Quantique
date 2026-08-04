export type RecoveryRoute = 'replication' | 'control-change' | 'source-comparison';

export type ContextualArtifact = Readonly<{
    id: string;
    displayName: string;
    provenanceRef: string;
}>;

export type PrimaryControl = Readonly<{
    id: 'slitSpacingMm' | 'screenDistanceM';
    label: string;
    unit: string;
    min: number;
    max: number;
    step: number;
    defaultValue: number;
}>;

export type CaseDefinition = Readonly<{
    id: 'young-interference';
    version: string;
    openingDispute: string;
    contextualArtifacts: readonly [ContextualArtifact, ContextualArtifact];
    prediction: Readonly<{ required: true }>;
    apparatus: Readonly<{ primaryControls: readonly [PrimaryControl, PrimaryControl] }>;
    experiment: Readonly<{
        modelVersion: string;
        wavelengthNm: 550;
        assumptions: readonly string[];
        confound: Readonly<{ id: string; description: string; discoverableBy: RecoveryRoute }>;
        resetPath: Readonly<{ recoveryRoute: RecoveryRoute; description: string }>;
    }>;
    requirements: Readonly<{ minimumRuns: 2; minimumSources: 2 }>;
    flow: Readonly<{
        openingDispute: true;
        curatedRecord: true;
        labSetup: true;
        minimumExperimentCycles: 2;
        maximumExperimentCycles: 4;
        theoryBoardReview: true;
        historicalDebrief: true;
        optionalReplay: true;
    }>;
    debrief: Readonly<{ summary: string; sourceRefs: readonly string[] }>;
    assets: Readonly<{
        manifestVersion: string;
        entries: readonly Readonly<{ id: string; type: 'image' | 'audio' | 'document'; path: string }>[];
    }>;
}>;
