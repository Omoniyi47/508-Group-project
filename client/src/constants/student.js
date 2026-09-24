export const ENTRY_MODE_OPTIONS = [
  { value: 'regular', label: 'Regular (UTME)' },
  { value: 'direct_entry', label: 'Direct entry' },
  { value: 'part_time', label: 'Part time' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'distance_learning', label: 'Distance learning' },
  { value: 'sandwich', label: 'Sandwich' },
  { value: 'other', label: 'Other' },
];
export const entryModeLabel = (value) => ENTRY_MODE_OPTIONS.find((option) => option.value === value)?.label || 'Not recorded';
