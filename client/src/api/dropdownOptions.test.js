import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { loadDropdownOptions } from './dropdownOptions';

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

describe('dropdown lookup loading', () => {
  beforeEach(() => vi.clearAllMocks());

  it('includes options after the first API page and preserves lookup filters', async () => {
    const api = { list: vi.fn()
      .mockResolvedValueOnce({ data: { data: [{ _id: 'first' }], meta: { totalPages: 2 } } })
      .mockResolvedValueOnce({ data: { data: [{ _id: 'last' }], meta: { totalPages: 2 } } }) };
    const result = await loadDropdownOptions(api, { role: 'hod' });
    expect(result.data.data.map((item) => item._id)).toEqual(['first', 'last']);
    expect(api.list).toHaveBeenNthCalledWith(2, { role: 'hod', page: 2, limit: 100 });
  });

  it('keeps successful dropdowns available when another lookup fails', async () => {
    const failed = { list: vi.fn().mockRejectedValue(new Error('Forbidden')) };
    const working = { list: vi.fn().mockResolvedValue({ data: { data: [{ _id: 'faculty' }] } }) };
    const results = await Promise.all([loadDropdownOptions(failed), loadDropdownOptions(working)]);
    expect(results[0].data.data).toEqual([]);
    expect(results[1].data.data).toEqual([{ _id: 'faculty' }]);
    expect(toast.error).toHaveBeenCalledOnce();
  });

  it('retains already loaded options if a later page fails', async () => {
    const api = { list: vi.fn()
      .mockResolvedValueOnce({ data: { data: [{ _id: 'first' }], meta: { totalPages: 2 } } })
      .mockRejectedValueOnce(new Error('Network error')) };
    expect((await loadDropdownOptions(api)).data.data).toEqual([{ _id: 'first' }]);
    expect(toast.error).toHaveBeenCalledOnce();
  });
});
