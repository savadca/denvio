import { useEffect, useState } from 'react';
import { api } from './api';

let cache = null;

export function useSubjects() {
  const [subjects, setSubjects] = useState(cache || []);
  useEffect(() => {
    if (cache) return;
    api.get('/subjects').then((s) => {
      cache = s;
      setSubjects(s);
    }).catch(() => {});
  }, []);
  return subjects;
}
