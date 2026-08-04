const READY_MESSAGE = 'Laboratory shell ready.';

export const getBootShellStatusMessage = (): string => READY_MESSAGE;

export const createBootShell = (root: HTMLElement): void => {
    const button = root.querySelector<HTMLButtonElement>('[data-testid="enter-laboratory"]');
    const status = root.querySelector<HTMLElement>('#boot-status');

    if (!button || !status) {
        throw new Error('The boot shell requires an entry button and status region.');
    }

    button.addEventListener('click', () => {
        status.textContent = getBootShellStatusMessage();
    });
};
