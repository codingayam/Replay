declare module 'firebase/messaging' {
  export const getToken: (...args: any[]) => Promise<string | null>;
  export const onMessage: (...args: any[]) => () => void;
}
