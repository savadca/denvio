import { useEffect, useState } from 'react';
import { api } from './api';

const cache = {};

// Loads a static list from the API once per page load and shares it between components.
function useCachedList(url) {
  const [list, setList] = useState(cache[url] || []);
  useEffect(() => {
    if (cache[url]) return;
    api.get(url).then((items) => {
      cache[url] = items;
      setList(items);
    }).catch(() => {});
  }, [url]);
  return list;
}

// BDS subjects.
export const useSubjects = () => useCachedList('/subjects');

// Exam-prep sections: NEET MDS, INI-CET and international licensing exams.
export const useExams = () => useCachedList('/exams');

// Options for a "subject" dropdown. only="subjects" | "exams" limits the list;
// by default both are shown in two groups (used for mock tests).
export function TopicOptions({ only }) {
  const subjects = useSubjects();
  const exams = useExams();
  if (only === 'subjects') return subjects.map((s) => <option key={s}>{s}</option>);
  if (only === 'exams') return exams.map((s) => <option key={s}>{s}</option>);
  return (
    <>
      <optgroup label="Exam prep">
        {exams.map((s) => <option key={s}>{s}</option>)}
      </optgroup>
      <optgroup label="BDS subjects">
        {subjects.map((s) => <option key={s}>{s}</option>)}
      </optgroup>
    </>
  );
}
