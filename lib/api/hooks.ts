import { useState, useEffect, useCallback, useRef } from "react";
import type { ApiResponse } from "./types";
import { initialApiState, loadedApiState, errorApiState } from "./types";

export function useQuery<T>(
  fetcher: (signal?: AbortSignal) => Promise<T>,
  deps: unknown[] = []
) {
  const [state, setState] = useState<ApiResponse<T>>(initialApiState<T>());
  const abortRef = useRef<AbortController | null>(null);

  const execute = useCallback(async () => {
    abortRef.current?.abort();

    const controller = new AbortController();
    abortRef.current = controller;

    setState(initialApiState<T>());
    try {
      const data = await fetcher(controller.signal);
      if (!controller.signal.aborted) {
        setState(loadedApiState(data));
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      setState(
        errorApiState(
          err instanceof Error ? err.message : "Произошла ошибка"
        )
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    execute();
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [execute]);

  return { ...state, refetch: execute };
}

export function useQueryArg<T, A>(
  fetcher: (arg: A, signal?: AbortSignal) => Promise<T>,
  arg: A,
) {
  const [state, setState] = useState<ApiResponse<T>>(initialApiState<T>());
  const abortRef = useRef<AbortController | null>(null);
  const argRef = useRef(arg);
  argRef.current = arg;

  const execute = useCallback(async () => {
    abortRef.current?.abort();

    const controller = new AbortController();
    abortRef.current = controller;

    setState(initialApiState<T>());
    try {
      const data = await fetcher(argRef.current, controller.signal);
      if (!controller.signal.aborted) {
        setState(loadedApiState(data));
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      setState(
        errorApiState(
          err instanceof Error ? err.message : "Произошла ошибка"
        )
      );
    }
  }, [fetcher]);

  useEffect(() => {
    execute();
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [execute]);

  return { ...state, refetch: execute };
}
