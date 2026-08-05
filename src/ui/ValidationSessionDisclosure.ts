/** Renders facilitator-facing privacy information for the isolated Young validation entry mode. */
export const mountValidationSessionDisclosure = (root: HTMLElement): void => {
    const disclosure = document.createElement('section');
    disclosure.className = 'validation-session-disclosure';
    disclosure.setAttribute('aria-label', 'Young validation session');

    const heading = document.createElement('h2');
    heading.textContent = 'Young validation session';
    const facilitatorNotice = document.createElement('p');
    facilitatorNotice.textContent = 'Observations are held by the facilitator and de-identified outside this application.';
    const privacyNotice = document.createElement('p');
    privacyNotice.textContent = 'The application does not collect session responses.';

    disclosure.append(heading, facilitatorNotice, privacyNotice);
    root.replaceChildren(disclosure);
};
