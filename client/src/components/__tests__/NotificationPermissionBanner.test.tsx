import { jest } from '@jest/globals';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

let NotificationPermissionBanner: any;

beforeAll(async () => {
  ({ default: NotificationPermissionBanner } = await import('../NotificationPermissionBanner'));
});

describe('NotificationPermissionBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('triggers permission request when enable button clicked', async () => {
    const onRequestPermission = jest.fn<() => Promise<boolean>>();
    onRequestPermission.mockResolvedValue(true);
    const onDismiss = jest.fn();

    render(
      <NotificationPermissionBanner
        onRequestPermission={onRequestPermission}
        onDismiss={onDismiss}
      />
    );

    const enableButton = screen.getByRole('button', { name: /enable notifications/i });
    await act(async () => {
      fireEvent.click(enableButton);
    });

    await waitFor(() => {
      expect(onRequestPermission).toHaveBeenCalledTimes(1);
    });
  });

  it('shows install instructions on Safari when PWA required', async () => {
    const originalUserAgent = navigator.userAgent;
    const originalStandalone = (navigator as any).standalone;
    const originalMatchMedia = window.matchMedia;

    Object.defineProperty(window.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    });
    Object.defineProperty(window.navigator, 'standalone', {
      value: false,
      configurable: true,
    });
    window.matchMedia = jest.fn().mockReturnValue({
      matches: false,
      media: '',
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(() => false),
    } as MediaQueryList) as unknown as typeof window.matchMedia;

    const onRequestPermission = jest.fn<() => Promise<boolean>>();
    onRequestPermission.mockResolvedValue(true);

    render(
      <NotificationPermissionBanner
        onRequestPermission={onRequestPermission}
        onDismiss={jest.fn()}
      />
    );

    const enableButton = screen.getByRole('button', { name: /enable notifications/i });
    await act(async () => {
      fireEvent.click(enableButton);
    });

    await waitFor(() => {
      expect(onRequestPermission).not.toHaveBeenCalled();
    });
    expect(
      screen.getByText(/please install replay as an app first/i)
    ).toBeInTheDocument();

    Object.defineProperty(window.navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    });
    Object.defineProperty(window.navigator, 'standalone', {
      value: originalStandalone,
      configurable: true,
    });
    window.matchMedia = originalMatchMedia;
  });
});
