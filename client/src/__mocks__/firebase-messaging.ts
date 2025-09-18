import { jest } from '@jest/globals';

export const getToken = jest.fn(async () => 'test-token');
export const onMessage = jest.fn(() => () => {});
