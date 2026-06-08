export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

export function initialApiState<T>(): ApiResponse<T> {
  return { data: null, error: null, loading: true };
}

export function loadedApiState<T>(data: T): ApiResponse<T> {
  return { data, error: null, loading: false };
}

export function errorApiState<T>(error: string): ApiResponse<T> {
  return { data: null, error, loading: false };
}
