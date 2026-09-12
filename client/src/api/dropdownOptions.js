import { toast } from 'sonner';

// Lookup dropdowns need every page; the API caps each response at 100 records.
// Keep other dropdowns usable if one lookup (or a later page) fails.
export async function loadDropdownOptions(api, params = {}) {
  const items = [];
  try {
    let totalPages = 1;
    for (let page = 1; page <= totalPages; page += 1) {
      const response = await api.list({ ...params, page, limit: 100 });
      items.push(...response.data.data);
      totalPages = response.data.meta?.totalPages || 1;
    }
  } catch {
    toast.error('Some dropdown options could not load. Refresh the page to try again.');
  }
  return { data: { data: items } };
}
