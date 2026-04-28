export interface ModelData {
  id: string
  label: string
  is_default: boolean
}

export interface ModelRepository {
  listByProvider(provider: string): Promise<ModelData[]>
  listAll(): Promise<ModelData[]>
}
