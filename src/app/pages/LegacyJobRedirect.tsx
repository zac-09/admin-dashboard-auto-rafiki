import { Navigate, useParams } from 'react-router';

/** Old job links (/operations/jobs/:id) keep working. */
export function LegacyJobRedirect() {
  const { jobId = '' } = useParams();
  return <Navigate to={`/jobs/${jobId}`} replace />;
}
