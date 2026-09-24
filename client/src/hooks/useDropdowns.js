import { useEffect, useState } from 'react';
import { loadDropdownOptions } from '../api/dropdownOptions';
const EMPTY = [];

// Keep sources stable (a module constant or useMemo). Each request completes
// independently, so a slow or failed lookup cannot hide other usable lists.
export function useDropdowns(sources, refreshKey) {
  const [states, setStates] = useState({});
  const [revision, setRevision] = useState(0);
  const reload = () => setRevision((value) => value + 1);

  useEffect(() => {
    let cancelled = false;
    setStates((previous) => Object.fromEntries(Object.keys(sources).map((key) => [key, {
      records: previous[key]?.records || [], options: previous[key]?.options || [], loading: true, error: '',
    }])));
    for (const [key, source] of Object.entries(sources)) {
      loadDropdownOptions(source.api, source.params).then((response) => {
        if (cancelled) return;
        const records = response.data.data;
        setStates((previous) => ({ ...previous, [key]: {
          records,
          options: records.map((item) => ({ value: item._id, label: source.label ? source.label(item) : item[source.labelKey || 'name'] })),
          loading: false,
          error: response.error,
        } }));
      });
    }
    return () => { cancelled = true; };
  }, [sources, refreshKey, revision]);

  return {
    options: Object.fromEntries(Object.keys(sources).map((key) => [key, states[key]?.options || []])),
    records: Object.fromEntries(Object.keys(sources).map((key) => [key, states[key]?.records || EMPTY])),
    isLoading: Object.keys(sources).some((key) => states[key]?.loading !== false),
    reload,
    selectProps: (key) => ({
      options: states[key]?.options || [],
      isLoading: states[key]?.loading !== false,
      loadError: states[key]?.error || '',
      emptyMessage: sources[key]?.emptyMessage,
      onRetry: reload,
    }),
  };
}
