declare module 'dwv' {
  export class ViewConfig {
    constructor(divId: string)
    divId: string
    orientation?: string
  }

  export class AppOptions {
    constructor(dataViewConfigs: Record<string, ViewConfig[]>)
    tools: Record<string, Record<string, unknown>>
    viewOnFirstLoadItem?: boolean
  }

  export interface DicomWebLoadOptions {
    requestHeaders?: Record<string, string>
    withCredentials?: boolean
    batchSize?: number
  }

  export interface SlicePosition {
    index: number
    number: number
    total: number
  }

  export interface PositionEvent {
    type: 'positionchange'
    position: {
      index: [number, number, number]
      slice: SlicePosition
      windowCenter: number
      windowWidth: number
    }
    target?: App
  }

  export interface LoadItemEventData {
    image?: {
      number?: number
      total?: number
    }
  }

  export interface LoadItemEvent {
    type: 'loaditem'
    data: LoadItemEventData
    target?: App
  }

  export interface LoadProgressEvent {
    type: 'loadprogress'
    loaded: number
    total: number
    target?: App
  }

  export interface AppErrorEvent {
    type: 'error'
    data?: { message?: string } | string
    target?: App
  }

  export interface ViewController {
    getNumberOfSlices(): number
    getCurrentIndex(): [number, number, number]
    getCurrentOrientation(): string
  }

  export class App {
    init(options: AppOptions): void
    loadURLs(urls: string[], options?: DicomWebLoadOptions): string
    loadFiles(files: FileList | File[]): Promise<void>
    loadFile(file: File): Promise<void>
    addEventListener(
      type: string,
      callback: (event: Event | PositionEvent | LoadItemEvent | LoadProgressEvent | AppErrorEvent) => void,
    ): void
    setTool(name: string): void
    setToolFeatures(features: Record<string, unknown>): void
    getViewController(): ViewController | null
    reset(): void
  }
}
