import { Link } from 'react-router-dom';
import { Button } from '../components/common/Button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-off-white px-4 text-center">
      <p className="text-6xl font-bold text-indigo">404</p>
      <h1 className="text-xl font-semibold text-navy">Page not found</h1>
      <p className="max-w-sm text-sm text-slate">The page you're looking for doesn't exist or you don't have access to it.</p>
      <Link to="/dashboard">
        <Button>Back to dashboard</Button>
      </Link>
    </div>
  );
}
