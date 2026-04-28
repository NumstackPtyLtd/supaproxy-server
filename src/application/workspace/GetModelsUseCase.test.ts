import { describe, it, expect, vi } from 'vitest'
import { mockModelRepo, mockOrgRepo } from '../../__tests__/mocks.js'
import { GetModelsUseCase } from './GetModelsUseCase.js'

describe('GetModelsUseCase', () => {
  it('lists by provider if set', async () => {
    const modelRepo = mockModelRepo()
    const orgRepo = mockOrgRepo()
    const uc = new GetModelsUseCase(modelRepo, orgRepo)

    vi.mocked(orgRepo.getSettingValue)
      .mockResolvedValueOnce('anthropic')  // ai_provider
      .mockResolvedValueOnce('model-1')    // default_model

    const models = [
      { id: 'model-1', label: 'Claude Sonnet', is_default: false },
      { id: 'model-2', label: 'Claude Opus', is_default: false },
    ]
    vi.mocked(modelRepo.listByProvider).mockResolvedValue(models)

    const result = await uc.execute()

    expect(modelRepo.listByProvider).toHaveBeenCalledWith('anthropic')
    expect(modelRepo.listAll).not.toHaveBeenCalled()
    expect(result).toEqual([
      { id: 'model-1', label: 'Claude Sonnet', is_default: true },
      { id: 'model-2', label: 'Claude Opus', is_default: false },
    ])
  })

  it('lists all if provider not set', async () => {
    const modelRepo = mockModelRepo()
    const orgRepo = mockOrgRepo()
    const uc = new GetModelsUseCase(modelRepo, orgRepo)

    vi.mocked(orgRepo.getSettingValue)
      .mockResolvedValueOnce(null)       // ai_provider not set
      .mockResolvedValueOnce(null)       // default_model not set

    const models = [{ id: 'model-1', label: 'Model 1', is_default: false }]
    vi.mocked(modelRepo.listAll).mockResolvedValue(models)

    const result = await uc.execute()

    expect(modelRepo.listAll).toHaveBeenCalledOnce()
    expect(modelRepo.listByProvider).not.toHaveBeenCalled()
    expect(result).toEqual([{ id: 'model-1', label: 'Model 1', is_default: false }])
  })

  it('marks default model', async () => {
    const modelRepo = mockModelRepo()
    const orgRepo = mockOrgRepo()
    const uc = new GetModelsUseCase(modelRepo, orgRepo)

    vi.mocked(orgRepo.getSettingValue)
      .mockResolvedValueOnce(null)          // ai_provider
      .mockResolvedValueOnce('model-2')     // default_model

    const models = [
      { id: 'model-1', label: 'Model A', is_default: false },
      { id: 'model-2', label: 'Model B', is_default: false },
    ]
    vi.mocked(modelRepo.listAll).mockResolvedValue(models)

    const result = await uc.execute()

    expect(result[0].is_default).toBe(false)
    expect(result[1].is_default).toBe(true)
  })
})
