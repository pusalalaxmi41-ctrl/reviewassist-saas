import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';

export default function LandingPage() {
  return (
    <section className="mx-auto max-w-2xl py-12 text-center">
      <Star className="mx-auto h-10 w-10 text-amber-500" aria-hidden />
      <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
        Turn genuine customer experiences into great Google reviews
      </h1>
      <p className="mt-4 text-slate-600">
        Built for restaurants, cafes, hotels and PG accommodations.
      </p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Link to="/setup" className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">
          Register your business
        </Link>
        <Link to="/r/the-urban-kitchen" className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium hover:bg-slate-50">
          Preview customer page
        </Link>
      </div>
    </section>
  );
}
